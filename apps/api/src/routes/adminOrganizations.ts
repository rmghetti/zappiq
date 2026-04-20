/**
 * Admin endpoints para gerenciamento e visualização de organizações.
 *
 * Consumido pelo dashboard executivo interno (squad ZappIQ) — nunca deve ser
 * exposto para clientes finais. Requer role SUPERADMIN.
 *
 * Rotas:
 *   GET /api/admin/organizations
 *     → lista de todas as organizações com status, plano, trial info.
 *   GET /api/admin/organizations/:orgId
 *     → detalhes completos de uma organização.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware, requireRole('SUPERADMIN'));

// GET /api/admin/organizations
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        subscriptionStatus: true,
        isTrialActive: true,
        trialStartedAt: true,
        trialEndsAt: true,
        trialConverted: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      total: organizations.length,
      organizations,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/organizations/:orgId
router.get('/:orgId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });

    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.json(org);
  } catch (err) {
    next(err);
  }
});

export default router;
