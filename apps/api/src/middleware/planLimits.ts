import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { PLAN_CONFIG, type PlanId, type PlanLimits } from '@zappiq/shared';
import redis from '../utils/redis.js';
import { logger } from '../utils/logger.js';

/*
 * ═════════════════════════════════════════════════════════════════
 * Plan Limits Enforcement
 * ─────────────────────────────────────────────────────────────────
 * Middleware que valida, antes de operações consumíveis, se o
 * tenant ainda tem quota no ciclo mensal corrente.
 *
 * Princípios:
 * - Soft-fail para GETs (nunca bloqueia leitura).
 * - Hard-fail para POSTs que geram custo (agent reply, broadcast,
 *   upload de doc RAG, criação de fluxo).
 * - Trial: aplica cap de custo em USD adicional ao limite do plano.
 * - Contadores em Redis com TTL de 35 dias (cobre ciclo + grace).
 * - Planos com limite -1 (ilimitado) sempre passam.
 * ═════════════════════════════════════════════════════════════════
 */

export type LimitKind =
  | 'agents'
  | 'aiMessagesPerMonth'
  | 'broadcastsPerMonth'
  | 'contacts'
  | 'flows'
  | 'whatsappNumbers'
  | 'knowledgeBaseDocs';

// Chaves de métrica persistidas em Redis por ciclo.
// Formato: zappiq:usage:{orgId}:{yyyy-mm}:{kind}
function usageKey(orgId: string, kind: LimitKind): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `zappiq:usage:${orgId}:${ym}:${kind}`;
}

// TTL: 35 dias (cobre transição de mês com grace period).
const TTL_SECONDS = 35 * 24 * 3600;

export async function incrementUsage(
  orgId: string,
  kind: LimitKind,
  amount = 1,
): Promise<number> {
  try {
    const key = usageKey(orgId, kind);
    const current = await redis.incrby(key, amount);
    // Set TTL apenas na primeira criação (se o contador for igual ao increment, é novo).
    if (current === amount) {
      await redis.expire(key, TTL_SECONDS);
    }
    return current;
  } catch (err: any) {
    logger.warn(`[planLimits] Redis increment failed: ${err.message}`);
    // Graceful: se Redis cair, não bloqueia a operação (prefere servir a bloquear).
    return 0;
  }
}

export async function getUsage(orgId: string, kind: LimitKind): Promise<number> {
  try {
    const raw = await redis.get(usageKey(orgId, kind));
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Carrega o plano efetivo do tenant, considerando estado de trial.
 * Durante trial: o tenant tem acesso a features do plano "contratado"
 * porém com cap de custo em USD para proteger margem.
 */
export async function getEffectivePlan(orgId: string): Promise<{
  planId: PlanId;
  limits: PlanLimits;
  isTrialing: boolean;
  trialCostCapUsd: number;
  trialEndsAt: Date | null;
}> {
  const org = (await prisma.organization.findUnique({
    where: { id: orgId },
  })) as any;

  if (!org) {
    throw new Error(`Organization ${orgId} not found`);
  }

  const planId = org.plan as PlanId;
  const config = PLAN_CONFIG[planId];
  const now = new Date();
  const isTrialing =
    org.isTrialActive &&
    !org.trialConverted &&
    org.trialEndsAt !== null &&
    org.trialEndsAt > now;

  return {
    planId,
    limits: config.limits,
    isTrialing,
    trialCostCapUsd: org.trialCostCapUsd,
    trialEndsAt: org.trialEndsAt,
  };
}

/**
 * Checa se uma operação pode prosseguir sem violar o limite.
 * Retorna detalhes da decisão para resposta estruturada.
 */
export async function checkLimit(
  orgId: string,
  kind: LimitKind,
  delta = 1,
): Promise<{
  allowed: boolean;
  limit: number;
  current: number;
  remaining: number;
  reason?: string;
  planId: PlanId;
  isTrialing: boolean;
}> {
  const { planId, limits, isTrialing } = await getEffectivePlan(orgId);
  const limit = limits[kind];

  if (limit === -1) {
    return { allowed: true, limit: -1, current: 0, remaining: -1, planId, isTrialing };
  }

  const current = await getUsage(orgId, kind);
  const wouldBe = current + delta;

  if (wouldBe > limit) {
    return {
      allowed: false,
      limit,
      current,
      remaining: Math.max(0, limit - current),
      reason: `Limite do plano ${planId} atingido para ${kind}. Atual: ${current}/${limit}.`,
      planId,
      isTrialing,
    };
  }

  return {
    allowed: true,
    limit,
    current,
    remaining: limit - wouldBe,
    planId,
    isTrialing,
  };
}

/**
 * Middleware factory para proteger rotas consumíveis.
 * Uso: router.post('/broadcasts', enforceLimit('broadcastsPerMonth'), handler)
 */
export function enforceLimit(kind: LimitKind, delta = 1) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'organization context missing' });
        return;
      }

      const check = await checkLimit(orgId, kind, delta);

      if (!check.allowed) {
        res.status(429).json({
          error: 'plan_limit_exceeded',
          message: check.reason,
          planId: check.planId,
          limit: check.limit,
          current: check.current,
          remaining: check.remaining,
          isTrialing: check.isTrialing,
          upgradeUrl: '/billing',
        });
        return;
      }

      // Incrementa e segue.
      await incrementUsage(orgId, kind, delta);
      next();
    } catch (err: any) {
      logger.error(`[planLimits] enforcement error: ${err.message}`);
      // Graceful: se enforcement falhar, loga e libera (prefere servir a bloquear).
      next();
    }
  };
}

/**
 * Trial cost cap — chamado de dentro do agentOrchestrator antes
 * de efetuar chamada LLM paga.
 *
 * Se o tenant está em trial e já gastou > trialCostCapUsd, bloqueia
 * a chamada e retorna mensagem amigável para o cliente final.
 */
export async function assertTrialCostCap(
  orgId: string,
  additionalUsdEstimate = 0.02,
): Promise<{ allowed: boolean; reason?: string; spentUsd: number; capUsd: number }> {
  const { isTrialing, trialCostCapUsd } = await getEffectivePlan(orgId);

  if (!isTrialing) {
    return { allowed: true, spentUsd: 0, capUsd: trialCostCapUsd };
  }

  // Consulta custo acumulado via Redis (populado pelo metrics.ts).
  const costKey = `zappiq:trial_cost_usd:${orgId}`;
  let spentUsd = 0;
  try {
    const raw = await redis.get(costKey);
    spentUsd = raw ? parseFloat(raw) : 0;
  } catch {}

  if (spentUsd + additionalUsdEstimate > trialCostCapUsd) {
    return {
      allowed: false,
      reason: `Trial cost cap atingido (US$ ${spentUsd.toFixed(2)} / US$ ${trialCostCapUsd.toFixed(2)}). Assine um plano para continuar.`,
      spentUsd,
      capUsd: trialCostCapUsd,
    };
  }

  return { allowed: true, spentUsd, capUsd: trialCostCapUsd };
}

/**
 * Incrementa custo acumulado do trial (chamado após cada chamada LLM).
 */
export async function recordTrialCost(orgId: string, costUsd: number): Promise<void> {
  try {
    const key = `zappiq:trial_cost_usd:${orgId}`;
    // Usamos incrbyfloat para precisão. TTL alinhado com janela de trial + grace (60 dias).
    await redis.incrbyfloat(key, costUsd);
    await redis.expire(key, 60 * 24 * 3600);
  } catch (err: any) {
    logger.warn(`[planLimits] recordTrialCost failed: ${err.message}`);
  }
}
