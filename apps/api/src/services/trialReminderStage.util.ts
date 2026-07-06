/**
 * Decisão pura da cadência de lembretes de trial (T-3/T-2/T-1/T-0).
 * Isolada num util sem side-effects (o serviço cria filas BullMQ no topo do
 * módulo), para poder testar a regra sem tocar Redis/DB.
 */
export type TrialReminderStage = 'T0' | 'T1' | 'T2' | 'T3';

export interface TrialReminderSent {
  T0: boolean;
  T1: boolean;
  T2: boolean;
  T3: boolean;
}

/**
 * Mapeia quantos dias faltam (dtl) para o lembrete daquele dia e retorna-o se
 * ainda não foi enviado — senão null. Mapeamento por TIER, não cascata:
 *
 * - dtl ≥ 4 → null (ainda cedo)
 * - dtl 3 → T3 · dtl 2 → T2 · dtl 1 → T1 · dtl ≤ 0 → T0
 *
 * Em dias pulados (ex.: dtl vai de 3 direto para 1) mandamos o lembrete do dia
 * ATUAL (T1) e simplesmente PULAMOS os tiers perdidos — nunca um "faltam 3 dias"
 * obsoleto quando na verdade falta 1. Nunca duplica (respeita `sent`).
 */
export function pickTrialReminderStage(
  dtl: number,
  sent: TrialReminderSent,
): TrialReminderStage | null {
  let stage: TrialReminderStage | null = null;
  if (dtl <= 0) stage = 'T0';
  else if (dtl === 1) stage = 'T1';
  else if (dtl === 2) stage = 'T2';
  else if (dtl === 3) stage = 'T3';
  else return null; // dtl >= 4 — ainda cedo
  return sent[stage] ? null : stage;
}
