import { Router, Request, Response, NextFunction } from 'express';
import { getImpulsoEntitlement, startImpulsoTrial } from '../middleware/requireImpulso.js';

/*
 * Rotas de ACESSO ao Impulso — NÃO passam pelo requireImpulso (todo cliente,
 * mesmo sem o add-on, precisa consultar seu status e poder ativar o teste).
 * Montado em /api/impulso-access (prefixo distinto de /api/impulso, que é gated).
 */
const router = Router();

// GET /api/impulso-access — status do entitlement da org (para a vitrine/paywall)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ent = await getImpulsoEntitlement(req.organizationId!);
    res.json({ success: true, data: ent });
  } catch (err) {
    next(err);
  }
});

// POST /api/impulso-access/trial — ativa o teste de 7 dias do Impulso
router.post('/trial', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await startImpulsoTrial(req.organizationId!);
    if (!result.ok) {
      res.status(409).json({
        success: false,
        error: result.reason,
        message:
          result.reason === 'already_active'
            ? 'O Impulso já está ativo nesta conta.'
            : result.reason === 'trial_active'
              ? 'O teste do Impulso já está em andamento.'
              : 'Esta conta já usou o teste do Impulso.',
        data: result.entitlement,
      });
      return;
    }
    res.json({ success: true, data: result.entitlement });
  } catch (err) {
    next(err);
  }
});

export default router;
