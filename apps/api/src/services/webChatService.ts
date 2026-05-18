/* ══════════════════════════════════════════════════════════════════════════
 * webChatService — chat in-page do site (zappiq.com.br) com a MESMA Iza
 * --------------------------------------------------------------------------
 * Contexto:
 *   O chat in-page do site precisa responder EXATAMENTE como a Iza responde
 *   no WhatsApp — mesmo system prompt v7.6 + CORE_AGENT_RULES_V1 +
 *   cascade LLM Sonnet→Haiku→GPT.
 *
 * Por que NÃO reusar agentOrchestrator.processIncomingMessage:
 *   - Aquele path está acoplado a Contact + Conversation + waService.sendText
 *     + voice TTS + RAG por org + handoff humano. Pra visitante anônimo do
 *     site, é overkill e quebra (sem phone, sem contact, sem conversation).
 *   - Solução: extrair APENAS a parte LLM. Stateless por turno — frontend
 *     persiste history em localStorage e envia toda vez. TTL natural via
 *     comportamento do usuário (fechou aba, sumiu).
 *
 * Garantias:
 *   - systemPrompt = CORE_AGENT_RULES_V1 + agents.system_prompt da Iza
 *     canonical (org `cmo1ywwfe00ko1jskexiexsm4`, agent role='comercial').
 *   - Cascade Sonnet→Haiku→GPT via chatCompletion() (mesma usada no
 *     WhatsApp path).
 *   - Hard caps: 20 turnos no history, 2000 chars por mensagem, 1024 maxTokens.
 *   - Audit em llm_call_logs via orgId da Iza canonical (rastreabilidade).
 *
 * Limitação aceita V1:
 *   - Sem RAG (KB chunks) por enquanto. A Iza canonical tem KB própria mas
 *     o RAG depende de orgId de tenant cliente, não do dogfood. Em V2,
 *     podemos plugar ragService.search('cmo1ywwfe00ko1jskexiexsm4', text).
 *   - Sem persistência DB. Se quiser virar lead/contact, V2 cria Contact
 *     ad-hoc + Conversation channel='web'.
 * ══════════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { chatCompletion, type LLMMessage } from './llm/langchainClient.js';
import { CORE_AGENT_RULES_V1 } from '../agents/coreAgentRules.js';
import { logger } from '../utils/logger.js';

/* ── Cleanup helpers (duplicados de agentOrchestrator pra evitar circular dep
 *    — alinhar com PR #71 caso o original mude). ──────────────────────── */
function stripStructuredTags(text: string): string {
  if (!text) return text;
  return text
    .replace(/<action_data>[\s\S]*?<\/action_data>/gi, '')
    .replace(/<action>[\s\S]*?<\/action>/gi, '')
    .replace(/<buttons>[\s\S]*?<\/buttons>/gi, '')
    .replace(/<\/?reply>/gi, '')
    .replace(/<\/?(action|action_data|buttons|reply)\b[^>]*>/gi, '')
    .trim();
}

function stripLeakedPrefixes(text: string): string {
  if (!text) return text;
  return text.replace(/^(\s*\[(áudio|audio)( transcrito)?\]\s*)+/i, '').trim();
}

/* ── Org/agent canonical da Iza (dogfood) ─────────────────────────────
 * Documentado em memory `project_zappiq_3_orgs_zappiq_naming.md`. */
const IZA_CANONICAL_ORG_ID = 'cmo1ywwfe00ko1jskexiexsm4';

/* ── Hard caps de segurança ─────────────────────────────── */
export const MAX_HISTORY_TURNS = 20;
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_OUTPUT_TOKENS = 1024;

/* ── Cache do systemPrompt em memória (refresh a cada 5 min) ────────
 * Evita query no DB a cada turno. v7.6 = 19k chars, raramente muda. */
let cachedSystemPrompt: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadIzaSystemPrompt(): Promise<string> {
  const now = Date.now();
  if (cachedSystemPrompt && now - cachedAt < CACHE_TTL_MS) {
    return cachedSystemPrompt;
  }

  // Query direto: agents é snake_case, role='comercial' = Iza vendendo.
  const rows = await prisma.$queryRawUnsafe<Array<{ system_prompt: string }>>(
    `SELECT system_prompt FROM agents
     WHERE organization_id = $1 AND role = 'comercial' AND status = 'live'
     ORDER BY created_at ASC LIMIT 1`,
    IZA_CANONICAL_ORG_ID,
  );

  if (!rows.length || !rows[0].system_prompt) {
    throw new Error(`webChatService: Iza system_prompt não encontrado pra org ${IZA_CANONICAL_ORG_ID}`);
  }

  cachedSystemPrompt = rows[0].system_prompt;
  cachedAt = now;
  return cachedSystemPrompt;
}

/* ── Tipos ───────────────────────────────────────────── */

export interface WebChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface WebChatRequest {
  sessionId: string;
  message: string;
  history: WebChatTurn[];
}

export interface WebChatResponse {
  reply: string;
  provider?: string;
  model?: string;
  latencyMs: number;
}

/* ── Sanitização ─────────────────────────────────────── */

function sanitizeMessage(text: string): string {
  return String(text || '').trim().slice(0, MAX_MESSAGE_LENGTH);
}

function sanitizeHistory(history: unknown): WebChatTurn[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (t): t is WebChatTurn =>
        !!t &&
        typeof t === 'object' &&
        (t as any).role &&
        (t as any).content &&
        ((t as any).role === 'user' || (t as any).role === 'assistant') &&
        typeof (t as any).content === 'string',
    )
    .map((t) => ({
      role: t.role,
      content: sanitizeMessage(t.content),
    }))
    .slice(-MAX_HISTORY_TURNS);
}

/* ── Handler principal ────────────────────────────── */

export async function processWebChatTurn(input: WebChatRequest): Promise<WebChatResponse> {
  const startedAt = Date.now();
  const sessionId = String(input.sessionId || '').slice(0, 64) || 'anon';
  const userMessage = sanitizeMessage(input.message);
  if (!userMessage) {
    throw new Error('Mensagem vazia');
  }
  const history = sanitizeHistory(input.history);

  // 1. systemPrompt = CORE_AGENT_RULES_V1 + Iza v7.6 (cache 5min)
  const izaPrompt = await loadIzaSystemPrompt();
  const systemPrompt = `${CORE_AGENT_RULES_V1}\n\n${izaPrompt}\n\n# CANAL DE COMUNICAÇÃO\nVocê está respondendo no CHAT IN-PAGE do site zappiq.com.br (não WhatsApp). Visitante anônimo navegando a landing page. Mantenha as mesmas regras, tom e calibração. Sempre que fizer sentido, ofereça mudar pro WhatsApp pra continuar a conversa com histórico salvo.`;

  // 2. Monta messages: history + novo turno do user
  const messages: LLMMessage[] = [
    ...history.map((t) => ({ role: t.role as 'user' | 'assistant', content: t.content })),
    { role: 'user', content: userMessage },
  ];

  // 3. Chama cascade LLM (mesma do WhatsApp)
  let llmResp;
  try {
    llmResp = await chatCompletion(systemPrompt, messages, MAX_OUTPUT_TOKENS, {
      orgId: IZA_CANONICAL_ORG_ID,
      conversationId: `web-chat:${sessionId}`,
    });
  } catch (err) {
    logger.error('[webChat] chatCompletion failed', { sessionId, err });
    throw new Error('LLM_UNAVAILABLE');
  }

  // 4. Strip tags estruturadas — o prompt da Iza pode retornar
  //    <action>, <action_data>, <buttons>. No chat web, ignoramos essas
  //    (não fazem sentido aqui) e usamos só o texto visível.
  //    Reusa o mesmo cleanup do agentOrchestrator pra garantir paridade.
  let reply = String(llmResp.text || '').trim();
  // Se houver <reply>…</reply>, prioriza esse conteúdo (mesma lógica do
  // parseAgentResponse interno).
  const replyMatch = reply.match(/<reply>([\s\S]*?)<\/reply>/i);
  if (replyMatch) reply = replyMatch[1].trim();
  reply = stripStructuredTags(reply);
  reply = stripLeakedPrefixes(reply);

  const latencyMs = Date.now() - startedAt;
  logger.info('[webChat] turn ok', {
    sessionId,
    provider: llmResp.provider,
    model: llmResp.model,
    inputTokens: llmResp.inputTokens,
    outputTokens: llmResp.outputTokens,
    latencyMs,
    historyLen: history.length,
  });

  return {
    reply,
    provider: llmResp.provider,
    model: llmResp.model,
    latencyMs,
  };
}
