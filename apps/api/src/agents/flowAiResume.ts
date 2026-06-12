/**
 * ZappIQ Maestro v2 — flowAiResume
 * ============================================================================
 * Caminho LEVE de geração de resposta IA para RETOMADA POR TIMER em nó-IA.
 *
 * Por que não reusar o agentOrchestrator? processIncomingMessage é acoplado
 * ao inbound (whatsappMessageId, mark-as-read, transcrição, intent, TTS...) e
 * não exporta nenhuma função reaproveitável de "gerar resposta pra conversa".
 * Refatorá-lo pra isso seria invasivo. Este módulo monta o subset mínimo
 * viável: contexto do negócio (loadBusinessContext) + persona live (se houver)
 * + últimas mensagens da conversa + a instrução do nó-IA.
 *
 * Fail-closed: QUALQUER falha (LLM fora, prompt vazio, erro de banco) devolve
 * null — o worker mantém o comportamento antigo (warn + cursor persistido,
 * próximo inbound continua pelo orchestrator). Um timer nunca manda mensagem
 * meio-quebrada.
 *
 * Parte pura (testável sem infra): buildAiResumePrompt.
 * ============================================================================
 */
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { llmRouter, type LLMTier } from '../services/llm/LLMRouter.js';
import { loadBusinessContext } from './flowGenerator.js';

/** Mesma janela de histórico do orchestrator (últimos 20 turnos). */
export const MAX_HISTORY_MESSAGES = 20;

/** Cap defensivo da persona — mantém o prompt enxuto (caminho LEVE). */
const MAX_PERSONA_CHARS = 4000;

// Espelha VALID_TIERS do flowGenerator (não exportado lá; manter em sincronia).
const VALID_TIERS: LLMTier[] = ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'];

export interface AiResumePromptContext {
  /** Brief compacto do negócio (loadBusinessContext().brief). */
  brief: string;
  /** systemPrompt do Agent live, se disponível (subset mínimo de persona). */
  personaPrompt?: string | null;
  /** Últimas mensagens da conversa, ordem antiga → recente. */
  history: Array<{ direction: string; content: string }>;
  /** Instrução do nó-IA (o que fazer NESTA mensagem de retomada). */
  aiPrompt: string;
}

/**
 * Monta system + user pra retomada proativa. Pura — sem IO.
 * O histórico é truncado às últimas MAX_HISTORY_MESSAGES mensagens e
 * rotulado Cliente/Agente (o modelo não vê direction cru do banco).
 */
export function buildAiResumePrompt(ctx: AiResumePromptContext): { system: string; user: string } {
  const persona = (ctx.personaPrompt || '').trim().slice(0, MAX_PERSONA_CHARS);

  const system = [
    persona,
    '# Contexto do negócio',
    ctx.brief,
    '',
    '# Sua tarefa agora',
    'Você é o agente da empresa retomando proativamente a conversa no WhatsApp — o cliente NÃO acabou de mandar mensagem; é você quem está voltando ao assunto.',
    'Escreva UMA mensagem curta (máx ~500 caracteres), em pt-BR, natural e no tom da empresa, sem assinatura, sem prefixos e sem se desculpar pelo tempo passado.',
    'Siga a instrução do passo do fluxo informada pelo usuário. Devolva SOMENTE o texto da mensagem.',
  ].filter(Boolean).join('\n');

  const recent = ctx.history.slice(-MAX_HISTORY_MESSAGES);
  const historyBlock = recent.length
    ? [
        'Histórico recente da conversa (antiga → recente):',
        ...recent.map((m) => `${m.direction === 'INBOUND' ? 'Cliente' : 'Agente'}: ${m.content}`),
        '',
      ]
    : [];

  const user = [
    ...historyBlock,
    `INSTRUÇÃO DO PASSO ATUAL DO FLUXO (Maestro): ${ctx.aiPrompt}`,
    'Escreva agora a mensagem de retomada.',
  ].join('\n');

  return { system, user };
}

export interface GenerateAiResumeReplyInput {
  organizationId: string;
  conversationId: string;
  aiPrompt: string;
  /** Hint de modelo do nó (node.data.model) — reservado; roteamento real é por tier no llmRouter. */
  aiModelHint?: string;
}

/**
 * Gera o texto da resposta de retomada pra um nó-IA disparado por timer.
 * Retorna null em QUALQUER falha (fail-closed: nenhuma mensagem é enviada;
 * o worker loga e persiste o cursor — o próximo inbound continua normal).
 */
export async function generateAiResumeReply(
  input: GenerateAiResumeReplyInput,
): Promise<string | null> {
  const { organizationId, conversationId, aiPrompt } = input;

  if (!aiPrompt || !aiPrompt.trim()) {
    logger.warn('[FlowAiResume] nó-IA sem prompt — nada a gerar', { organizationId, conversationId });
    return null;
  }

  try {
    // Contexto do negócio + persona live + histórico — tudo em paralelo.
    const [ctx, agent, historyMessages] = await Promise.all([
      loadBusinessContext(organizationId),
      // Persona: Agent live mais recente da org. O orchestrator escolhe por
      // role (comercial/suporte via leadStatus); aqui, sem o lead carregado,
      // o subset mínimo viável é o live mais recente. Fail-soft → null.
      prisma.agent.findFirst({
        where: { organizationId, status: 'live' },
        select: { systemPrompt: true },
        orderBy: { createdAt: 'desc' },
      }).catch(() => null),
      prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: MAX_HISTORY_MESSAGES,
        select: { direction: true, content: true },
      }),
    ]);

    // findMany desc + reverse → antiga → recente (ordem que o modelo lê).
    const history = historyMessages.reverse().map((m) => ({
      direction: m.direction,
      content: m.content,
    }));

    const { system, user } = buildAiResumePrompt({
      brief: ctx.brief,
      personaPrompt: agent?.systemPrompt ?? null,
      history,
      aiPrompt,
    });

    const tier = VALID_TIERS.includes(ctx.plan as LLMTier) ? (ctx.plan as LLMTier) : undefined;
    const resp = await llmRouter.complete({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 300,
      temperature: 0.6,
      tier,
      orgId: organizationId,
      conversationId,
      operation: 'chat',
    });

    const text = (resp.text || '').trim();
    if (!text) {
      logger.warn('[FlowAiResume] LLM devolveu texto vazio — fail-closed', { organizationId, conversationId });
      return null;
    }
    return text;
  } catch (e) {
    // LLM fora / banco fora / qualquer erro → null (fail-closed, sem mensagem).
    logger.warn('[FlowAiResume] geração falhou — fail-closed, nenhuma mensagem enviada', {
      organizationId, conversationId, err: String(e),
    });
    return null;
  }
}
