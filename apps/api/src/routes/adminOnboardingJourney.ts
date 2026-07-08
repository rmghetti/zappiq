/**
 * /api/admin/onboarding-journey (FASE 1.B #240)
 *
 * SUPERADMIN-only. 3 endpoints:
 *   POST /trigger        → roda scheduler manual (testa antes do 14:00 UTC diário)
 *   GET  /state          → lista state de onboarding por org (audit)
 *   POST /send-now       → força disparo de stage específico pra uma org
 *
 * Útil pra testar mudanças no fluxo sem esperar 24h.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  runTrialFollowupScheduler,
  enqueueTrialFollowup,
  type TrialStage,
} from '../services/trialFollowupService.js';

const router = Router();

router.post(
  '/trigger',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (_req: Request, res: Response) => {
    try {
      logger.info('[onboardingJourney] manual trigger via admin endpoint');
      await runTrialFollowupScheduler();
      res.json({ ok: true, message: 'Scheduler triggered manually' });
    } catch (err: any) {
      logger.error('[onboardingJourney] trigger erro:', err);
      res.status(500).json({ error: 'erro ao triggar scheduler', message: err?.message });
    }
  },
);

router.get(
  '/state',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    try {
      const orgId = req.query.orgId ? String(req.query.orgId) : undefined;
      const limit = Math.min(Number(req.query.limit) || 50, 200);

      const where: any = {};
      if (orgId) where.organizationId = orgId;

      const states = await prisma.onboardingJourneyState.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: limit,
        include: {
          organization: { select: { id: true, name: true, plan: true, isTrialActive: true } },
        },
      });

      // Resumo agregado por org/stage (útil pro dashboard)
      const summary = {
        total: states.length,
        byStage: states.reduce((acc: Record<string, number>, s: { stage: string }) => {
          acc[s.stage] = (acc[s.stage] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      res.json({ summary, states });
    } catch (err: any) {
      logger.error('[onboardingJourney] state erro:', err);
      res.status(500).json({ error: 'erro ao buscar state', message: err?.message });
    }
  },
);

router.post(
  '/send-now',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    try {
      const orgId = String(req.body?.orgId || '');
      const stage = String(req.body?.stage || '') as TrialStage;
      const validStages: TrialStage[] = ['D1', 'T3', 'T2', 'T1', 'T0'];
      if (!orgId || !validStages.includes(stage)) {
        res.status(400).json({ error: 'orgId + stage (D1|T3|T2|T1|T0) obrigatórios' });
        return;
      }

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        include: {
          // FASE 3 P0b fix (2026-05-14): aceita SUPERADMIN também — orgs criadas
          // pelo CEO ou time interno têm role SUPERADMIN, não ADMIN.
          users: {
            where: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
            select: { id: true, email: true },
            take: 1,
          },
        },
      });
      if (!org) {
        res.status(404).json({ error: `org ${orgId} não encontrada` });
        return;
      }
      const adminUser = (org as any).users[0];
      if (!adminUser) {
        res.status(400).json({ error: 'org sem ADMIN user' });
        return;
      }

      await enqueueTrialFollowup(orgId, adminUser.id, `trial:${stage}` as any);
      res.json({
        ok: true,
        message: `Job trial:${stage} enfileirado para ${adminUser.email}`,
        orgId,
        stage,
      });
    } catch (err: any) {
      logger.error('[onboardingJourney] send-now erro:', err);
      res.status(500).json({ error: 'erro ao enfileirar', message: err?.message });
    }
  },
);

export default router;
