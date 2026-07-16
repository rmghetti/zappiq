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
  /** Família comercial do add-on (IMPULSO, MIRA, CAPACITY, CHANNEL…). Ausente em planos. */
  family?: string;
  /** Preço mensal em BRL (null = sob consulta). Exibido na página de cupons. */
  monthlyBrl?: number | null;
  /**
   * É assinatura (cobra todo mês) x pagamento único (pack avulso).
   * A página de cupons PRECISA disto: ela mostra "R$ X/mês · ou R$ Y/ano
   * (20% off)", e escrever isso num pack one-shot seria mentira na tela.
   */
  recurring: boolean;
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

const MIRA_LABELS: Record<string, string> = {
  MIRA_ESSENCIAL: 'Mira Essencial',
  MIRA_PRO: 'Mira Pro',
  MIRA_SCALE: 'Mira Scale',
  MIRA_PACKS: 'Mira — Pacotes avulsos',
};

/**
 * Um add-on recebe cupom quando:
 *   - `couponable` está explícito no catálogo (ganha de tudo), OU
 *   - é assinatura recorrente (o caso comum: entra como line item).
 *
 * Overage unitário (AI_MSG) e packs SEM checkout próprio (BROADCAST) ficam de
 * fora: não há carrinho onde um cupom escopado neles pudesse aplicar.
 */
function aceitaCupom(a: { pricingMode: string; couponable?: boolean }): boolean {
  return a.couponable ?? a.pricingMode === 'recurring_monthly';
}

/** Todos os produtos elegíveis a cupom: planos V4 + addons (com productId). */
export function listCouponableProducts(): CouponableProduct[] {
  const plans: CouponableProduct[] = Object.entries(STRIPE_V4_PRICES).map(([key, cfg]) => ({
    key,
    label: PLAN_LABELS[key] ?? `Plano ${key}`,
    productId: cfg.productId,
    type: 'plan' as const,
    monthlyBrl: PLAN_CONFIG[key as keyof typeof PLAN_CONFIG]?.priceMonthly ?? null,
    recurring: true, // plano é sempre assinatura
  }));

  // Quem aceita cupom: ver aceitaCupom(). Impulso e Mira são recorrentes →
  // entram, cada família com seu grupo na UI. Os packs do Mira entram pelo
  // `couponable: true` explícito (têm checkout próprio com campo de cupom).
  const addonByKey = new Map(ADDONS_V4_LIST.map((a) => [a.key, a]));
  const couponableKeys = new Set(ADDONS_V4_LIST.filter(aceitaCupom).map((a) => a.key));
  const addons: CouponableProduct[] = Object.entries(
    ADDONS_V4_STRIPE as Record<string, { productId?: string }>,
  )
    .filter(([key, cfg]) => typeof cfg.productId === 'string' && couponableKeys.has(key))
    .map(([key, cfg]) => {
      const meta = addonByKey.get(key);
      return {
        key,
        label: MIRA_LABELS[key] ?? IMPULSO_LABELS[key] ?? meta?.name ?? key,
        productId: cfg.productId as string,
        type: 'addon' as const,
        family: meta?.family,
        monthlyBrl: meta?.amountBrl ?? null,
        recurring: meta?.pricingMode === 'recurring_monthly',
      };
    });

  return [...plans, ...addons];
}

/** Acha o produto elegível pelo productId. null se não for um produto conhecido. */
export function findCouponableProduct(productId: string | null | undefined): CouponableProduct | null {
  if (!productId) return null;
  return listCouponableProducts().find((p) => p.productId === productId) ?? null;
}
