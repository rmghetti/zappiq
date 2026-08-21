/**
 * Rotas do Cost Guard (PR-H, Resposta Meta 2026, decisão D5).
 *
 * Montadas em /api/billing/cost-guard no server.ts, com o MESMO middleware
 * das rotas de billing (auth + RLS, sem requireActivePlan: o teto de custo
 * precisa ficar visível até pra org que caiu no paywall, é dinheiro dela).
 *
 *   GET  /  -> medidor: teto efetivo, gasto do mês, projeção, soft-stop.
 *   PATCH / -> ajusta o teto custom: { capBrl: número >= 10 } define,
 *              { capBrl: null } volta ao teto derivado do plano.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import { getCostGuardStatus, setMetaCostCapBrl } from '../services/costGuardService.js';

/**
 * Validação do PATCH. Mínimo R$ 10 de propósito: teto zero (ou quase) não é
 * "sem teto", é a Iza muda no primeiro balão tarifado do mês. Quem quer
 * voltar ao teto derivado do plano manda capBrl: null.
 */
export const costGuardPatchSchema = z.object({
  capBrl: z.union([z.number().finite().min(10), z.null()]),
});

const router = Router();

// GET /api/billing/cost-guard
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'organization context missing' });
      return;
    }
    const data = await getCostGuardStatus(orgId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/billing/cost-guard  body: { capBrl: number | null }
router.patch('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'organization context missing' });
      return;
    }

    const parsed = costGuardPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: 'invalid_body',
        note: 'capBrl deve ser um número >= 10 (reais) ou null para voltar ao teto derivado do plano.',
        issues: parsed.error.issues,
      });
      return;
    }

    await setMetaCostCapBrl(orgId, parsed.data.capBrl);
    // Devolve o estado já recalculado: a UI atualiza o medidor sem 2ª chamada.
    const data = await getCostGuardStatus(orgId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
