/**
 * billingSubscription.util.ts — FEATURE 5b.1 (Estado REAL da assinatura)
 * ============================================================================
 * ANTES: apps/web/.../billing/page.tsx nao mostrava nenhum estado real da
 * assinatura (status, ciclo, trial, proxima/ultima fatura). So listava planos.
 *
 * AGORA: buildSubscriptionState monta o payload consumido por
 * GET /api/billing/subscription a partir das colunas que JA existem na
 * Organization (subscriptionStatus, billingCycle, trialEndsAt, paidAt,
 * stripeCustomerId, stripeSubscriptionId, plan) + as faturas persistidas na
 * tabela stripe_invoices (StripeInvoice).
 *
 * ESTADOS HONESTOS (a maioria das orgs ainda nao tem Stripe):
 *   - 'no_subscription': sem stripeSubscriptionId e sem status pago/trial.
 *                        Nao inventa nada — a UI mostra "sem assinatura".
 *   - 'trialing'       : status 'trialing' OU (sem status mas com trialEndsAt
 *                        no futuro). trialDaysLeft/trialEndsAt preenchidos.
 *   - 'active' | 'past_due' | 'canceled': espelham subscriptionStatus.
 *
 * lastInvoice = fatura paga mais recente (maior paidAt) das stripe_invoices.
 * nextInvoice = so quando ha assinatura ativa/trial: NAO temos o valor futuro
 *   real do Stripe aqui (isso viria de invoice.upcoming via webhook/API), entao
 *   expomos apenas a data estimada da proxima cobranca quando derivavel do
 *   trialEndsAt (fim do trial = 1a cobranca). Sem data derivavel -> nextInvoice
 *   fica undefined (honesto, nao inventa valor).
 *
 * Funcao pura + dados injetados -> testavel sem DB.
 * ============================================================================
 */

/** Status canonico da assinatura exposto pela API/UI. */
export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'trialing'
  | 'no_subscription';

export type SubscriptionCycle = 'monthly' | 'annual' | null;

/** Fatura ja persistida em stripe_invoices (subset consumido aqui). */
export interface InvoiceInput {
  amountBrlCents: number;
  status: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  paidAt: Date | null;
}

/** Fatura formatada pra UI. */
export interface InvoiceView {
  amountBrlCents: number;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
}

/** Proxima cobranca — so a data (valor futuro real nao vive no banco). */
export interface NextInvoiceView {
  /** ISO da data estimada da proxima cobranca (fim do trial). */
  dueAt: string;
}

/** Estado da org relevante pra assinatura (subset das colunas da Organization). */
export interface OrgSubscriptionInput {
  plan: string | null | undefined;
  subscriptionStatus: string | null | undefined;
  billingCycle: string | null | undefined;
  trialEndsAt: Date | null | undefined;
  paidAt: Date | null | undefined;
  stripeCustomerId: string | null | undefined;
  stripeSubscriptionId: string | null | undefined;
}

export interface SubscriptionState {
  status: SubscriptionStatus;
  /** true quando ha stripeSubscriptionId (conta pagante real no Stripe). */
  hasStripeSubscription: boolean;
  cycle: SubscriptionCycle;
  plan: string;
  trialEndsAt: string | null;
  /** Dias inteiros restantes de trial (>=0). null quando nao esta em trial. */
  trialDaysLeft: number | null;
  nextInvoice?: NextInvoiceView;
  lastInvoice?: InvoiceView;
}

const VALID_CYCLES = new Set(['monthly', 'annual']);

/** Normaliza billingCycle -> 'monthly' | 'annual' | null (nunca inventa). */
export function normalizeCycle(raw: string | null | undefined): SubscriptionCycle {
  if (typeof raw === 'string' && VALID_CYCLES.has(raw)) return raw as SubscriptionCycle;
  return null;
}

/** Dias inteiros restantes ate `end` a partir de `now`, com piso 0. */
export function daysLeft(end: Date | null | undefined, now: Date): number | null {
  if (!end) return null;
  const ms = end.getTime() - now.getTime();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

const iso = (d: Date | null | undefined): string | null =>
  d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;

/**
 * Deriva o status canonico a partir das colunas reais, sem inventar.
 * Precedencia:
 *   1. subscriptionStatus explicito (active|past_due|canceled|trialing) manda.
 *   2. Sem status mas com trialEndsAt no futuro -> 'trialing' (org em trial
 *      pre-Stripe, o caso comum hoje).
 *   3. Sem status e sem trial valido -> 'no_subscription'.
 */
export function deriveStatus(
  org: OrgSubscriptionInput,
  now: Date,
): SubscriptionStatus {
  const raw = (org.subscriptionStatus ?? '').toLowerCase();
  if (raw === 'active' || raw === 'past_due' || raw === 'canceled' || raw === 'trialing') {
    return raw as SubscriptionStatus;
  }
  const tLeft = daysLeft(org.trialEndsAt ?? null, now);
  if (tLeft !== null && tLeft > 0) return 'trialing';
  return 'no_subscription';
}

function toInvoiceView(inv: InvoiceInput): InvoiceView {
  return {
    amountBrlCents: inv.amountBrlCents,
    status: inv.status,
    periodStart: iso(inv.periodStart),
    periodEnd: iso(inv.periodEnd),
    paidAt: iso(inv.paidAt),
  };
}

export interface BuildSubscriptionStateInput {
  org: OrgSubscriptionInput;
  /** Fatura paga mais recente (maior paidAt) das stripe_invoices, ou null. */
  lastInvoice: InvoiceInput | null;
  now?: Date;
}

/**
 * Monta o estado real da assinatura pra tela de billing.
 * Pura: recebe org + ultima fatura ja resolvidos do banco.
 */
export function buildSubscriptionState(input: BuildSubscriptionStateInput): SubscriptionState {
  const now = input.now ?? new Date();
  const { org } = input;

  const status = deriveStatus(org, now);
  const cycle = normalizeCycle(org.billingCycle);
  const hasStripeSubscription = Boolean(org.stripeSubscriptionId);

  const isTrial = status === 'trialing';
  const trialDaysLeftVal = isTrial ? daysLeft(org.trialEndsAt ?? null, now) : null;

  const state: SubscriptionState = {
    status,
    hasStripeSubscription,
    cycle,
    plan: org.plan ?? 'IZA_LITE',
    trialEndsAt: isTrial ? iso(org.trialEndsAt ?? null) : null,
    trialDaysLeft: trialDaysLeftVal,
  };

  if (input.lastInvoice) {
    state.lastInvoice = toInvoiceView(input.lastInvoice);
  }

  // nextInvoice: so a DATA, e so quando derivavel honestamente.
  // Em trial, a 1a cobranca cai no fim do trial (trialEndsAt).
  // Sem valor futuro real do Stripe, nao expomos amount aqui.
  if (isTrial) {
    const dueAt = iso(org.trialEndsAt ?? null);
    if (dueAt) state.nextInvoice = { dueAt };
  }

  return state;
}
