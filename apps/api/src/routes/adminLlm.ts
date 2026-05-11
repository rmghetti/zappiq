/* ══════════════════════════════════════════════════════════════════════
 * V2-025 · /api/admin/llm-status (Sprint 0 Observability DAY 1)
 * --------------------------------------------------------------------
 * Endpoint admin para healthcheck dos providers LLM (LLMRouter cascade)
 * + métricas agregadas das últimas 24h (cost-per-tenant, fallback rate).
 *
 * Auth: header X-Admin-Secret == env.META_APP_SECRET (mesmo padrão de
 * adminWhatsapp.ts — reusa o secret existente, sem secret novo no Fly).
 *
 * Uso operacional:
 *   curl -H "X-Admin-Secret: $META_APP_SECRET" \
 *        https://zappiq-api.fly.dev/api/admin/llm-status
 *
 * Resposta:
 *   {
 *     providers: [
 *       { id: "anthropic-sonnet", model: "claude-sonnet-4-6", breakerOpen: false, failures: 0 },
 *       ...
 *     ],
 *     last24h: {
 *       totalCalls: 1234,
 *       totalCostUsd: "5.23",
 *       avgLatencyMs: 1842,
 *       fallbackRate: 0.012,    // 1.2%
 *       byProvider: { "anthropic-sonnet": 1200, "anthropic-haiku": 30, "openai-mini": 4 }
 *     }
 *   }
 *
 * Útil em incidente: confirmar se cascade está saudável + ver tráfego real.
 * ══════════════════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { llmRouter } from '../services/llm/LLMRouter.js';
import { prisma } from '@zappiq/database';
import redis from '../utils/redis.js';
import { PLAN_CONFIG, type PlanConfig } from '@zappiq/shared';
// PR #135-alt: novo endpoint paralelo /llm-health protegido por JWT+SUPERADMIN
// pra dashboard frontend consumir sem expor META_APP_SECRET ao browser.
import { authMiddleware, requireRole } from '../middleware/auth.js';
// PR #160-cron-trigger: imports pra forçar execução manual dos crons (debug + validação pós-deploy)
import { runTenantUsageCycle } from '../services/tenantUsageService.js';
import { runUsageReconciliationCycle } from '../services/usageReconciliationService.js';

const router = Router();

function requireAdminAuth(req: Request, res: Response): boolean {
  const provided = req.header('x-admin-secret');
  const expected = env.META_APP_SECRET;
  if (!expected) {
    res.status(500).json({ error: 'META_APP_SECRET não configurado no servidor' });
    return false;
  }
  if (!provided || provided !== expected) {
    res.status(403).json({ error: 'X-Admin-Secret inválido ou ausente' });
    return false;
  }
  return true;
}

router.get('/llm-status', async (req: Request, res: Response) => {
  if (!requireAdminAuth(req, res)) return;

  try {
    // PR #V4-003: getStatus virou async (consulta Redis pro estado do breaker)
    const providers = await llmRouter.getStatus();

    // Agregação 24h via llm_call_logs (tabela criada no Blocker 1)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [stats, byProviderRaw] = await Promise.all([
      prisma.lLMCallLog.aggregate({
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { costUsdEstimate: true },
        _avg: { latencyMs: true },
      }),
      prisma.lLMCallLog.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);

    // Fallback rate = chamadas com fallback_triggered=true / total
    const fallbacks = await prisma.lLMCallLog.count({
      where: { createdAt: { gte: since }, fallbackTriggered: true },
    });

    const totalCalls = stats._count._all ?? 0;
    const fallbackRate = totalCalls > 0 ? fallbacks / totalCalls : 0;

    const byProvider: Record<string, number> = {};
    for (const row of byProviderRaw) {
      byProvider[row.provider] = row._count._all;
    }

    res.json({
      providers,
      last24h: {
        totalCalls,
        totalCostUsd: stats._sum.costUsdEstimate?.toString() ?? '0',
        avgLatencyMs: Math.round(stats._avg.latencyMs ?? 0),
        fallbackRate: Number(fallbackRate.toFixed(4)),
        byProvider,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[admin/llm-status] erro:', err);
    res.status(500).json({ error: 'erro ao consultar status' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// PR #135-alt — GET /api/admin/llm-health
// --------------------------------------------------------------------------
// Versão JWT-protegida do /llm-status pra o painel admin frontend consumir
// sem expor META_APP_SECRET ao browser. Mesma resposta, auth diferente.
//
// Uso:
//   curl https://zappiq-api.fly.dev/api/admin/llm-health \
//        -H "Authorization: Bearer <JWT>"
//
// Auth: authMiddleware + requireRole('SUPERADMIN'). Outros tiers de user
// recebem 403. Padrão alinhado com /api/admin/tenant-usage/*.
// ══════════════════════════════════════════════════════════════════════════
async function llmHealthHandler(req: Request, res: Response) {
  try {
    const providers = await llmRouter.getStatus();

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [stats, byProviderRaw, fallbacks] = await Promise.all([
      prisma.lLMCallLog.aggregate({
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { costUsdEstimate: true },
        _avg: { latencyMs: true },
      }),
      prisma.lLMCallLog.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.lLMCallLog.count({
        where: { createdAt: { gte: since }, fallbackTriggered: true },
      }),
    ]);

    const totalCalls = stats._count._all ?? 0;
    const fallbackRate = totalCalls > 0 ? fallbacks / totalCalls : 0;
    const byProvider: Record<string, number> = {};
    for (const row of byProviderRaw) {
      byProvider[row.provider] = row._count._all;
    }

    res.json({
      providers,
      last24h: {
        totalCalls,
        totalCostUsd: stats._sum.costUsdEstimate?.toString() ?? '0',
        avgLatencyMs: Math.round(stats._avg.latencyMs ?? 0),
        fallbackRate: Number(fallbackRate.toFixed(4)),
        byProvider,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[admin/llm-health] erro:', err);
    res.status(500).json({ error: 'erro ao consultar saúde dos providers' });
  }
}

// Auth chain: authMiddleware extrai JWT, requireRole valida SUPERADMIN.
router.get(
  '/llm-health',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  llmHealthHandler,
);

// ══════════════════════════════════════════════════════════════════════════
// PR cron-trigger — POST /api/admin/cron/run
// --------------------------------------------------------------------------
// Dispara MANUALMENTE a execução de um cron específico sem esperar o horário
// agendado. Útil pra validação pós-deploy (cron 04:00 UTC pode ser daqui
// horas — vc quer ver agora) ou disaster recovery (cron falhou silenciosamente
// numa execução, rodar de novo).
//
// Auth: X-Admin-Secret == env.META_APP_SECRET (mesmo do /llm-status).
// Trabalha como /llm-status — proteção por header secret. NÃO precisa JWT.
//
// Uso operacional (de dentro do container Fly):
//   curl -X POST -H "X-Admin-Secret: $META_APP_SECRET" \
//        -H "Content-Type: application/json" \
//        -d '{"job":"tenant-usage"}' \
//        http://localhost:3001/api/admin/cron/run
//
// Jobs suportados:
//   - tenant-usage          → runTenantUsageCycle()
//   - usage-reconciliation  → runUsageReconciliationCycle()
//
// Idempotência: ambos os ciclos são idempotentes (upsert/Redis hash). Rodar
// 2x não causa double-counting. Mas evite rodar enquanto o cron agendado
// está rodando (race em writes).
// ══════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════
// PR quota-watch — GET /api/admin/quota-watch
// --------------------------------------------------------------------------
// Painel humano pro audit-only do PR #149. Lista todas as organizações
// ativas com:
//   - plan + isTrialActive
//   - consumo mês corrente (aiMessagesProcessed) vs limite do plano
//   - usagePercent calculado
//   - settings.billing (autoOverage, hardCeilingBrl, notifyAtPercent)
//   - estado do Redis hash de reconciliação (last_run, last_action, notify_pct_*)
//
// Auth: JWT + SUPERADMIN (mesmo padrão de /admin/llm-health).
//
// Trade-off de performance: faz N+1 round trips ao Redis (1 hgetall por org).
// Aceitável até ~500 orgs. Pra escala >500: pipelinear ou usar MGET.
// Hoje (2026-05-11) são 15 orgs → ~30ms total no Redis. Sem otimização
// prematura.
// ══════════════════════════════════════════════════════════════════════════
async function quotaWatchHandler(req: Request, res: Response) {
  try {
    const now = new Date();
    const periodYearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    // ?excludeStaging=true (default) filtra orgs cujos users TODOS são
    // seed data (email @exemplo-staging.zappiq.com.br). Investigado em
    // 2026-05-11: 10 orgs "-STAGING" criadas em 16/04 com pattern
    // owner/agent1/agent2@exemplo-staging.zappiq.com.br. São fixtures de
    // teste — diluem sinal real do audit-only.
    // Use ?excludeStaging=false pra ver TUDO.
    const excludeStaging = req.query.excludeStaging !== 'false';

    // 1) Carrega todas as orgs (filtro de staging aplicado depois via SQL extra
    //    pra evitar JOIN complexo aqui).
    const orgs = (await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        plan: true,
        subscriptionStatus: true,
        isTrialActive: true,
        settings: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })) as Array<{
      id: string;
      name: string;
      plan: string;
      subscriptionStatus: string;
      isTrialActive: boolean;
      settings: any;
      createdAt: Date;
    }>;

    // 1.5) Identificar orgs "staging" (todos users com domain @exemplo-staging.zappiq.com.br)
    let stagingOrgIds = new Set<string>();
    if (excludeStaging) {
      const stagingRows = (await prisma.$queryRawUnsafe(`
        SELECT o.id
        FROM organizations o
        WHERE NOT EXISTS (
          SELECT 1 FROM users u
          WHERE u."organizationId" = o.id
          AND u.email NOT LIKE '%@exemplo-staging.zappiq.com.br'
        )
        AND EXISTS (
          SELECT 1 FROM users u WHERE u."organizationId" = o.id
        )
      `)) as Array<{ id: string }>;
      stagingOrgIds = new Set(stagingRows.map((r) => r.id));
    }
    const filteredOrgs = excludeStaging
      ? orgs.filter((o) => !stagingOrgIds.has(o.id))
      : orgs;

    // 2) Carrega usage do mês corrente em batch
    const usageRows = (await (prisma as any).TenantUsageMonthly.findMany({
      where: { periodYearMonth },
      select: {
        organizationId: true,
        aiMessagesProcessed: true,
        llmCostUsd: true,
        computedAt: true,
      },
    })) as Array<{
      organizationId: string;
      aiMessagesProcessed: number;
      llmCostUsd: number;
      computedAt: Date;
    }>;
    const usageByOrgId = new Map(usageRows.map((u) => [u.organizationId, u]));

    // 3) Carrega estado de reconciliação do Redis (paralelo, fail-soft)
    const reconcilStates = await Promise.all(
      filteredOrgs.map(async (o) => {
        try {
          const raw = (await redis.hgetall(`zappiq:reconcil:${o.id}:${periodYearMonth}`)) || {};
          return { orgId: o.id, hash: raw as Record<string, string> };
        } catch {
          return { orgId: o.id, hash: {} as Record<string, string> };
        }
      }),
    );
    const reconcilByOrgId = new Map(reconcilStates.map((r) => [r.orgId, r.hash]));

    // 4) Combina tudo
    const rows = filteredOrgs.map((o) => {
      const usage = usageByOrgId.get(o.id);
      const cfg = (PLAN_CONFIG as Record<string, PlanConfig>)[o.plan];
      const limit = cfg?.limits?.aiMessagesPerMonth ?? 0;
      const actual = usage?.aiMessagesProcessed ?? 0;
      const usagePercent = limit > 0 ? (actual / limit) * 100 : 0;

      const billing = o.settings?.billing || {};
      const reconcil = reconcilByOrgId.get(o.id) || {};

      return {
        organizationId: o.id,
        organizationName: o.name,
        plan: o.plan,
        isTrialActive: o.isTrialActive,
        subscriptionStatus: o.subscriptionStatus,
        createdAt: o.createdAt.toISOString(),
        consumption: {
          aiMessagesProcessed: actual,
          aiMessagesLimit: limit === -1 ? null : limit, // null = ilimitado
          usagePercent: limit > 0 ? Number(usagePercent.toFixed(2)) : null,
          llmCostUsd: usage?.llmCostUsd ?? 0,
          lastComputedAt: usage?.computedAt?.toISOString() ?? null,
        },
        billing: {
          autoOverage: Boolean(billing.autoOverage),
          hardCeilingBrl: billing.hardCeilingBrl ?? null,
          notifyAtPercent: typeof billing.notifyAtPercent === 'number' ? billing.notifyAtPercent : 80,
        },
        reconciliation: {
          lastRunAt: reconcil.last_run_at ?? null,
          lastAction: reconcil.last_action ?? null,
          usagePercentAtLastRun: reconcil.usage_percent ? Number(reconcil.usage_percent) : null,
          notifiedAt50: reconcil.notify_pct_50 ?? null,
          notifiedAt80: reconcil.notify_pct_80 ?? null,
          notifiedAt100: reconcil.notify_pct_100 ?? null,
        },
      };
    });

    // 5) Summary agregado
    const summary = {
      totalOrgs: rows.length,
      orgsAt50Percent: rows.filter((r) => r.consumption.usagePercent !== null && r.consumption.usagePercent >= 50 && r.consumption.usagePercent < 80).length,
      orgsAt80Percent: rows.filter((r) => r.consumption.usagePercent !== null && r.consumption.usagePercent >= 80 && r.consumption.usagePercent < 100).length,
      orgsAt100Percent: rows.filter((r) => r.consumption.usagePercent !== null && r.consumption.usagePercent >= 100).length,
      orgsWithAutoOverage: rows.filter((r) => r.billing.autoOverage).length,
      orgsTrialing: rows.filter((r) => r.isTrialActive).length,
    };

    res.json({
      period: periodYearMonth,
      summary,
      rows,
      excludeStaging,
      stagingFilteredCount: stagingOrgIds.size,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('[admin/quota-watch] erro:', err);
    res.status(500).json({ error: 'erro ao consultar quota-watch', message: err?.message });
  }
}

router.get(
  '/quota-watch',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  quotaWatchHandler,
);

router.post('/cron/run', async (req: Request, res: Response) => {
  if (!requireAdminAuth(req, res)) return;

  const job = req.body?.job;
  if (typeof job !== 'string') {
    res.status(400).json({ error: 'body { job: "tenant-usage" | "usage-reconciliation" } obrigatório' });
    return;
  }

  const t0 = Date.now();
  try {
    let result: unknown;
    if (job === 'tenant-usage') {
      logger.info('[admin/cron/run] tenant-usage manual trigger iniciado');
      result = await runTenantUsageCycle();
    } else if (job === 'usage-reconciliation') {
      logger.info('[admin/cron/run] usage-reconciliation manual trigger iniciado');
      result = await runUsageReconciliationCycle();
    } else {
      res.status(400).json({
        error: `job desconhecido: ${job}`,
        supported: ['tenant-usage', 'usage-reconciliation'],
      });
      return;
    }
    const totalMs = Date.now() - t0;
    res.json({
      ok: true,
      job,
      totalMs,
      result,
    });
  } catch (err: any) {
    logger.error('[admin/cron/run] erro:', err);
    res.status(500).json({
      ok: false,
      job,
      error: err?.message || 'erro desconhecido',
      totalMs: Date.now() - t0,
    });
  }
});

export default router;
