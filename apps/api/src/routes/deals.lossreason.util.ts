/**
 * Normalização do motivo de perda (LossReason) do CRM.
 *
 * BUG CORRIGIDO (05/07/2026): o enum LossReason no schema/DB é UPPERCASE
 * (PRICE, COMPETITOR, TIMING, NO_DECISION, NO_BUDGET, NO_RESPONSE, OTHER), mas
 * o front (LossReasonModal) e o backend (deals.ts) mandavam/validavam valores
 * em minúsculo e ainda incluíam 'not_qualified' — que NÃO existe no enum.
 * Resultado: todo arraste para "Perdido" com motivo gravava um valor inválido,
 * o Postgres rejeitava ("invalid input value for enum LossReason"), a rota
 * dava 500 e o card voltava (rollback otimista) — "confirmei mas não atualizou".
 *
 * Correção com defesa em profundidade: aceita o valor em qualquer caixa,
 * mapeia o alias legado morto, e só grava se for um valor REAL do enum;
 * qualquer coisa inválida vira null (o move pra 'Perdido' acontece do mesmo
 * jeito, só não grava motivo — nunca mais quebra).
 */

// Valores canônicos do enum LossReason (idênticos ao schema.prisma / Postgres).
export const LOSS_REASONS = [
  'PRICE',
  'COMPETITOR',
  'TIMING',
  'NO_DECISION',
  'NO_BUDGET',
  'NO_RESPONSE',
  'OTHER',
] as const;

export type LossReasonValue = (typeof LOSS_REASONS)[number];

// Aliases de valores legados que o front antigo pode mandar e que não existem
// mais no enum → mapeados para o mais próximo (preserva o motivo em vez de perdê-lo).
const LOSS_REASON_ALIASES: Record<string, LossReasonValue> = {
  NOT_QUALIFIED: 'OTHER',
};

/**
 * Devolve um valor válido do enum LossReason, ou null.
 * Só considera motivo quando o estágio é 'lost'.
 */
export function normalizeLossReason(stage: string, raw: unknown): LossReasonValue | null {
  if (stage !== 'lost' || raw == null || raw === '') return null;
  const upper = String(raw).trim().toUpperCase();
  const mapped = LOSS_REASON_ALIASES[upper] ?? upper;
  return (LOSS_REASONS as readonly string[]).includes(mapped)
    ? (mapped as LossReasonValue)
    : null;
}
