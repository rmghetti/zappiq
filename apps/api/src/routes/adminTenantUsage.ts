/**
 * Admin endpoints para visualização de unit economics por tenant.
 *
 * Consumido pelo dashboard executivo interno (squad ZappIQ) — nunca deve ser
 * exposto para clientes finais. Requer role SUPERADMIN.
 *
 * Rotas:
 *   GET /api/admin/tenant-usage/summary?period=YYYY-MM
 *     → linha por tenant com margem, custo, receita no período.
 *   GET /api/admin/tenant-usage/:orgId
 *     → série histórica dos últimos 6 meses.
 *   POST /api/admin/tenant-usage/recompute
 *     → força ciclo imediato (útil depois de ajuste de pricing ou câmbio).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { runTenantUsageCycle, currentYearMonth } from '../services/tenantUsageService.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(authMiddleware, requireRole('SUPERADMIN'));

// GET /api/admin/tenant-usage/summary?period=YYYY-MM
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || currentYearMonth();
    const rows = await (prisma as any).TenantUsageMonthly.findMany({
      where: { periodYearMonth: period },
      orderBy: { grossMarginPercent: 'asc' }, // piores margens primeiro — sinal de intervenção
      include: {
        organization: true,
      },
    }) as any[];

    // Totais agregados para o board
    const totals = rows.reduce(
      (acc: { revenueBrlCents: number; llmCostUsd: number; infraCostUsd: number; tenants: number; aiMessages: number }, r: any) => {
        acc.revenueBrlCents += r.revenueBrlCents;
        acc.llmCostUsd += r.llmCostUsd;
        acc.infraCostUsd += r.infraCostUsd;
        acc.tenants += 1;
        acc.aiMessages += r.aiMessagesProcessed;
        return acc;
      },
      { revenueBrlCents: 0, llmCostUsd: 0, infraCostUsd: 0, tenants: 0, aiMessages: 0 },
    );

    res.json({
      period,
      totals: {
        tenants: totals.tenants,
        revenueBrl: totals.revenueBrlCents / 100,
        costUsd: totals.llmCostUsd + totals.infraCostUsd,
        llmCostUsd: totals.llmCostUsd,
        infraCostUsd: totals.infraCostUsd,
        aiMessagesProcessed: totals.aiMessages,
      },
      rows: rows.map((r: any) => ({
        organizationId: r.organizationId,
        organizationName: r.organization.name,
        plan: r.organization.plan,
        subscriptionStatus: r.organization.subscriptionStatus,
        isTrialActive: r.organization.isTrialActive,
        revenueBrl: r.revenueBrlCents / 100,
        llmCostUsd: r.llmCostUsd,
        infraCostUsd: r.infraCostUsd,
        grossMarginPercent: r.grossMarginPercent,
        aiMessagesProcessed: r.aiMessagesProcessed,
        conversationsOpened: r.conversationsOpened,
        conversationsAiResolved: r.conversationsAiResolved,
        conversationsHumanResolved: r.conversationsHumanResolved,
        handoffsCount: r.handoffsCount,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/tenant-usage/:orgId
router.get('/:orgId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;

    const history = await (prisma as any).TenantUsageMonthly.findMany({
      where: { organizationId: orgId },
      orderBy: { periodYearMonth: 'desc' },
      take: 6,
    });

    const org = (await prisma.organization.findUnique({
      where: { id: orgId },
    })) as any;

    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.json({
      organization: org,
      history: history.map((r: any) => ({
        period: r.periodYearMonth,
        revenueBrl: r.revenueBrlCents / 100,
        llmCostUsd: r.llmCostUsd,
        infraCostUsd: r.infraCostUsd,
        grossMarginPercent: r.grossMarginPercent,
        aiMessagesProcessed: r.aiMessagesProcessed,
        broadcastsSent: r.broadcastsSent,
        conversationsOpened: r.conversationsOpened,
        conversationsClosed: r.conversationsClosed,
        conversationsAiResolved: r.conversationsAiResolved,
        conversationsHumanResolved: r.conversationsHumanResolved,
        handoffsCount: r.handoffsCount,
        computedAt: r.computedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/tenant-usage/recompute — força agregação imediata
router.post('/recompute', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('[AdminTenantUsage] Recompute manual solicitado');
    const result = await runTenantUsageCycle();
    res.json({ ok: true, result });
  } catch (err) {
    next(err);
  }
});

export default router;
