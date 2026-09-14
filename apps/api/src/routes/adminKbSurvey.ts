/* ══════════════════════════════════════════════════════════════════════
 * Rota interna para reingerir o questionário de uma organização.
 * --------------------------------------------------------------------
 * Por que existe: o formato do documento do questionário mudou (um por
 * seção, com o texto das perguntas). O conteúdo antigo continua no vetor
 * até alguém reingerir, e não dá para esperar o próximo salvamento do
 * cliente, que pode não vir nunca. Depois do deploy, quem opera dispara
 * esta rota por organização e acompanha pelo estado em settings.surveySync.
 *
 * Ela só ENFILEIRA: quem executa é o mesmo job do salvamento, com o mesmo
 * id por organização, então disparar duas vezes seguidas continua sendo
 * uma execução só.
 * ══════════════════════════════════════════════════════════════════════ */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '@zappiq/database';

import { authMiddleware, requireRole } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import {
  agendarReingestaoDoQuestionario,
  marcarSincronizacaoPendente,
} from '../services/surveyReingest.js';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/admin/kb/survey-reingest/:orgId
 *
 * Enfileira a reingestão do questionário de UMA organização. Sem corpo.
 * Devolve 404 quando a organização não existe.
 */
router.post(
  '/survey-reingest/:orgId',
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = String(req.params.orgId || '').trim();
      if (!orgId) {
        res.status(400).json({ error: 'Informe a organização.' });
        return;
      }

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true },
      });
      if (!org) {
        res.status(404).json({ error: 'Organização não encontrada.' });
        return;
      }

      await marcarSincronizacaoPendente(orgId).catch((err: any) =>
        logger.warn(`[adminKbSurvey] marcar pendente falhou: ${err?.message}`),
      );
      const agendamento = await agendarReingestaoDoQuestionario(orgId);

      logger.info({
        msg: 'survey_reingest_enfileirado_pelo_admin',
        organizationId: orgId,
        acao: agendamento.acao,
      });

      res.json({ success: true, organizationId: orgId, ...agendamento });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
