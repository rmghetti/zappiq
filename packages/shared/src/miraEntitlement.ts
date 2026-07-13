/* ══════════════════════════════════════════════════════════════════════
 * Mira Prospects — configuração comercial + entitlement.
 * ----------------------------------------------------------------------
 * Fonte única da verdade do add-on Mira Prospects (inteligência e
 * qualificação de oportunidades). Consumida por: landing (Pricing),
 * dashboard (/mira), API (requireMira, quota) e Stripe (.command gera
 * os products/prices a partir daqui).
 *
 * Regras comerciais (aprovadas pelo fundador em 2026-07-11):
 *   - Add-on pago dentro de um plano (Growth+). Não vendável sem plano.
 *   - Incluído no BUSINESS (faixa PRO) e ENTERPRISE (faixa SCALE).
 *   - Unidade de valor: Alvo VERIFICADO com dossiê completo / mês.
 *   - Cota rígida: esgotou, bloqueia até comprar pack avulso (one-shot,
 *     mesmos tamanhos, +20% sobre a faixa) ou virar o mês.
 *   - Anual: mesmo desconto de 20% dos planos.
 *   - Zero setup fee, mensalidade fixa (bandeiras invioláveis).
 * ══════════════════════════════════════════════════════════════════════ */
import type { PlanId } from './planConfig.js';

// ── Faixas (assinatura recorrente) ─────────────────────────────────────
export const MIRA_TIER_KEYS = ['MIRA_ESSENCIAL', 'MIRA_PRO', 'MIRA_SCALE'] as const;
export type MiraTier = (typeof MIRA_TIER_KEYS)[number];

export interface MiraTierConfig {
  key: MiraTier;
  name: string;
  /** Alvos verificados incluídos por mês. */
  alvosPerMonth: number;
  /** Preço mensal em BRL. */
  priceMonthly: number;
  /** Desconto anual em % (igual aos planos). */
  annualDiscountPercent: number;
  /** Destaque na UI (faixa mais escolhida). */
  highlight?: boolean;
}

export const MIRA_TIERS: Record<MiraTier, MiraTierConfig> = {
  MIRA_ESSENCIAL: {
    key: 'MIRA_ESSENCIAL',
    name: 'Mira Essencial',
    alvosPerMonth: 50,
    priceMonthly: 297,
    annualDiscountPercent: 20,
  },
  MIRA_PRO: {
    key: 'MIRA_PRO',
    name: 'Mira Pro',
    alvosPerMonth: 200,
    priceMonthly: 597,
    annualDiscountPercent: 20,
    highlight: true,
  },
  MIRA_SCALE: {
    key: 'MIRA_SCALE',
    name: 'Mira Scale',
    alvosPerMonth: 600,
    priceMonthly: 1197,
    annualDiscountPercent: 20,
  },
};

export function listMiraTiers(): MiraTierConfig[] {
  return MIRA_TIER_KEYS.map((k) => MIRA_TIERS[k]);
}

/** Preço mensal efetivo da faixa no ciclo anual (−20%, arredondado a centavos). */
export function getMiraAnnualMonthlyPrice(tier: MiraTier): number {
  const t = MIRA_TIERS[tier];
  return Math.round(t.priceMonthly * (1 - t.annualDiscountPercent / 100) * 100) / 100;
}

// ── Packs avulsos (one-shot, liberam cota adicional DENTRO do mês) ─────
// Preço = faixa equivalente +20% (induz upgrade de faixa em vez de pack
// recorrente). Não acumulam para o mês seguinte.
export const MIRA_PACK_KEYS = ['MIRA_PACK_50', 'MIRA_PACK_200', 'MIRA_PACK_600'] as const;
export type MiraPack = (typeof MIRA_PACK_KEYS)[number];

export interface MiraPackConfig {
  key: MiraPack;
  name: string;
  alvos: number;
  /** Preço one-shot em BRL (= faixa equivalente * 1.2, arredondado a inteiro). */
  price: number;
}

export const MIRA_PACKS: Record<MiraPack, MiraPackConfig> = {
  MIRA_PACK_50: { key: 'MIRA_PACK_50', name: 'Pack 50 Alvos', alvos: 50, price: 356 },
  MIRA_PACK_200: { key: 'MIRA_PACK_200', name: 'Pack 200 Alvos', alvos: 200, price: 716 },
  MIRA_PACK_600: { key: 'MIRA_PACK_600', name: 'Pack 600 Alvos', alvos: 600, price: 1436 },
};

export function listMiraPacks(): MiraPackConfig[] {
  return MIRA_PACK_KEYS.map((k) => MIRA_PACKS[k]);
}

// ── Elegibilidade e inclusão por plano ─────────────────────────────────
/** Planos onde o add-on pode ser CONTRATADO (pago). */
export const MIRA_ELIGIBLE_PLANS: PlanId[] = ['GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'];

/** Planos que já INCLUEM uma faixa sem custo adicional (diferencial de tier). */
export const MIRA_INCLUDED_TIER_BY_PLAN: Partial<Record<PlanId, MiraTier>> = {
  BUSINESS: 'MIRA_PRO',
  ENTERPRISE: 'MIRA_SCALE',
};

// ── Entitlement ────────────────────────────────────────────────────────
export type MiraAccessReason = 'included' | 'addon' | 'none';

export interface MiraAccess {
  entitled: boolean;
  reason: MiraAccessReason;
  /** Faixa efetiva (da assinatura ou incluída no plano). */
  tier: MiraTier | null;
  /** Plano é elegível para contratar (mostra upsell quando !entitled). */
  eligible: boolean;
}

/**
 * Resolve o acesso ao Mira Prospects a partir do plano + add-ons ativos.
 * `activeAddonKeys` vem de organization.settings.addons (mesmo array do
 * SCHEDULING_AGENT / Impulso). Se a org tem faixa assinada E o plano já
 * inclui uma faixa, vale a MAIOR (assinatura nunca rebaixa o incluído).
 */
export function resolveMiraAccess(plan: PlanId, activeAddonKeys: readonly string[] = []): MiraAccess {
  const eligible = MIRA_ELIGIBLE_PLANS.includes(plan);
  const subscribed = (MIRA_TIER_KEYS.find((k) => activeAddonKeys.includes(k)) ?? null) as MiraTier | null;
  const included = MIRA_INCLUDED_TIER_BY_PLAN[plan] ?? null;

  if (!subscribed && !included) return { entitled: false, reason: 'none', tier: null, eligible };
  if (subscribed && included) {
    const best =
      MIRA_TIERS[subscribed].alvosPerMonth >= MIRA_TIERS[included].alvosPerMonth ? subscribed : included;
    return { entitled: true, reason: best === included ? 'included' : 'addon', tier: best, eligible };
  }
  if (subscribed) return { entitled: true, reason: 'addon', tier: subscribed, eligible };
  return { entitled: true, reason: 'included', tier: included, eligible };
}

// ── Cota ───────────────────────────────────────────────────────────────
export interface MiraQuota {
  /** Cota base da faixa no mês corrente. */
  tierQuota: number;
  /** Alvos extras liberados por packs one-shot NESTE mês. */
  packExtra: number;
  /** Total disponível no mês (tierQuota + packExtra). */
  total: number;
  /** Alvos verificados já consumidos no mês. */
  used: number;
  /** Restante (>= 0). */
  remaining: number;
  /** Cota esgotada — geração de novos Alvos bloqueada até pack ou virada do mês. */
  blocked: boolean;
}

/** Função pura de cálculo da cota (a persistência de used/packExtra é do backend). */
export function computeMiraQuota(tier: MiraTier | null, used: number, packExtra = 0): MiraQuota {
  const tierQuota = tier ? MIRA_TIERS[tier].alvosPerMonth : 0;
  const total = tierQuota + Math.max(0, packExtra);
  const remaining = Math.max(0, total - Math.max(0, used));
  return {
    tierQuota,
    packExtra: Math.max(0, packExtra),
    total,
    used: Math.max(0, used),
    remaining,
    blocked: total > 0 ? remaining <= 0 : true,
  };
}
