/* ══════════════════════════════════════════════════════════════════════
 * billingCheckoutConfirm.util — lógica PURA da confirmação síncrona do
 * retorno do Stripe Checkout (POST /api/billing/checkout/confirm).
 * --------------------------------------------------------------------
 * O success_url do Stripe volta pro app com ?session_id=. Em vez de
 * depender só do webhook assíncrono, a página /billing/success chama o
 * endpoint de confirm, que materializa o estado da assinatura na org na
 * hora — idempotente e usando EXATAMENTE os mesmos building-blocks do
 * webhook (stripeWebhook.util), então os dois caminhos convergem pro
 * mesmo estado. Sem e-mail/MRR/CRM aqui: o webhook (fonte da verdade)
 * cuida disso; o confirm só precisa deixar a org reconhecível como ATIVA
 * pro cliente cair no painel sem 404 e sem espera.
 * ══════════════════════════════════════════════════════════════════════ */

import type Stripe from 'stripe';
import {
  resolvePlanFromPriceId,
  planToOrgEnum,
  normalizeSubscriptionStatus,
  mergeSettings,
} from './stripeWebhook.util.js';

export interface ConfirmBeforeState {
  settings: unknown;
  paidAt: Date | string | null;
  isTrialActive: boolean | null;
  trialConverted: boolean | null;
}

/** priceId do 1º item da assinatura (Stripe 17.x). */
export function priceIdFromSubscription(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  return (item?.price?.id as string | undefined) ?? null;
}

/**
 * true quando a checkout session já está liquidada: paga, sem cobrança
 * (ex.: cupom 100%) ou marcada como concluída pelo Stripe.
 */
export function isCheckoutSettled(
  session: Pick<Stripe.Checkout.Session, 'status' | 'payment_status'>,
): boolean {
  return (
    session.status === 'complete' ||
    session.payment_status === 'paid' ||
    session.payment_status === 'no_payment_required'
  );
}

/**
 * Computa o patch de colunas da Organization a partir da subscription do
 * checkout — MESMA regra do applySubscriptionState do webhook, sem os efeitos
 * colaterais (e-mail/MRR/CRM). Pura e testável.
 */
export function computeConfirmUpdate(
  sub: Stripe.Subscription,
  before: ConfirmBeforeState,
  now: Date = new Date(),
): { data: Record<string, unknown>; status: string | null; becameActive: boolean } {
  const status = normalizeSubscriptionStatus(sub.status);
  const priceId = priceIdFromSubscription(sub);
  const resolved = resolvePlanFromPriceId(priceId);
  const planEnum = resolved ? planToOrgEnum(resolved.plan) : null;
  const stripeCustomerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;

  const settings = mergeSettings(before.settings, {
    stripeCustomerId: stripeCustomerId ?? undefined,
    stripeSubscriptionId: sub.id,
  });

  const data: Record<string, unknown> = {
    subscriptionStatus: status,
    billingCycle: resolved?.billingCycle ?? undefined,
    stripeCustomerId: stripeCustomerId ?? undefined,
    stripeSubscriptionId: sub.id,
    settings,
  };
  if (planEnum) data.plan = planEnum;

  // 1º pagamento confirmado: MESMA regra EXATA do webhook (status === 'active',
  // não 'trialing') pra os dois caminhos convergirem pro mesmo estado. Um plano
  // com trial Stripe ('trialing') ainda vira ACTIVE no lifecycle (tem
  // stripeSubscriptionId), mas sem marcar paidAt/converted.
  let becameActive = false;
  if (status === 'active' && before.paidAt == null) {
    data.paidAt = now;
    data.isTrialActive = false;
    data.trialConverted = true;
    becameActive = true;
  }

  return { data, status, becameActive };
}
