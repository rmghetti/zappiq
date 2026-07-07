/* ══════════════════════════════════════════════════════════════════════
 * billingCheckout.util — regras puras do POST /api/billing/checkout.
 * --------------------------------------------------------------------
 * effectiveTrialDays: o trial de 14 dias é UM por organização, concedido
 * no primeiro checkout de quem nunca testou nem pagou. Sem este filtro,
 * qualquer cliente (em trial, vencido ou até pagante fazendo downgrade)
 * ganharia um novo período grátis ao assinar o Iza Lite.
 * Fail-closed: org ausente → sem trial.
 * ══════════════════════════════════════════════════════════════════════ */

export interface TrialEligibilityOrg {
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  paidAt: Date | null;
  stripeSubscriptionId: string | null;
}

export function effectiveTrialDays(
  configuredDays: number,
  org: TrialEligibilityOrg | null
): number {
  if (configuredDays <= 0) return 0;
  if (!org) return 0;
  const alreadyTrialed = org.trialStartedAt != null || org.trialEndsAt != null;
  const alreadyPaid = org.paidAt != null || org.stripeSubscriptionId != null;
  return alreadyTrialed || alreadyPaid ? 0 : configuredDays;
}
