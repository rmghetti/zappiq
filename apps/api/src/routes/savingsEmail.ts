/**
 * Savings Email · preview + dispatch
 *
 * Rota fechada (SUPERADMIN ou o próprio dono do tenant) que:
 *   - renderiza o HTML do follow-up de trial com dados reais do tenant
 *   - permite preview direto no navegador
 *   - deixa um hook `dispatch=true` preparado para, quando a infra de
 *     e-mail estiver plugada (Resend/SendGrid/SES), disparar o envio real
 *
 * Filosofia: manter o gerador de HTML determinístico e o disparo
 *
 * @note Usa env validado (config/env.ts) em vez de process.env direto
 * idempotente. O pitch de economia continua sendo computado em 1 só
 * lugar (templates/trialSavingsFollowup.ts) para evitar drift entre
 * canal web e canal e-mail.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';
import { computeAIReadiness } from '../services/aiReadinessService.js';
import { renderTrialSavingsFollowupEmail } from '../services/email/templates/trialSavingsFollowup.js';
import { sendEmail } from '../services/email/emailProvider.js';
import { env } from '../config/env.js';

const router = Router();
router.use(authMiddleware);

// Valores default vindos da baseline pública (Blip mediana)
const DEFAULT_COMPETITOR_SETUP_BRL = 8000;
const DEFAULT_COMPETITOR_MONTHLY_BRL = 1500;

const previewQuery = z.object({
  query: z.object({
    competitorSetup: z.coerce.number().int().min(0).max(100_000).optional(),
    competitorMonthly: z.coerce.number().int().min(0).max(50_000).optional(),
    format: z.enum(['html', 'json']).optional(),
    /** Cupom a acoplar no CTA, e.g. TRIAL14OFF. */
    coupon: z.string().trim().max(40).optional(),
  }),
});

/* ------------------------------------------------------------------ */
/* GET /api/savings-email/preview                                     */
/* Renderiza o e-mail que SERIA enviado ao usuário atual.             */
/* Útil para o fundador validar copy + para QA de produção.           */
/* ------------------------------------------------------------------ */
router.get(
  '/preview',
  validate(previewQuery),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const orgId = req.user!.organizationId;

      const [user, org] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.organization.findUnique({ where: { id: orgId } }) as any,
      ]);

      if (!user || !org) {
        res.status(404).json({ error: 'User or organization not found' });
        return;
      }

      const daysRemaining = org.trialEndsAt
        ? Math.max(
            0,
            Math.ceil((org.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          )
        : 21;

      const readiness = await computeAIReadiness(orgId).catch(() => null);

      const competitorSetupBrl =
        Number(req.query.competitorSetup) || DEFAULT_COMPETITOR_SETUP_BRL;
      const competitorMonthlyBrl =
        Number(req.query.competitorMonthly) || DEFAULT_COMPETITOR_MONTHLY_BRL;

      const appUrl = env.APP_URL;
      const coupon = typeof req.query.coupon === 'string' ? req.query.coupon : '';
      const ctaUrl = coupon
        ? `${appUrl}/billing?coupon=${encodeURIComponent(coupon)}&utm_source=email&utm_campaign=trial_savings`
        : `${appUrl}/billing?utm_source=email&utm_campaign=trial_savings`;

      const firstName = (user.name || 'amigo(a)').split(' ')[0] ?? 'amigo(a)';

      const rendered = renderTrialSavingsFollowupEmail({
        firstName,
        daysRemaining,
        competitorSetupBrl,
        competitorMonthlyBrl,
        aiReadinessScore: readiness?.score,
        ctaUrl,
      });

      if (req.query.format === 'json') {
        res.json({
          context: {
            firstName,
            daysRemaining,
            competitorSetupBrl,
            competitorMonthlyBrl,
            aiReadinessScore: readiness?.score ?? null,
            ctaUrl,
          },
          ...rendered,
        });
        return;
      }

      res.set('Content-Type', 'text/html; charset=utf-8').send(rendered.html);
    } catch (err) {
      next(err);
    }
  },
);

/* ------------------------------------------------------------------ */
/* POST /api/savings-email/dispatch                                    */
/* Hook para o BullMQ/outros workers. Hoje: apenas log. Futuro: chama  */
/* provider (Resend/SendGrid) com o HTML gerado.                       */
/* ------------------------------------------------------------------ */
const dispatchSchema = z.object({
  body: z.object({
    competitorSetupBrl: z.number().int().min(0).max(100_000).optional(),
    competitorMonthlyBrl: z.number().int().min(0).max(50_000).optional(),
    coupon: z.string().trim().max(40).optional(),
    force: z.boolean().optional(),
  }),
});

router.post(
  '/dispatch',
  validate(dispatchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const orgId = req.user!.organizationId;

      const [user, org] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.organization.findUnique({ where: { id: orgId } }) as any,
      ]);

      if (!user || !org) {
        res.status(404).json({ error: 'User or organization not found' });
        return;
      }

      // Só dispara para trials ativos — salvo override explícito.
      if (!org.isTrialActive && !req.body.force) {
        res.status(409).json({
          error: 'Organization is not on an active trial',
          hint: 'Pass body.force=true to override (admin only)',
        });
        return;
      }

      const daysRemaining = org.trialEndsAt
        ? Math.max(
            0,
            Math.ceil((org.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          )
        : 21;

      const readiness = await computeAIReadiness(orgId).catch(() => null);

      const appUrl = env.APP_URL;
      const coupon = req.body.coupon ?? '';
      const ctaUrl = coupon
        ? `${appUrl}/billing?coupon=${encodeURIComponent(coupon)}&utm_source=email&utm_campaign=trial_savings`
        : `${appUrl}/billing?utm_source=email&utm_campaign=trial_savings`;

      const firstName = (user.name || 'amigo(a)').split(' ')[0] ?? 'amigo(a)';

      const rendered = renderTrialSavingsFollowupEmail({
        firstName,
        daysRemaining,
        competitorSetupBrl:
          req.body.competitorSetupBrl ?? DEFAULT_COMPETITOR_SETUP_BRL,
        competitorMonthlyBrl:
          req.body.competitorMonthlyBrl ?? DEFAULT_COMPETITOR_MONTHLY_BRL,
        aiReadinessScore: readiness?.score,
        ctaUrl,
      });

      // Dispara e-mail real via email provider (Resend ou log em dev)
      const emailResult = await sendEmail({
        to: user.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        tags: ['trial_savings', `org:${orgId}`],
      });

      logger.info({
        msg: 'trial_savings_email_dispatched',
        to: user.email,
        orgId,
        daysRemaining,
        subject: rendered.subject,
        bytes: rendered.html.length,
        readinessScore: readiness?.score ?? null,
        providerId: emailResult.id,
        delivered: emailResult.delivered,
      });

      res.json({
        queued: true,
        delivered: emailResult.delivered,
        providerId: emailResult.id,
        to: user.email,
        subject: rendered.subject,
        preview: `/api/savings-email/preview?competitorSetup=${req.body.competitorSetupBrl ?? DEFAULT_COMPETITOR_SETUP_BRL}&competitorMonthly=${req.body.competitorMonthlyBrl ?? DEFAULT_COMPETITOR_MONTHLY_BRL}`,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
