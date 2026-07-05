/**
 * W3.6 (dados) — datas de fechamento quando o deal já NASCE em Ganho/Perdido.
 *
 * BUG CORRIGIDO (05/07/2026): o PUT /api/deals/:id/stage já aplicava a lógica
 * de datas ao mover um deal (won → closedAt + wonAt; lost → closedAt + lostAt),
 * mas o POST /api/deals (criação direta pelo modal) gravava só `stage` sem as
 * datas. Resultado: um deal criado direto em "Ganho"/"Perdido" ficava sem
 * wonAt/lostAt/closedAt e SUMIA das métricas de fechamento (que filtram por
 * essas datas). Este helper centraliza a MESMA regra usada nos dois lugares,
 * pra POST e PUT/stage nunca divergirem de novo.
 */

/**
 * Devolve o patch de datas de fechamento para um dado stage.
 * - stage 'won'  → { closedAt, wonAt }
 * - stage 'lost' → { closedAt, lostAt }
 * - qualquer outro → {} (nenhuma data de fechamento)
 *
 * `now` é injetável pra deixar o teste determinístico.
 */
export function closingDatesForStage(
  stage: string,
  now: Date = new Date(),
): { closedAt?: Date; wonAt?: Date; lostAt?: Date } {
  if (stage === 'won') return { closedAt: now, wonAt: now };
  if (stage === 'lost') return { closedAt: now, lostAt: now };
  return {};
}
