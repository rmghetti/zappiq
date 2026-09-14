/**
 * /api/admin/organizations/:id/flags: interruptores por organização.
 *
 * SUPERADMIN-only (authMiddleware + requireRole aplicados aqui dentro, no
 * mesmo desenho de adminOrganizations.ts: a guarda mora no próprio router,
 * então não existe jeito de montar esta rota sem ela).
 *
 * Para que serve: fundir na main publica a API e o web na hora. Todo
 * comportamento novo do plano "Treinar IA e Qualidade da IA" nasce
 * desligado; esta rota liga uma organização de cada vez, e a lista mostra o
 * registro inteiro com o prazo de remoção de cada interruptor.
 *
 * Rotas:
 *   GET /api/admin/organizations/:id/flags
 *     → registro FLAGS com o estado da organização.
 *   PUT /api/admin/organizations/:id/flags/:flag
 *     body { enabled: boolean, removeBy?: 'YYYY-MM-DD' }
 */
import { Router, Request, Response } from 'express';
import { prisma } from '@zappiq/database';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import {
  FLAGS,
  isFlagName,
  listFlags,
  setFlag,
  type FlagName,
} from '../services/featureFlags.js';

const router = Router();

router.use(authMiddleware as any, requireRole('SUPERADMIN') as any);

/** A organização existe? Interruptor de organização fantasma é lixo no banco. */
async function organizacaoExiste(id: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({ where: { id }, select: { id: true } });
  return Boolean(org);
}

// GET /api/admin/organizations/:id/flags
router.get('/:id/flags', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    if (!(await organizacaoExiste(id))) {
      res.status(404).json({ error: 'organização não encontrada' });
      return;
    }

    res.json({
      organizationId: id,
      total: Object.keys(FLAGS).length,
      flags: await listFlags(id),
    });
  } catch (err: any) {
    logger.error('[adminFeatureFlags] listar erro:', err);
    res.status(500).json({ error: 'erro ao listar interruptores', message: err?.message });
  }
});

// PUT /api/admin/organizations/:id/flags/:flag
router.put('/:id/flags/:flag', async (req: Request, res: Response) => {
  const { id, flag } = req.params;
  const { enabled, removeBy } = (req.body ?? {}) as { enabled?: unknown; removeBy?: unknown };

  if (!isFlagName(flag)) {
    res.status(400).json({
      error: 'interruptor desconhecido',
      message: `"${flag}" não está no registro. Válidos: ${Object.keys(FLAGS).join(', ')}`,
    });
    return;
  }
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled precisa ser true ou false' });
    return;
  }
  if (removeBy !== undefined && removeBy !== null) {
    if (typeof removeBy !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(removeBy)) {
      res.status(400).json({ error: 'removeBy precisa estar no formato AAAA-MM-DD' });
      return;
    }
  }

  try {
    if (!(await organizacaoExiste(id))) {
      res.status(404).json({ error: 'organização não encontrada' });
      return;
    }

    const actor =
      (req as any).user?.email || (req as any).user?.userId || 'superadmin';

    await setFlag(id, flag as FlagName, enabled, actor, (removeBy as string) ?? undefined);

    res.json({
      ok: true,
      organizationId: id,
      flag,
      enabled,
      descricao: FLAGS[flag as FlagName].descricao,
      removeBy: (removeBy as string) ?? FLAGS[flag as FlagName].removeBy,
    });
  } catch (err: any) {
    logger.error('[adminFeatureFlags] alterar erro:', err);
    res.status(500).json({ error: 'erro ao alterar interruptor', message: err?.message });
  }
});

export default router;
