import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { PLAN_CONFIG, type PlanId, type PlanLimits } from '@zappiq/shared';
import { cache } from '../services/cloud/index.js';
import { logger } from '../utils/logger.js';
import { reportOverageMeterEvent, estimateOverageBrl } from '../services/quotaOverageService.js';
import { env } from '../config/env.js';

// PR #V4-005.3: migrado de redis direto pra abstração cloud-agnostic (cache).
// cache.incrby / cache.incrbyfloat / cache.get / cache.expire são fail-soft
// por contrato — null/false em erro de backend, não throw.

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
  const key = usageKey(orgId, kind);
  const current = await cache.incrby(key, amount);
  if (current === null) {
    // cache.incrby já logou warning. Fail-soft: prefere servir a bloquear.
    return 0;
  }
  // Set TTL apenas na primeira criação (contador igual ao increment = novo).
  if (current === amount) {
    await cache.expire(key, TTL_SECONDS);
  }
  return current;
}

export async function getUsage(orgId: string, kind: LimitKind): Promise<number> {
  const raw = await cache.get(usageKey(orgId, kind));
  return raw ? parseInt(raw, 10) : 0;
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
 * Onda 1.C — Soft block 60d primeiros.
 * Orgs com createdAt < 60 dias ganham grace period: NAO sao bloqueadas
 * mesmo com autoOverage=false. Apos D+60, comportamento normal.
 */
export async function isInGracePeriod(orgId: string): Promise<boolean> {
  try {
    const org = (await prisma.organization.findUnique({
      where: { id: orgId },
      select: { createdAt: true },
    })) as any;
    if (!org?.createdAt) return false;
    const ageDays = (Date.now() - new Date(org.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays < 60;
  } catch {
    return false; // fail-safe: nao concede grace se nao conseguir ler
  }
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
  /** True quando autoOverage ativo e estourou plano (permite + cobra). */
  isOverage?: boolean;
  /** Quantas msgs deste delta sao overage (pra reportar pro Stripe). */
  overageDelta?: number;
}> {
  const { planId, limits, isTrialing } = await getEffectivePlan(orgId);
  const limit = limits[kind];

  if (limit === -1) {
    return { allowed: true, limit: -1, current: 0, remaining: -1, planId, isTrialing };
  }

  const current = await getUsage(orgId, kind);
  const wouldBe = current + delta;

  if (wouldBe <= limit) {
    // Dentro do plano — comportamento normal
    return {
      allowed: true,
      limit,
      current,
      remaining: limit - wouldBe,
      planId,
      isTrialing,
    };
  }

  // ─── ALEM DO LIMITE — decisao de overage ─────────────────────────
  // Le settings.billing pra decidir se permite cobranca extra ou bloqueia
  // Apenas aplica logica de overage pra aiMessagesPerMonth nesta onda (1.A).
  // Outros kinds (broadcasts, contacts, etc.) continuam com block hard.

  if (kind !== 'aiMessagesPerMonth') {
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

  const org = (await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  })) as any;
  const billing = (org?.settings as any)?.billing ?? {};
  const autoOverage: boolean = Boolean(billing.autoOverage);
  const hardCeilingBrl: number | null = billing.hardCeilingBrl ?? null;

  if (!autoOverage) {
    // Onda 1.C — Soft block: orgs < 60d ganham grace (permite + log warning)
    const inGrace = await isInGracePeriod(orgId);
    if (inGrace) {
      logger.warn(`[planLimits] SOFT BLOCK org=${orgId} kind=${kind} ${current}/${limit} (grace 60d ativa)`);
      return {
        allowed: true,
        limit,
        current,
        remaining: 0,
        planId,
        isTrialing,
        isOverage: true,
        overageDelta: delta,
        // Soft mode: nao reporta pro Stripe (autoOverage=false), mas permite uso
      };
    }
    return {
      allowed: false,
      limit,
      current,
      remaining: Math.max(0, limit - current),
      reason: `Limite do plano ${planId} atingido para ${kind}. autoOverage desativado — ative em /settings/billing pra continuar com cobranca por mensagem excedente.`,
      planId,
      isTrialing,
    };
  }

  // autoOverage ON — calcula overage e checa hardCeiling
  const totalOverageMsgs = wouldBe - limit;
  if (hardCeilingBrl !== null && hardCeilingBrl > 0) {
    const projectedOverageBrl = estimateOverageBrl(totalOverageMsgs);
    if (projectedOverageBrl > hardCeilingBrl) {
      return {
        allowed: false,
        limit,
        current,
        remaining: 0,
        reason: `Teto de R$ ${hardCeilingBrl.toFixed(2)}/mes atingido (excedente projetado: R$ ${projectedOverageBrl.toFixed(2)}). Aumente o teto em /settings/billing pra continuar.`,
        planId,
        isTrialing,
      };
    }
  }

  // Permite e marca como overage — middleware vai disparar meter_event
  return {
    allowed: true,
    limit,
    current,
    remaining: 0,
    planId,
    isTrialing,
    isOverage: true,
    overageDelta: delta,
  };
}

/**
 * W2.5 — Gate de quota no pipeline de resposta da IA.
 * ─────────────────────────────────────────────────────────────────
 * Chamado de dentro do agentOrchestrator ANTES de gerar/enviar a
 * resposta da IA ao inbound. Consome 1 crédito de aiMessagesPerMonth.
 *
 * Respeita QUOTA_OVERAGE_MODE (env, default 'audit_only'):
 *   - 'audit_only': NUNCA bloqueia. Registra uso, e se estourou o
 *     plano loga alerta + reporta meter_event (fail-soft). Retorna
 *     sempre { allowed: true }. É o comportamento atual (audita, não
 *     interrompe a resposta).
 *   - 'enforce': honra a decisão de checkLimit. Se checkLimit negar
 *     (limite atingido sem autoOverage/grace, ou teto hardCeiling
 *     estourado), retorna { allowed: false } — o orchestrator pausa a
 *     resposta. Se checkLimit permitir (dentro do plano, grace, ou
 *     overage opt-in), consome o crédito e reporta overage quando for
 *     o caso.
 *
 * Fail-soft: qualquer exceção interna libera a resposta (prefere
 * servir a bloquear). Nunca lança.
 */
export async function enforceAiReplyQuota(
  orgId: string,
  delta = 1,
): Promise<{
  allowed: boolean;
  mode: 'audit_only' | 'enforce';
  reason?: string;
  limit?: number;
  current?: number;
  planId?: PlanId;
  isOverage?: boolean;
}> {
  const mode = env.QUOTA_OVERAGE_MODE;
  try {
    const check = await checkLimit(orgId, 'aiMessagesPerMonth', delta);

    // ── audit_only: nunca bloqueia. Só registra/alerta. ──────────────
    if (mode !== 'enforce') {
      if (!check.allowed) {
        // checkLimit negaria (block hard), mas em audit_only servimos e
        // apenas auditamos que houve estouro.
        logger.warn(
          `[planLimits] AUDIT overage (não bloqueia) org=${orgId} kind=aiMessagesPerMonth ${check.current}/${check.limit} plan=${check.planId}`,
        );
      }
      await incrementUsage(orgId, 'aiMessagesPerMonth', delta);
      maybeReportOverage(orgId, check);
      return {
        allowed: true,
        mode,
        limit: check.limit,
        current: check.current,
        planId: check.planId,
        isOverage: !check.allowed || check.isOverage,
      };
    }

    // ── enforce: honra a decisão de checkLimit ───────────────────────
    if (!check.allowed) {
      logger.warn(
        `[planLimits] ENFORCE block org=${orgId} kind=aiMessagesPerMonth ${check.current}/${check.limit} plan=${check.planId} reason=${check.reason}`,
      );
      return {
        allowed: false,
        mode,
        reason: check.reason,
        limit: check.limit,
        current: check.current,
        planId: check.planId,
      };
    }

    await incrementUsage(orgId, 'aiMessagesPerMonth', delta);
    maybeReportOverage(orgId, check);
    return {
      allowed: true,
      mode,
      limit: check.limit,
      current: check.current,
      planId: check.planId,
      isOverage: check.isOverage,
    };
  } catch (err: any) {
    // Fail-soft: nunca derruba a resposta da IA por erro de quota.
    logger.error(`[planLimits] enforceAiReplyQuota error org=${orgId}: ${err?.message ?? err}`);
    return { allowed: true, mode };
  }
}

/**
 * Dispara meter_event de overage (fire-and-forget, fail-soft) quando a
 * checagem marcou overage. reportOverageMeterEvent já gateia por
 * QUOTA_OVERAGE_MODE internamente (skip 'mode_audit_only' em audit).
 */
function maybeReportOverage(
  orgId: string,
  check: { isOverage?: boolean; overageDelta?: number; allowed?: boolean },
): void {
  const overageCount =
    check.overageDelta && check.overageDelta > 0
      ? check.overageDelta
      : check.isOverage || check.allowed === false
        ? 1
        : 0;
  if (overageCount <= 0) return;
  reportOverageMeterEvent({ orgId, count: overageCount })
    .then((r) => {
      if (r.reported) {
        logger.info(
          `[planLimits] overage reportado org=${orgId} count=${overageCount} eventId=${r.meterEventId}`,
        );
      } else if (r.skipped !== 'mode_audit_only') {
        logger.warn(`[planLimits] overage NAO reportado org=${orgId} reason=${r.skipped}`);
      }
    })
    .catch((err) => {
      logger.warn(`[planLimits] overage report exception: ${err?.message ?? err}`);
    });
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

      // Incrementa o contador local (vale pro proximo check do mesmo ciclo).
      await incrementUsage(orgId, kind, delta);

      // OVERAGE: se permitido por estar acima do plano via autoOverage,
      // reporta meter_event pro Stripe (fire-and-forget, fail-soft).
      // Sinaliza no header pro frontend mostrar aviso ao operador.
      if (check.isOverage && check.overageDelta && check.overageDelta > 0) {
        res.setHeader('X-Quota-Overage', 'true');
        reportOverageMeterEvent({ orgId, count: check.overageDelta })
          .then((r) => {
            if (r.reported) {
              logger.info(
                `[planLimits] overage reportado org=${orgId} count=${check.overageDelta} eventId=${r.meterEventId}`,
              );
            } else if (r.skipped !== 'mode_audit_only') {
              logger.warn(
                `[planLimits] overage NAO reportado org=${orgId} reason=${r.skipped}`,
              );
            }
          })
          .catch((err) => {
            logger.warn(`[planLimits] overage report exception: ${err?.message ?? err}`);
          });
      }

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

  // Consulta custo acumulado via cache (populado pelo metrics.ts).
  const costKey = `zappiq:trial_cost_usd:${orgId}`;
  const raw = await cache.get(costKey);
  const spentUsd = raw ? parseFloat(raw) : 0;

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
  const key = `zappiq:trial_cost_usd:${orgId}`;
  // incrbyfloat pra precisão monetária. TTL = janela trial + grace (60 dias).
  // Fail-soft: cache.incrbyfloat já loga warning em erro; spentUsd só fica
  // momentaneamente desatualizado.
  const result = await cache.incrbyfloat(key, costUsd);
  if (result !== null) {
    await cache.expire(key, 60 * 24 * 3600);
  }
}
