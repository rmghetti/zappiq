/**
 * FEATURE 5a.1 — handoff humano ↔ IA (lógica pura, sem I/O).
 *
 * As rotas de conversas (assign / reopen / resume-ai) precisam decidir
 * quais campos gravar e como espelhar o estado de pausa da IA no cache
 * (`ai_paused:<org>:<phone>`, fast-path que orchestrator e flowScheduler
 * consultam). Toda essa decisão fica aqui, testável sem banco/redis.
 *
 * Fonte de verdade durável: `conversation.aiPaused`. O cache é só espelho.
 */

/** Chave de cache que espelha a pausa da IA por contato. */
export function aiPauseCacheKey(organizationId: string, contactPhone: string): string {
  return `ai_paused:${organizationId}:${contactPhone}`;
}

/** Valor gravado no cache quando um humano está no atendimento. */
export const AI_PAUSE_HUMAN_VALUE = 'human';
/** TTL (segundos) do espelho de pausa — 7 dias, igual ao assign/messages. */
export const AI_PAUSE_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface HandoffTransition {
  /** Campos a gravar no update do Prisma. */
  data: {
    assignedToId?: string | null;
    status?: 'OPEN' | 'WAITING' | 'ASSIGNED' | 'CLOSED';
    aiPaused?: boolean;
    closedAt?: Date | null;
  };
  /** Efeito no cache: 'pause' grava human, 'resume' remove a chave, 'none' não mexe. */
  cacheEffect: 'pause' | 'resume' | 'none';
}

/**
 * ASSUMIR — atribui a conversa a um humano e PAUSA a IA.
 * `agentId` vazio/nulo devolve o atendimento à IA (despausa e desatribui).
 */
export function planAssign(agentId: string | null | undefined): HandoffTransition {
  const assignedToHuman = !!agentId;
  return {
    data: {
      assignedToId: agentId || null,
      status: assignedToHuman ? 'ASSIGNED' : 'OPEN',
      aiPaused: assignedToHuman,
    },
    cacheEffect: assignedToHuman ? 'pause' : 'resume',
  };
}

/**
 * REABRIR — volta uma conversa fechada para atendimento.
 * Se ainda houver humano atribuído, mantém ASSIGNED + IA pausada;
 * caso contrário reabre como OPEN sem mexer na pausa (deixa a IA seguir).
 */
export function planReopen(assignedToId: string | null | undefined): HandoffTransition {
  const hasHuman = !!assignedToId;
  return {
    data: {
      status: hasHuman ? 'ASSIGNED' : 'OPEN',
      closedAt: null,
    },
    cacheEffect: 'none',
  };
}

/**
 * RETOMAR IZA — despausa a IA nesta conversa (aiPaused=false) e limpa o
 * espelho de pausa no cache. Mantém a atribuição atual (o humano pode
 * continuar acompanhando), mas se a conversa estava ASSIGNED sem estar
 * fechada, reabre para OPEN para a IA voltar a responder.
 */
export function planResumeAi(status: string): HandoffTransition {
  return {
    data: {
      aiPaused: false,
      // Só reabre se estava em atendimento humano; nunca "desfecha" uma CLOSED.
      ...(status === 'ASSIGNED' ? { status: 'OPEN' as const } : {}),
    },
    cacheEffect: 'resume',
  };
}

/** Deve exibir o indicador "IA pausada / atendimento humano"? */
export function isHumanHandoffActive(conv: { aiPaused?: boolean; status?: string }): boolean {
  return conv.aiPaused === true || conv.status === 'ASSIGNED';
}
