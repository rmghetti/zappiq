/* ══════════════════════════════════════════════════════════════════════
 * planChange.util — regra PURA de classificação de troca de plano.
 * --------------------------------------------------------------------
 * Decide, a partir de {plano, ciclo} atual e alvo, se a troca é upgrade
 * (imediato, cobra diferença) ou downgrade (agendado), e QUANDO vale.
 *
 * Política travada com o CEO:
 *  - Upgrade (mensal/anual): imediato, cobra a diferença proporcional.
 *  - Downgrade mensal: vale na virada do ciclo, sem reembolso.
 *  - Downgrade anual: bloqueado no meio do contrato; só na renovação.
 *  - Tier é o eixo dominante; mensal→anual é upgrade; Enterprise = vendas.
 *
 * Função pura e determinística — sem Stripe, sem I/O. A mecânica (invoice
 * preview, subscription schedule) mora no route; aqui só a decisão.
 * ══════════════════════════════════════════════════════════════════════ */

export type PlanTier = 'IZA_LITE' | 'GROWTH' | 'SCALE' | 'ENTERPRISE';
export type BillingCycle = 'monthly' | 'annual';

export interface PlanSelection {
  plan: PlanTier;
  cycle: BillingCycle;
}

export type PlanChangeKind =
  | 'noop' // mesmo plano+ciclo
  | 'upgrade' // sobe tier, ou mensal→anual: imediato, cobra diferença
  | 'downgrade' // desce tier no mensal: agenda p/ fim do ciclo
  | 'downgrade_annual_locked' // desce/mensaliza no anual: só na renovação
  | 'contact_sales'; // alvo Enterprise: sob consulta

export type EffectiveTiming = 'immediate' | 'period_end' | 'renewal' | 'none';

export interface PlanChangeClassification {
  kind: PlanChangeKind;
  effectiveTiming: EffectiveTiming;
}

// Ranking de tier — eixo dominante da decisão.
const TIER_RANK: Record<PlanTier, number> = {
  IZA_LITE: 1,
  GROWTH: 2,
  SCALE: 3,
  ENTERPRISE: 4,
};

/**
 * Classifica a troca de `current` para `target`. Pura.
 *
 * Ordem de decisão:
 *  1. Enterprise como alvo → contact_sales (sob consulta, sem self-serve).
 *  2. Mesmo plano E mesmo ciclo → noop.
 *  3. Tier alvo > tier atual → upgrade (imediato), qualquer ciclo.
 *  4. Mesmo tier, mensal → anual → upgrade (imediato).
 *  5. Redução (tier menor OU anual→mensal):
 *       - cliente anual → downgrade_annual_locked (renovação).
 *       - cliente mensal → downgrade (fim do ciclo).
 */
export function classifyPlanChange(
  current: PlanSelection,
  target: PlanSelection
): PlanChangeClassification {
  if (target.plan === 'ENTERPRISE') {
    return { kind: 'contact_sales', effectiveTiming: 'none' };
  }

  const sameTier = current.plan === target.plan;
  if (sameTier && current.cycle === target.cycle) {
    return { kind: 'noop', effectiveTiming: 'none' };
  }

  const curRank = TIER_RANK[current.plan];
  const tgtRank = TIER_RANK[target.plan];

  // Upgrade de tier — imediato, independente do ciclo.
  if (tgtRank > curRank) {
    return { kind: 'upgrade', effectiveTiming: 'immediate' };
  }

  // Mesmo tier trocando de ciclo.
  if (sameTier) {
    // mensal → anual = upgrade (maior compromisso, cobra anual proporcional).
    if (current.cycle === 'monthly' && target.cycle === 'annual') {
      return { kind: 'upgrade', effectiveTiming: 'immediate' };
    }
    // anual → mensal = downgrade de compromisso: cliente anual só na renovação.
    return { kind: 'downgrade_annual_locked', effectiveTiming: 'renewal' };
  }

  // Aqui é redução de tier (tgtRank < curRank). O eixo é o compromisso atual:
  // quem está no anual não reduz no meio do contrato.
  if (current.cycle === 'annual') {
    return { kind: 'downgrade_annual_locked', effectiveTiming: 'renewal' };
  }
  return { kind: 'downgrade', effectiveTiming: 'period_end' };
}

/** True quando a troca cobra algo agora (só upgrade). */
export function isImmediateCharge(c: PlanChangeClassification): boolean {
  return c.kind === 'upgrade';
}

/** True quando a troca é apenas agendada (nenhuma cobrança imediata). */
export function isScheduled(c: PlanChangeClassification): boolean {
  return c.kind === 'downgrade' || c.kind === 'downgrade_annual_locked';
}
