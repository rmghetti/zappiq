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
