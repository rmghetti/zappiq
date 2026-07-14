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
import { ADDONS_V4_LIST, PLAN_CONFIG } from './planConfig.js';

export interface CouponableProduct {
  /** Key lógica (GROWTH, AGENT_SEAT, IMPULSO_PRO…). */
  key: string;
  label: string;
  /** Stripe Product ID (prod_…) — o que o applies_to.products usa. */
  productId: string;
  type: 'plan' | 'addon';
  /** Família comercial do add-on (IMPULSO, CAPACITY, CHANNEL…). Ausente em planos. */
  family?: string;
  /** Preço mensal em BRL (null = sob consulta). Exibido na página de cupons. */
  monthlyBrl?: number | null;
}

const PLAN_LABELS: Record<string, string> = {
  IZA_LITE: 'Plano Iza Lite',
  GROWTH: 'Plano Growth',
  SCALE: 'Plano Scale',
};

// Rótulos curtos e limpos (sem travessão) dos planos do Zap Impulso pra página
// de cupons. Os nomes canônicos em ADDONS_V4_LIST trazem um sufixo descritivo
// com "—" que não usamos na UI voltada ao operador.
const IMPULSO_LABELS: Record<string, string> = {
  IMPULSO_START: 'Zap Impulso Start',
  IMPULSO_PRO: 'Zap Impulso Pro',
  IMPULSO_SCALE: 'Zap Impulso Scale',
};

/** Todos os produtos elegíveis a cupom: planos V4 + addons (com productId). */
export function listCouponableProducts(): CouponableProduct[] {
  const plans: CouponableProduct[] = Object.entries(STRIPE_V4_PRICES).map(([key, cfg]) => ({
    key,
    label: PLAN_LABELS[key] ?? `Plano ${key}`,
    productId: cfg.productId,
    type: 'plan' as const,
    monthlyBrl: PLAN_CONFIG[key as keyof typeof PLAN_CONFIG]?.priceMonthly ?? null,
  }));

  // Só addons RECORRENTES (assinatura). Overage unitário (AI_MSG) e packs
  // one-shot (BROADCAST) não são line items de assinatura — um cupom escopado
  // neles nunca aplicaria num checkout de plano. Impulso é recurring → entra
  // (os 3 planos Start/Pro/Scale, com família IMPULSO, ganham grupo próprio na UI).
  const addonByKey = new Map(ADDONS_V4_LIST.map((a) => [a.key, a]));
  const recurringKeys = new Set(
    ADDONS_V4_LIST.filter((a) => a.pricingMode === 'recurring_monthly').map((a) => a.key),
  );
  const addons: CouponableProduct[] = Object.entries(
    ADDONS_V4_STRIPE as Record<string, { productId?: string }>,
  )
    .filter(([key, cfg]) => typeof cfg.productId === 'string' && recurringKeys.has(key))
    .map(([key, cfg]) => {
      const meta = addonByKey.get(key);
      return {
        key,
        label: IMPULSO_LABELS[key] ?? meta?.name ?? key,
        productId: cfg.productId as string,
        type: 'addon' as const,
        family: meta?.family,
        monthlyBrl: meta?.amountBrl ?? null,
      };
    });

  return [...plans, ...addons];
}

/** Acha o produto elegível pelo productId. null se não for um produto conhecido. */
export function findCouponableProduct(productId: string | null | undefined): CouponableProduct | null {
  if (!productId) return null;
  return listCouponableProducts().find((p) => p.productId === productId) ?? null;
}
