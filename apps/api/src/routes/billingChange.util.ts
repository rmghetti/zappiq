/* ══════════════════════════════════════════════════════════════════════
 * billingChange.util — helpers PUROS dos endpoints de troca de plano.
 * --------------------------------------------------------------------
 * priceId por seleção, resolução do plano/ciclo ATUAL a partir do price da
 * subscription (com fallback pro enum da org), e leitura robusta do fim do
 * período (na API Basil o current_period_end vive no item, não na sub).
 * Sem I/O — a mecânica Stripe fica no route.
 * ══════════════════════════════════════════════════════════════════════ */

import { STRIPE_V4_PRICES } from '@zappiq/shared';
import { resolvePlanFromPriceId } from './stripeWebhook.util.js';
import type { PlanSelection, PlanTier, BillingCycle } from '../services/planChange.util.js';

const V4_TIERS: PlanTier[] = ['IZA_LITE', 'GROWTH', 'SCALE'];

/** Plano V4 com price no Stripe? (ENTERPRISE é sob consulta — sem price.) */
export function isPricedTier(plan: unknown): plan is 'IZA_LITE' | 'GROWTH' | 'SCALE' {
  return typeof plan === 'string' && (V4_TIERS as string[]).includes(plan);
}

/** É um dos 4 tiers válidos (inclui ENTERPRISE, que não tem price). */
export function isPlanTier(plan: unknown): plan is PlanTier {
  return isPricedTier(plan) || plan === 'ENTERPRISE';
}

export function isBillingCycle(c: unknown): c is BillingCycle {
  return c === 'monthly' || c === 'annual';
}

/** priceId Stripe para {plano, ciclo}. null p/ ENTERPRISE (sem price). */
export function priceIdForSelection(plan: PlanTier, cycle: BillingCycle): string | null {
  if (!isPricedTier(plan)) return null;
  return STRIPE_V4_PRICES[plan][cycle];
}

/** Enum do banco (STARTER etc.) → tier lógico V4. STARTER/legado → IZA_LITE. */
export function orgEnumToTier(planEnum: string | null | undefined): PlanTier {
  const up = (planEnum ?? '').toUpperCase();
  if (up === 'GROWTH') return 'GROWTH';
  if (up === 'SCALE' || up === 'BUSINESS') return 'SCALE';
  if (up === 'ENTERPRISE') return 'ENTERPRISE';
  return 'IZA_LITE'; // STARTER (=IZA_LITE) e qualquer coisa desconhecida
}

/**
 * Seleção ATUAL: preferimos o price real da subscription (fonte da verdade);
 * se o price não for conhecido, caímos no enum + billingCycle da org.
 */
export function resolveCurrentSelection(args: {
  subscriptionPriceId?: string | null;
  orgPlanEnum?: string | null;
  orgBillingCycle?: string | null;
}): PlanSelection {
  const fromPrice = resolvePlanFromPriceId(args.subscriptionPriceId);
  if (fromPrice && isPlanTier(fromPrice.plan)) {
    return { plan: fromPrice.plan as PlanTier, cycle: fromPrice.billingCycle };
  }
  const cycle: BillingCycle = args.orgBillingCycle === 'annual' ? 'annual' : 'monthly';
  return { plan: orgEnumToTier(args.orgPlanEnum), cycle };
}

/**
 * Acha o item de PLANO da subscription (o preço que resolve pra um tier V4),
 * ignorando itens de add-on. Fallback: o primeiro item. Assim upgrade/downgrade
 * trocam só o plano e PRESERVAM os add-ons do cliente.
 */
export function findPlanItem<T extends { price?: { id?: string | null } | null }>(
  items: T[] | undefined,
): T | null {
  if (!items || items.length === 0) return null;
  const planItem = items.find((it) => resolvePlanFromPriceId(it.price?.id) !== null);
  return planItem ?? items[0];
}

// ── Guardrail do acesso à troca de plano (pura) ────────────────────────────
// Só org com assinatura ATIVA real troca de plano; o resto vai pro checkout.
export type SubGuardCode = 'ok' | 'stripe_unconfigured' | 'no_active_subscription' | 'no_item';

const ACTIVE_SUB_STATUSES = new Set(['active', 'trialing', 'past_due']);

/**
 * Decide o guard a partir dos fatos crus. Chamado 2x pelo route: antes de
 * buscar a subscription (só config + subId) e depois (com status + item).
 * Campos `undefined` = "ainda não sei" → não reprova por eles.
 */
export function subscriptionGuard(input: {
  stripeConfigured: boolean;
  stripeSubscriptionId?: string | null;
  subStatus?: string | null;
  hasPlanItem?: boolean;
}): SubGuardCode {
  if (!input.stripeConfigured) return 'stripe_unconfigured';
  if (!input.stripeSubscriptionId) return 'no_active_subscription';
  if (input.subStatus !== undefined) {
    const s = (input.subStatus ?? '').toLowerCase();
    if (!ACTIVE_SUB_STATUSES.has(s)) return 'no_active_subscription';
  }
  if (input.hasPlanItem === false) return 'no_item';
  return 'ok';
}

/** Código do guard → resposta HTTP (status + body). Pura. */
export function guardResponse(code: SubGuardCode): { status: number; body: Record<string, unknown> } {
  switch (code) {
    case 'stripe_unconfigured':
      return { status: 503, body: { error: 'Stripe não configurado' } };
    case 'no_active_subscription':
      return { status: 409, body: { error: 'no_active_subscription', action: 'checkout' } };
    case 'no_item':
      return { status: 422, body: { error: 'subscription_without_item' } };
    case 'ok':
      return { status: 200, body: {} };
  }
}

type RawPhaseItem = { price: string | { id?: string | null } | null; quantity?: number | null };
type SchedulePhaseItem = { price: string; quantity: number };
type SchedulePhase = { items: SchedulePhaseItem[]; start_date?: number; end_date?: number };

function normalizePrice(p: RawPhaseItem['price']): string | null {
  return typeof p === 'string' ? p : (p?.id ?? null);
}

/**
 * Monta as 2 fases do Subscription Schedule pra um downgrade agendado,
 * PRESERVANDO todos os itens atuais (plano + add-ons) e trocando só o item do
 * plano pelo novo preço na fase 2. Pura — o route só passa os dados do Stripe.
 *
 * - fase 0: itens atuais (até o boundary).
 * - fase 1: mesmos itens com o preço do plano trocado; se nenhum item batia o
 *   plano atual (edge), garante o novo preço presente.
 * - fallback: sem itens conhecidos, usa só o item do plano.
 */
export function buildDowngradeSchedulePhases(input: {
  phase0Items: RawPhaseItem[];
  currentPlanPriceId: string | null;
  newPriceId: string;
  startDate?: number | null;
  boundary?: number | null;
}): SchedulePhase[] {
  const normalized: SchedulePhaseItem[] = (input.phase0Items ?? [])
    .map((it) => ({ price: normalizePrice(it.price), quantity: it.quantity ?? 1 }))
    .filter((it): it is SchedulePhaseItem => typeof it.price === 'string' && it.price.length > 0);

  const baseItems: SchedulePhaseItem[] =
    normalized.length > 0
      ? normalized
      : [{ price: input.currentPlanPriceId ?? input.newPriceId, quantity: 1 }];

  const nextItems: SchedulePhaseItem[] = baseItems.map((it) =>
    it.price === input.currentPlanPriceId ? { ...it, price: input.newPriceId } : it,
  );
  if (!nextItems.some((it) => it.price === input.newPriceId)) {
    nextItems.push({ price: input.newPriceId, quantity: 1 });
  }

  const phase0: SchedulePhase = { items: baseItems };
  if (input.startDate != null) phase0.start_date = input.startDate;
  if (input.boundary != null) phase0.end_date = input.boundary;

  const phase1: SchedulePhase = { items: nextItems };
  if (input.boundary != null) phase1.start_date = input.boundary;

  return [phase0, phase1];
}

/**
 * Fim do período atual em ms epoch. Na API Basil (Stripe 17.x) o
 * current_period_end migrou pro item da subscription; mantemos fallback pro
 * nível da subscription (versões antigas) e pro topo do preview de fatura.
 */
export function currentPeriodEndMs(sub: {
  current_period_end?: number | null;
  items?: { data?: Array<{ current_period_end?: number | null }> };
}): number | null {
  const itemEnd = sub.items?.data?.[0]?.current_period_end;
  const epoch = (typeof itemEnd === 'number' ? itemEnd : null) ?? sub.current_period_end ?? null;
  return epoch != null && Number.isFinite(epoch) ? epoch * 1000 : null;
}
