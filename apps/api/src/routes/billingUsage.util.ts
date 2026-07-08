/**
 * billingUsage.util.ts — FIX W3.1 (Uso do plano atual = dados reais)
 * ============================================================================
 * ANTES: apps/web/.../billing/page.tsx tinha o bloco "Uso do plano atual" 100%
 * MOCK hardcoded (340/1000 conversas, 1/5 atendentes, 3/5 docs) pra qualquer
 * cliente/plano. Nao existia endpoint de usage do tenant.
 *
 * AGORA: computeBillingUsage devolve uso REAL do periodo corrente vs limite do
 * plano, a partir das fontes que ja existem:
 *   - conversas   : Conversation criadas no mes (createdAt no periodo).
 *                   Limite = teto de volume mensal do plano (contacts) — nao ha
 *                   limite dedicado de "conversas" em PlanLimits, e contacts e o
 *                   unico cap de volume por tenant (batia com o mock 1.000).
 *   - atendentes  : User.count da org (seats ocupados). Limite = limits.agents.
 *   - docs        : KBDocument da org (via KnowledgeBase.organizationId).
 *                   Limite = limits.knowledgeBaseDocs.
 *   - aiMessages  : contador Redis do ciclo (mesma chave do enforcement de
 *                   quota). Limite = limits.aiMessagesPerMonth.
 *
 * Funcao pura + dependencias injetadas -> testavel sem Redis/DB real.
 * ============================================================================
 */
import { PLAN_CONFIG, applyAddonGrants, type PlanId, type PlanLimits } from '@zappiq/shared';

export interface UsageMetric {
  /** Uso observado no periodo corrente. */
  used: number;
  /** Teto do plano. -1 = ilimitado. */
  limit: number;
}

export interface BillingUsageResult {
  planId: PlanId;
  /** YYYY-MM do periodo corrente (UTC). */
  period: string;
  conversas: UsageMetric;
  atendentes: UsageMetric;
  docs: UsageMetric;
  aiMessages: UsageMetric;
}

/** Periodo corrente no formato YYYY-MM (UTC) — mesmo formato do TenantUsageMonthly. */
export function currentPeriodYearMonth(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Inicio (inclusive) e fim (exclusive) do mes corrente em UTC. */
export function currentMonthRange(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/** Normaliza um plano desconhecido/nulo para um PlanId valido (fallback IZA_LITE). */
export function resolvePlanId(plan: string | null | undefined): PlanId {
  if (plan && plan in PLAN_CONFIG) return plan as PlanId;
  return 'IZA_LITE';
}

export interface ComputeBillingUsageDeps {
  /** Conta Conversation da org criadas em [start, end). */
  countConversations: (start: Date, end: Date) => Promise<number>;
  /** Conta User (seats) da org. */
  countAgents: () => Promise<number>;
  /** Conta KBDocument da org. */
  countDocs: () => Promise<number>;
  /** Le contador Redis de aiMessagesPerMonth do ciclo corrente. */
  getAiMessagesUsage: () => Promise<number>;
  /** Injetavel pra teste deterministico. */
  now?: Date;
}

/**
 * Monta o payload de uso real vs limite do plano.
 * Nunca lanca por falha de fonte individual — cada contador ja deve ser
 * fail-soft no chamador (retorna 0). Aqui so orquestra e casa com os limites.
 */
export async function computeBillingUsage(
  planIdRaw: string | null | undefined,
  deps: ComputeBillingUsageDeps,
  /** Addons de pacote ativos (settings.addons) — somam ao limite exibido. */
  activeAddons: readonly string[] = [],
): Promise<BillingUsageResult> {
  const planId = resolvePlanId(planIdRaw);
  // Limite EFETIVO = plano + addons (mesma regra do enforcement de quota).
  const limits: PlanLimits = applyAddonGrants(PLAN_CONFIG[planId].limits, activeAddons);
  const now = deps.now ?? new Date();
  const { start, end } = currentMonthRange(now);

  const [conversasUsed, atendentesUsed, docsUsed, aiMessagesUsed] = await Promise.all([
    deps.countConversations(start, end),
    deps.countAgents(),
    deps.countDocs(),
    deps.getAiMessagesUsage(),
  ]);

  return {
    planId,
    period: currentPeriodYearMonth(now),
    conversas: { used: conversasUsed, limit: limits.contacts },
    atendentes: { used: atendentesUsed, limit: limits.agents },
    docs: { used: docsUsed, limit: limits.knowledgeBaseDocs },
    aiMessages: { used: aiMessagesUsed, limit: limits.aiMessagesPerMonth },
  };
}
