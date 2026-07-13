import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { listMiraTiers, listMiraPacks, MIRA_INCLUDED_TIER_BY_PLAN } from '@zappiq/shared';
import { getMiraEntitlement } from '../middleware/requireMira.js';

/*
 * Rotas de ACESSO ao Mira Prospects — NÃO passam pelo requireMira (todo
 * cliente, mesmo sem o add-on, consulta seu status para ver a vitrine
 * de ativação). Montado em /api/mira-access (prefixo distinto de
 * /api/mira, que é gated). Espelha o padrão do Impulso.
 */
const router = Router();

// GET /api/mira-access — entitlement + cota + catálogo de faixas/packs
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const ent = await getMiraEntitlement(orgId);
    // Prontidão do Perfil de Prospecção (survey do módulo)
    const perfil = await (prisma as any).miraPerfil.findUnique({
      where: { organizationId: orgId },
      select: { prontidao: true, updatedAt: true },
    });
    res.json({
      success: true,
      data: {
        ...ent,
        perfil: perfil ? { prontidao: perfil.prontidao, updatedAt: perfil.updatedAt } : null,
        catalog: {
          tiers: listMiraTiers(),
          packs: listMiraPacks(),
          includedByPlan: MIRA_INCLUDED_TIER_BY_PLAN,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
