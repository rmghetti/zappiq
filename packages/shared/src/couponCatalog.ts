/* ══════════════════════════════════════════════════════════════════════
 * couponCatalog — produtos que podem receber cupom (planos + addons).
 * --------------------------------------------------------------------
 * Um cupom é RESTRITO a um Stripe Product (applies_to.products). Aqui
 * listamos os produtos elegíveis, cada um com seu productId real (que é o
 * que o coupon.applies_to.products espera — NÃO é priceId).
 * Enterprise fica de fora (sob consulta, sem Product/Price no Stripe).
 * ══════════════════════════════════════════════════════════════════════ */
import { STRIPE_V4_PRICES } from './planStripeIds';
import { ADDONS_V4_STRIPE } from './addonStripeIds';
import { ADDONS_V4_LIST } from './planConfig.js';

export interface CouponableProduct {
  /** Key lógica (GROWTH, AGENT_SEAT, IMPULSO_PRO…). */
  key: string;
  label: string;
  /** Stripe Product ID (prod_…) — o que o applies_to.products usa. */
  productId: string;
  type: 'plan' | 'addon';
}

const PLAN_LABELS: Record<string, string> = {
  IZA_LITE: 'Plano Iza Lite',
  GROWTH: 'Plano Growth',
  SCALE: 'Plano Scale',
};

/** Todos os produtos elegíveis a cupom: planos V4 + addons (com productId). */
export function listCouponableProducts(): CouponableProduct[] {
  const plans: CouponableProduct[] = Object.entries(STRIPE_V4_PRICES).map(([key, cfg]) => ({
    key,
    label: PLAN_LABELS[key] ?? `Plano ${key}`,
    productId: cfg.productId,
    type: 'plan' as const,
  }));

  // Só addons RECORRENTES (assinatura). Overage unitário (AI_MSG) e packs
  // one-shot (BROADCAST) não são line items de assinatura — um cupom escopado
  // neles nunca aplicaria num checkout de plano. Impulso é recurring → entra.
  const addonLabel = new Map(ADDONS_V4_LIST.map((a) => [a.key, a.name]));
  const recurringKeys = new Set(
    ADDONS_V4_LIST.filter((a) => a.pricingMode === 'recurring_monthly').map((a) => a.key),
  );
  const addons: CouponableProduct[] = Object.entries(
    ADDONS_V4_STRIPE as Record<string, { productId?: string }>,
  )
    .filter(([key, cfg]) => typeof cfg.productId === 'string' && recurringKeys.has(key))
    .map(([key, cfg]) => ({
      key,
      label: addonLabel.get(key) ?? key,
      productId: cfg.productId as string,
      type: 'addon' as const,
    }));

  return [...plans, ...addons];
}

/** Acha o produto elegível pelo productId. null se não for um produto conhecido. */
export function findCouponableProduct(productId: string | null | undefined): CouponableProduct | null {
  if (!productId) return null;
  return listCouponableProducts().find((p) => p.productId === productId) ?? null;
}
