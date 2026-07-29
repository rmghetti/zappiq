/* ══════════════════════════════════════════════════════════════════════
 * stripeWebhook.util — lógica PURA da reescrita do webhook (Área Clientes / Fase 3).
 * --------------------------------------------------------------------
 * Sem I/O: só resolução de plano/MRR a partir do priceId, mapeamento de
 * subscription.status → subscriptionStatus canônico, e merge NÃO-destrutivo do
 * settings JSON (o bug §0.4: o webhook antigo sobrescrevia settings inteiro,
 * apagando niche/agentName/billing a cada conversão).
 *
 * A verdade de "conta pagante" é stripeSubscriptionId (colunas da Fase 1),
 * nunca trialConverted. Aqui só derivamos os campos que o webhook grava.
 * ══════════════════════════════════════════════════════════════════════ */

import { STRIPE_V4_PRICES, PLAN_CONFIG, ADDONS_V4_STRIPE, V4_PACKAGE_ADDON_KEYS } from '@zappiq/shared';

/** Plans que o Organization.plan (enum PlanType) aceita. IZA_LITE → STARTER. */
const PLAN_ENUM = new Set(['STARTER', 'GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE']);

/**
 * priceId → plano V4 lógico ('IZA_LITE' | 'GROWTH' | 'SCALE') + ciclo.
 * Fonte: STRIPE_V4_PRICES (packages/shared). Retorna null se o priceId não for
 * conhecido (ex.: legacy V3.2, price não mapeado — o fundador precisa completar o
 * mapa; ver manualSteps).
 */
export function resolvePlanFromPriceId(
  priceId: string | null | undefined,
): { plan: string; billingCycle: 'monthly' | 'annual' } | null {
  if (!priceId) return null;
  for (const [plan, cfg] of Object.entries(STRIPE_V4_PRICES)) {
    if (cfg.monthly === priceId) return { plan, billingCycle: 'monthly' };
    if (cfg.annual === priceId) return { plan, billingCycle: 'annual' };
  }
  return null;
}

/** priceId (mensal OU anual) → key do addon de PACOTE (capacidade/canal). null se não for. */
export function packageAddonKeyFromPriceId(priceId: string | null | undefined): string | null {
  if (!priceId) return null;
  for (const key of V4_PACKAGE_ADDON_KEYS) {
    const ids = (ADDONS_V4_STRIPE as Record<string, { priceIds?: Record<string, string> }>)[key]?.priceIds;
    if (!ids) continue;
    if (ids.monthly === priceId || ids.annual === priceId) return key;
  }
  return null;
}

/**
 * Lê os itens de uma assinatura e devolve as keys dos addons de PACOTE presentes
 * (contatos/docs/fluxos/atendente/número/IG/integrações). Pura. Ignora o item do
 * plano, packs one-shot, overage e Impulso (assinatura separada).
 */
export function packageAddonsFromSubscriptionItems(
  items: Array<{ price?: { id?: string | null } | null }> | undefined,
): string[] {
  if (!items) return [];
  const keys = new Set<string>();
  for (const it of items) {
    const key = packageAddonKeyFromPriceId(it.price?.id);
    if (key) keys.add(key);
  }
  return [...keys];
}

const PACKAGE_KEY_SET = new Set<string>(V4_PACKAGE_ADDON_KEYS);

/**
 * Recalcula settings.addons a partir do estado atual da assinatura do PLANO:
 * substitui SÓ as keys de pacote (capacidade/canal) pelas detectadas, PRESERVANDO
 * Impulso e quaisquer outras keys (que vêm de outras assinaturas). Pura.
 */
export function mergePackageAddons(existing: unknown, detected: string[]): string[] {
  const prev = Array.isArray(existing) ? existing.filter((k): k is string => typeof k === 'string') : [];
  const preserved = prev.filter((k) => !PACKAGE_KEY_SET.has(k));
  const detectedUnique = [...new Set(detected.filter((k) => PACKAGE_KEY_SET.has(k)))];
  return [...preserved, ...detectedUnique];
}

/**
 * Plano lógico → valor gravável em Organization.plan (enum PlanType).
 * IZA_LITE (V4) mapeia para STARTER no enum legado do banco; os demais batem.
 * Retorna null se não houver correspondência segura (não grava lixo no enum).
 */
export function planToOrgEnum(plan: string | null | undefined): string | null {
  if (!plan) return null;
  const up = plan.toUpperCase();
  if (up === 'IZA_LITE') return 'STARTER';
  if (PLAN_ENUM.has(up)) return up;
  return null;
}

/**
 * MRR mensal em centavos de BRL para o plano lógico. Anual normaliza para o
 * equivalente mensal com desconto (annualDiscountPercent). Usa PLAN_CONFIG como
 * fonte de preço. Retorna 0 se o plano não tiver preço (ex.: ENTERPRISE custom).
 */
export function mrrCentsForPlan(
  plan: string | null | undefined,
  billingCycle: 'monthly' | 'annual' = 'monthly',
): number {
  if (!plan) return 0;
  const cfg = (PLAN_CONFIG as Record<string, { priceMonthly: number | null; annualDiscountPercent: number }>)[
    plan.toUpperCase()
  ];
  if (!cfg || cfg.priceMonthly == null) return 0;
  const monthly = cfg.priceMonthly;
  if (billingCycle === 'annual') {
    const discounted = monthly * (1 - (cfg.annualDiscountPercent ?? 0) / 100);
    return Math.round(discounted * 100);
  }
  return Math.round(monthly * 100);
}

/**
 * Mapeia Stripe subscription.status para o subscriptionStatus canônico que o
 * resto do sistema (deriveLifecycleStage) entende.
 *   active/trialing → active/trialing (ACTIVE quando há stripeSubscriptionId)
 *   past_due/unpaid → past_due/unpaid (PAST_DUE)
 *   canceled/incomplete_expired → canceled
 */
export function normalizeSubscriptionStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  const s = status.trim().toLowerCase();
  return s || null;
}

/** true quando o status Stripe representa uma assinatura efetivamente cobrável/ativa. */
export function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
  const s = normalizeSubscriptionStatus(status);
  return s === 'active' || s === 'trialing';
}

/** true quando o status Stripe representa inadimplência (dunning). */
export function isPastDueStatus(status: string | null | undefined): boolean {
  const s = normalizeSubscriptionStatus(status);
  return s === 'past_due' || s === 'unpaid';
}

/**
 * Merge NÃO-destrutivo do settings JSON. Corrige o bug §0.4: o webhook antigo
 * fazia `settings: { stripeCustomerId, stripeSubscriptionId }` (substituição
 * total), apagando niche/agentName/billing/etc. Aqui preservamos o objeto
 * existente e sobrescrevemos apenas as chaves informadas (patch !== null).
 */
export function mergeSettings(
  existing: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base: Record<string, unknown> =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) base[k] = v;
  }
  return base;
}

/** Converte epoch em segundos (Stripe) para Date, ou null. */
export function stripeEpochToDate(epoch: number | null | undefined): Date | null {
  if (epoch == null || !Number.isFinite(epoch)) return null;
  return new Date(epoch * 1000);
}
