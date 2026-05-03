import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import redis from '../utils/redis.js';
import * as waService from '../services/whatsappService.js';
import * as ragService from '../services/ragService.js';
import { chatCompletion, classify, type LLMMessage, type LLMContext } from '../services/llm/langchainClient.js';
import { routeIzaTurn } from '../services/llm/izaTurnRouter.js';
import type { LLMTier, LLMProviderId } from '../services/llm/LLMRouter.js';
import { transcribeAudio } from '../services/llm/audioTranscription.js';
import { getSystemPrompt } from './promptEngine.js';
import type { Server as SocketIOServer } from 'socket.io';

export interface ProcessMessageInput {
  organizationId: string;
  conversationId: string;
  contactId: string;
  contactPhone: string;
  contactName: string;
  messageContent: string;
  messageType: string;
  whatsappMessageId: string;
  orgSettings: any;
  io?: SocketIOServer;
  /** V4 #156 — mediaId Meta CDN (presente quando type=audio/image/document/video) */
  mediaId?: string | null;
}

export async function processIncomingMessage(input: ProcessMessageInput): Promise<void> {
  const { organizationId, conversationId, contactId, contactPhone, contactName, whatsappMessageId, orgSettings, io, mediaId } = input;

  // V4 #156 — messageContent e messageType são mutáveis: áudio é transcrito via
  // Whisper e segue como texto pelo motor de venda padrão (RAG, intent, prompt).
  let messageContent = input.messageContent;
  let messageType = input.messageType;

  logger.info(`[Agent] Processing message from ${contactPhone}`, { organizationId, messageType });

  try {
    // ── 0. Mark message as read ─────────────────────────
    await waService.markAsRead(whatsappMessageId).catch(() => {});

    // ── 0.5. AUTOREPLY MODE (Plano B pre-Go-Live) ───────
    // Quando IZA_AUTOREPLY_TEMPLATE estiver setado em env, responder
    // sempre o mesmo texto fixo e marcar contato como handoff (pausa AI
    // até Rodrigo destrabar manualmente). Garante zero hallucination
    // enquanto Iza nao esta GA. Remover env quando Iza estiver pronta.
    const autoReplyTemplate = process.env.IZA_AUTOREPLY_TEMPLATE;
    if (autoReplyTemplate) {
      logger.info(`[Agent] AUTOREPLY mode active for ${contactPhone}`);
      try {
        await waService.sendText(contactPhone, autoReplyTemplate);
        await prisma.message.create({
          data: {
            direction: 'OUTBOUND',
            type: 'TEXT',
            content: autoReplyTemplate,
            status: 'SENT',
            conversationId,
            isFromBot: true,
            aiConfidence: 1.0,
          },
        });
        // Pausa AI pra esse contato — proximas mensagens nao geram autoreply
        // de novo, ficam aguardando atendimento humano.
        const pauseKey = `ai_paused:${organizationId}:${contactPhone}`;
        await redis.set(pauseKey, 'autoreply', 'EX', 60 * 60 * 24 * 7).catch(() => {});
      } catch (err) {
        logger.error('[Agent] Autoreply send failed:', err);
      }
      return;
    }

    // ── 1. Check if AI is paused (handoff mode) ─────────
    // V4 patch (2026-05-01): pause keys com valor 'autoreply' são LEGACY do
    // Plan B (já removido). Quando Plan B foi desligado, pause keys ativas
    // continuaram bloqueando V4. Detecção + cleanup automático.
    const pauseKey = `ai_paused:${organizationId}:${contactPhone}`;
    const pauseValue = await redis.get(pauseKey).catch(() => null);
    if (pauseValue) {
      if (pauseValue === 'autoreply') {
        // Legacy Plan B — limpa silenciosamente e segue
        logger.info(`[Agent] Limpando pause key legacy Plan B para ${contactPhone}`);
        await redis.del(pauseKey).catch(() => {});
        // continua processamento normal abaixo
      } else {
        // Pause real (handoff humano ativo) — respeita
        logger.info(`[Agent] AI paused for ${contactPhone} (value=${pauseValue}), skipping`);
        return;
      }
    }

    // ── 2. Audio inbound: transcrever via Whisper e seguir como texto ──
    // V4 #156 — Whisper STT permite que cliente mande áudio e Iza processe
    // o conteúdo igual a uma mensagem de texto (RAG, intent, prompt V6).
    // Resposta de saída continua sendo texto (TTS outbound só V5).
    if (messageType === 'audio' && mediaId) {
      logger.info(`[Agent] Transcrevendo áudio inbound (mediaId=${mediaId}) de ${contactPhone}`);
      const transcribeResult = await transcribeAudio(mediaId, {
        organizationId,
        conversationId,
        contactPhone,
      });

      if (transcribeResult.text && transcribeResult.text.trim().length > 0) {
        // Persiste transcript no Message já gravado pra historico/audit
        try {
          await prisma.message.updateMany({
            where: { whatsappMessageId },
            data: { content: `[áudio transcrito] ${transcribeResult.text}` },
          });
        } catch (err) {
          logger.warn('[Agent] Falha ao persistir transcript no Message', { err });
        }

        // Reescreve content + type pra seguir o fluxo de texto normal
        messageContent = transcribeResult.text;
        messageType = 'text';
        logger.info(`[Agent] Transcrição OK (${transcribeResult.text.length} chars, ${transcribeResult.latencyMs}ms) — segue fluxo texto`);
        // Cai pra fluxo de texto abaixo (não return)
      } else {
        // Transcrição falhou — manda fallback educado (sem emojis)
        logger.warn(`[Agent] Transcrição falhou: ${transcribeResult.error || 'unknown'} — fallback texto`);
        await waService.sendText(
          contactPhone,
          'Não consegui processar seu áudio agora. Pode me mandar em texto?',
        );
        return;
      }
    }

    // ── 2.5. Handle outros não-textos (image, document, video, location) ─
    if (messageType !== 'text' && messageType !== 'button_reply' && messageType !== 'list_reply') {
      await handleNonTextMessage(contactPhone, messageType);
      return;
    }

    // ── 3. Load conversation history (last 20 turns) ────
    const historyMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { direction: true, content: true },
    });

    // ── 4. Classify intent ──────────────────────────────
    // V2-018: passa contexto pra audit por turn em llm_call_logs
    const llmCtx: LLMContext = { orgId: organizationId, conversationId };
    const intent = await classifyIntent(messageContent, llmCtx);
    logger.info(`[Agent] Intent: ${intent}`, { contactPhone, organizationId });

    // ── 5. Check for handoff request ────────────────────
    if (intent === 'request_human') {
      await handleHandoff(organizationId, contactPhone, contactId, orgSettings, io);
      return;
    }

    // ── 6. Retrieve RAG context ─────────────────────────
    let ragContext = '';
    try {
      ragContext = await ragService.search(organizationId, messageContent, 5);
    } catch (e: any) {
      logger.warn('[Agent] RAG unavailable:', e.message);
    }

    // ── 7. Build system prompt ──────────────────────────
    // V2-021 (Sprint 0): persona dual via Agent table.
    // - lead/trial (leadStatus in NEW/CONTACTED/QUALIFIED/UNQUALIFIED) → role='comercial'
    // - customer (leadStatus = CONVERTED)                              → role='suporte'
    // Fallback pro promptEngine antigo se Agent não existir (orgs sem seed).
    const systemPrompt = await buildSystemPromptForContact({
      organizationId,
      contactId,
      orgSettings,
      ragContext,
    });

    // ── 8. Build history array (sem messageContent — routeIzaTurn adiciona) ───
    const history: LLMMessage[] = historyMessages.map((msg) => ({
      role: msg.direction === 'INBOUND' ? 'user' as const : 'assistant' as const,
      content: msg.content,
    }));

    // ── 9. V4 routing: pre-filter + classify + tier-based ─────
    // V4 #V4-001 + #143 (2026-04-30): routeIzaTurn aplica defesa em camadas:
    //   1. Pre-filter regex de verticais bloqueadas (apostas/cripto/MLM/porn) —
    //      retorna template estático SEM custo LLM
    //   2. Classify intent via Haiku — escala pra Sonnet em handoff/objection/
    //      enterprise mesmo em tiers Gemini
    //   3. Tier-based default — Starter/Growth=Gemini, Scale+=Sonnet
    //   4. Cascade fallback Sonnet→Haiku→OpenAI preservado (V3)
    // Per-org override via organizations.settings.llm_routing (#133):
    //   { forceProvider: "anthropic-sonnet" | ... } → bypassa tier-based
    //   { useDefaultCascade: true }                 → cascade default (Iza)
    const { tier, forceProvider } = await pickTierAndOverride(organizationId);
    const turnResult = await routeIzaTurn({
      systemPrompt,
      userMessage: messageContent,
      history,
      tier,
      forceProvider,
      orgId: organizationId,
      conversationId,
    });

    // ── 9.5. Vertical bloqueada — template estático, sem LLM ──────
    if (turnResult.kind === 'blocked') {
      logger.info(`[Agent] Vertical bloqueada: ${turnResult.vertical}`, {
        contactPhone,
        organizationId,
        snippet: turnResult.matchedSnippet,
      });
      await waService.sendText(contactPhone, turnResult.response);
      await prisma.message.create({
        data: {
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: turnResult.response,
          status: 'SENT',
          conversationId,
          isFromBot: true,
          aiConfidence: 1.0, // resposta determinística (regex match)
        },
      });
      return;
    }

    if (turnResult.escalated) {
      logger.info(`[Agent] Intent ${turnResult.intent} → escalou pra ${turnResult.response.provider}`, {
        contactPhone,
        organizationId,
      });
    }

    // ── 10. Parse structured response ───────────────────
    const llmResponse = { text: turnResult.response.text };
    const parsed = parseAgentResponse(llmResponse.text);

    // ── 11. Execute actions ─────────────────────────────
    if (parsed.action) {
      await executeAction(organizationId, contactId, contactPhone, parsed.action, parsed.actionData, io);
    }

    // ── 12. Send reply via WhatsApp ─────────────────────
    if (parsed.replyText) {
      if (parsed.buttons && parsed.buttons.length > 0) {
        await waService.sendButtons(contactPhone, null, parsed.replyText, parsed.buttons);
      } else {
        await waService.sendText(contactPhone, parsed.replyText);
      }

      // Save outbound message
      await prisma.message.create({
        data: {
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: parsed.replyText,
          status: 'SENT',
          conversationId,
          isFromBot: true,
          aiConfidence: parsed.action ? 0.9 : 0.95,
        },
      });
    }

    // ── 13. Real-time dashboard push ────────────────────
    if (io) {
      io.to(`org:${organizationId}`).emit('new_message', {
        conversationId,
        message: {
          content: parsed.replyText,
          direction: 'OUTBOUND',
          isFromBot: true,
          createdAt: new Date().toISOString(),
        },
      });
    }

  } catch (err) {
    logger.error('[Agent] Error processing message:', err);

    // Fallback message
    await waService.sendText(
      contactPhone,
      'Olá! Estou com uma dificuldade técnica momentânea. Em breve um atendente entrará em contato. Desculpe o inconveniente! 🙏'
    ).catch(() => {});
  }
}

// ── V4 #133 + #68 · Per-org LLM routing (lê organizations.settings.llm_routing) ──
// Schema esperado em org.settings.llm_routing (todos opcionais):
//   {
//     forceProvider?: 'anthropic-sonnet' | 'anthropic-haiku' | 'openai-mini' | 'google-gemini-flash'
//        // Bypassa tier completamente. ATENÇÃO: cascade pular fallback automático
//        // quando forceProvider está setado (LLMRouter.buildChain retorna [único provider]).
//        // Use só pra Enterprise customizado ou debug.
//     tierOverride?: 'STARTER' | 'GROWTH' | 'SCALE' | 'BUSINESS' | 'ENTERPRISE'
//        // PR #68: força tier específico mesmo se org.plan for diferente.
//        // Cascade COMPLETA preservada (fallback Sonnet→Haiku→OpenAI).
//        // Caso de uso: dogfood Iza com tier de cliente real (testar Gemini).
//     useDefaultCascade?: boolean
//        // true = ignora tier, usa Sonnet primário (vitrine Iza original).
//   }
// Prioridade: forceProvider > tierOverride > useDefaultCascade > tier-based padrão (org.plan).
// Sem settings.llm_routing → fallback pra tier-based via org.plan.
// Sem org → fallback pra cascade default (Sonnet primário).
const VALID_TIERS: LLMTier[] = ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'];

async function pickTierAndOverride(orgId: string): Promise<{
  tier?: LLMTier;
  forceProvider?: LLMProviderId;
}> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true, settings: true },
    });
    if (!org) return {};

    // Per-org override (#133 + #68)
    const settings = (org.settings as any) ?? {};
    const llmRouting = settings.llm_routing;
    if (llmRouting && typeof llmRouting === 'object') {
      // 1. forceProvider (mais alta prioridade — Enterprise customizado, sem fallback)
      if (typeof llmRouting.forceProvider === 'string') {
        return { forceProvider: llmRouting.forceProvider as LLMProviderId };
      }
      // 2. tierOverride (#68 — força tier específico, cascade completa preservada)
      if (typeof llmRouting.tierOverride === 'string'
          && VALID_TIERS.includes(llmRouting.tierOverride as LLMTier)) {
        return { tier: llmRouting.tierOverride as LLMTier };
      }
      // 3. useDefaultCascade (Iza vitrine original — Sonnet primário)
      if (llmRouting.useDefaultCascade === true) {
        return {};
      }
    }

    // 4. Tier-based padrão (#V4-001) — derivado de org.plan
    if (VALID_TIERS.includes(org.plan as LLMTier)) {
      return { tier: org.plan as LLMTier };
    }
    return {};
  } catch (err: any) {
    logger.warn(`[Agent] pickTierAndOverride failed: ${err.message} — fallback default cascade`, { orgId });
    return {};
  }
}

// ── Intent Classification ───────────────────────────────
async function classifyIntent(text: string, ctx?: LLMContext): Promise<string> {
  const cacheKey = `intent:${Buffer.from(text).toString('base64').slice(0, 32)}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return cached;
  } catch {}

  // V4 #156 (2026-05-03) — calibração conservadora pra request_human.
  // Bug observado smoke test 03/05: cliente perguntou "responde por voz?"
  // (técnica) e classify retornou request_human → disparou handoff
  // indevido. Agora request_human EXIGE keyword explícita.
  const prompt = `Classify the LAST customer message into ONE intent.
Categories: scheduling | pricing | faq | complaint | purchase | request_human | greeting | followup | other

REGRA CRÍTICA pra request_human:
  Só classifique como request_human se a mensagem EXPLICITAMENTE pede falar com humano usando frases como:
  - "quero falar com gente"
  - "não quero bot"
  - "prefiro humano"
  - "humano por favor"
  - "fale com alguém aí"
  - "atendente"
  - "pessoa real"

Pergunta TÉCNICA do cliente (ex: "responde por voz?", "tem integração com X?",
"qual a diferença pra Y?", "como funciona Z?") NÃO é request_human — classifique
como faq.

Pergunta de PREÇO/PLANO (ex: "quanto custa?", "qual plano cabe pra mim?")
classifique como pricing.

Saudação simples (ex: "oi", "olá", "bom dia") classifique como greeting.

Em DÚVIDA, nunca classifique como request_human — use other ou faq.

Customer message: "${text}"

Respond with ONLY the intent word, nothing else.`;

  // V2-018: classify usa Haiku 4.5 forçado via LLMRouter (com fallback automático
  // pra cascade completa se Haiku cair). Audit por turn em llm_call_logs.
  const intent = await classify(prompt, ctx);

  try { await redis.setex(cacheKey, 300, intent); } catch {}

  return intent;
}

// ── Parse Structured Response ───────────────────────────
interface ParsedResponse {
  replyText: string | null;
  action: string | null;
  actionData: any;
  buttons: Array<{ id: string; title: string }> | null;
}

function parseAgentResponse(rawResponse: string): ParsedResponse {
  const result: ParsedResponse = { replyText: null, action: null, actionData: null, buttons: null };

  const replyMatch = rawResponse.match(/<reply>([\s\S]*?)<\/reply>/i);
  result.replyText = replyMatch ? replyMatch[1].trim() : rawResponse.trim();

  const actionMatch = rawResponse.match(/<action>(.*?)<\/action>/i);
  if (actionMatch) result.action = actionMatch[1].trim();

  const dataMatch = rawResponse.match(/<action_data>([\s\S]*?)<\/action_data>/i);
  if (dataMatch) {
    try { result.actionData = JSON.parse(dataMatch[1].trim()); } catch {}
  }

  const btnMatch = rawResponse.match(/<buttons>([\s\S]*?)<\/buttons>/i);
  if (btnMatch) {
    try { result.buttons = JSON.parse(btnMatch[1].trim()); } catch {}
  }

  return result;
}

// ── Execute Actions ─────────────────────────────────────
async function executeAction(
  organizationId: string,
  contactId: string,
  contactPhone: string,
  action: string,
  actionData: any,
  io?: SocketIOServer
): Promise<void> {
  logger.info(`[Agent] Executing action: ${action}`, { organizationId, contactPhone });

  try {
    switch (action) {
      case 'schedule':
        if (io) {
          io.to(`org:${organizationId}`).emit('notification', {
            type: 'info',
            title: 'Novo agendamento solicitado',
            message: `Cliente ${contactPhone} quer agendar`,
          });
        }
        break;

      case 'handoff':
        await handleHandoff(organizationId, contactPhone, contactId, {}, io);
        break;

      case 'save_lead':
        await prisma.contact.update({
          where: { id: contactId },
          data: { leadStatus: 'QUALIFIED', leadScore: { increment: 20 } },
        });
        if (io) {
          io.to(`org:${organizationId}`).emit('notification', {
            type: 'success',
            title: 'Lead qualificado!',
            message: `${contactPhone} foi qualificado automaticamente pela IA`,
          });
        }
        break;

      default:
        logger.warn(`[Agent] Unknown action: ${action}`);
    }
  } catch (err) {
    logger.error('[Agent] Action execution error:', err);
  }
}

// ── Handoff to Human ────────────────────────────────────
async function handleHandoff(
  organizationId: string,
  contactPhone: string,
  contactId: string,
  orgSettings: any,
  io?: SocketIOServer
): Promise<void> {
  logger.info(`[Agent] Handoff triggered for ${contactPhone}`, { organizationId });

  // Pause AI for 1 hour
  await redis.set(`ai_paused:${organizationId}:${contactPhone}`, '1', 'EX', 3600);

  // Update conversation status
  await prisma.conversation.updateMany({
    where: { contactId, organizationId, status: { in: ['OPEN', 'ASSIGNED'] } },
    data: { status: 'WAITING' },
  });

  // Notify agents
  if (io) {
    io.to(`org:${organizationId}`).emit('notification', {
      type: 'warning',
      title: 'Transbordo solicitado',
      message: `Cliente ${contactPhone} precisa de atendimento humano`,
    });
  }

  // Send holding message
  const holdMsg = orgSettings?.handoffMessage ||
    'Vou te conectar com um de nossos especialistas agora. Em instantes você será atendido! 😊';
  await waService.sendText(contactPhone, holdMsg);
}

// ── Handle Non-Text Messages ────────────────────────────
// V4 #156 (2026-05-03): emojis 🎙️ 📷 📄 🎥 📍 e tom V3 ("Como posso te
// ajudar?") removidos. Agora alinhado com REGRA 4 (anti-padrões) do
// prompt V6 da Iza. Áudio NÃO cai mais aqui — é interceptado em
// processIncomingMessage (etapa 2) e transcrito via Whisper.
async function handleNonTextMessage(phone: string, msgType: string): Promise<void> {
  const responses: Record<string, string> = {
    // audio nunca chega aqui em prod (Whisper trata antes), mas mantém fallback
    // pra caso mediaId esteja vazio ou OPENAI_API_KEY desconfigurada.
    audio: 'Não consegui processar seu áudio agora. Pode me mandar em texto?',
    image: 'Recebi sua imagem. Me conta em texto o que você precisa que eu já te ajudo.',
    document: 'Recebi seu documento. Me diz em texto o que você precisa resolver.',
    video: 'Recebi seu vídeo. Me conta em texto o que você precisa.',
    location: 'Recebi sua localização. Me diz em texto como posso ajudar.',
  };

  const reply = responses[msgType] || 'Recebi sua mensagem. Me conta em texto o que você precisa.';
  await waService.sendText(phone, reply);
}

// ═══════════════════════════════════════════════════════════════════
// V2-021 (Sprint 0 §11.3) · Persona dual via Agent table
// ─────────────────────────────────────────────────────────────────
// Decisão de persona:
//   - leadStatus in [NEW, CONTACTED, QUALIFIED, UNQUALIFIED] → comercial
//   - leadStatus = CONVERTED                                  → suporte
//
// Carrega Agent.systemPrompt do DB se existir (seedado em V2-021 migration).
// Se não existir (ex.: org criada antes da migration ou seed falhou),
// faz fallback pro promptEngine antigo — preserva back-compat.
// ═══════════════════════════════════════════════════════════════════
async function buildSystemPromptForContact(input: {
  organizationId: string;
  contactId: string;
  orgSettings: any;
  ragContext: string;
}): Promise<string> {
  const { organizationId, contactId, orgSettings, ragContext } = input;

  // 1. Decidir role baseado em leadStatus do Contact
  let role: 'comercial' | 'suporte' = 'comercial';
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { leadStatus: true },
    });
    if (contact?.leadStatus === 'CONVERTED') role = 'suporte';
  } catch (err) {
    logger.warn('[Agent] buildSystemPromptForContact: lookup contact falhou — assumindo comercial', { err });
  }

  // 2. Tentar carregar Agent live correspondente
  try {
    const agent = await prisma.agent.findFirst({
      where: { organizationId, role, status: 'live' },
      select: { systemPrompt: true, name: true },
      orderBy: { createdAt: 'desc' }, // se houver múltiplos, pega o mais recente
    });
    if (agent?.systemPrompt) {
      // Apêndices A.1/A.2 do Plano: prompts já contêm regras estruturais.
      // Só anexamos contexto dinâmico (RAG + agora).
      const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      return [
        agent.systemPrompt,
        '',
        `# Contexto recuperado (RAG)`,
        ragContext || '(sem contexto relevante encontrado para esta query)',
        '',
        `# Agora`,
        now,
      ].join('\n');
    }
  } catch (err) {
    logger.warn('[Agent] buildSystemPromptForContact: lookup agent falhou — fallback promptEngine', { err });
  }

  // 3. Fallback (orgs sem seed): promptEngine antigo
  return getSystemPrompt({
    niche: orgSettings.niche || 'generic',
    agentName: orgSettings.agentName || 'Assistente',
    businessName: orgSettings.businessName || 'Empresa',
    tone: orgSettings.tone || 'friendly',
    businessHours: orgSettings.businessHours,
    ragContext,
    currentDateTime: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
  });
}
