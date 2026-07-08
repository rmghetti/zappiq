import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';
import { campaignDispatchQueue } from '../services/queueService.js';
import { draftCampaignFromObjective } from '../services/impulsoStrategist.js';
import { computeCoachInsights } from '../services/impulsoCoach.js';
import { sanitizeChannels } from '../services/impulsoChannels.js';

/** Instagram só entra numa campanha se a org tiver o IG conectado (política Meta + requisito de plano). */
async function orgHasInstagram(orgId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { instagramAccountId: true },
  });
  return Boolean(org?.instagramAccountId);
}

/*
 * Rotas do módulo Impulso (add-on de campanhas). Gated por requireImpulso()
 * no mount (server.ts). Reusa o model Campaign com isImpulso=true; a
 * jornada (nodes/edges) roda no motor do Maestro.
 */
const router = Router();

// ── POST /api/impulso/draft — Iza Estrategista: objetivo em NL -> campanha ──
const draftSchema = z.object({
  objective: z.string().min(4),
  brandVoice: z.string().optional(),
  context: z.string().optional(),
});

router.post('/draft', validate(draftSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const draft = await draftCampaignFromObjective({
      orgId: req.organizationId!,
      objective: req.body.objective,
      brandVoice: req.body.brandVoice,
      context: req.body.context,
    });
    res.json({ success: true, data: draft });
  } catch (err) {
    next(err);
  }
});

// ── CRUD de campanhas Impulso ──
const createSchema = z.object({
  name: z.string().min(2),
  objective: z.string().optional(),
  type: z.enum(['BROADCAST', 'TRIGGER', 'SEQUENCE']).default('BROADCAST'),
  templateId: z.string().optional(),
  channels: z.array(z.string()).default(['whatsapp']),
  audienceFilter: z.record(z.any()).default({}),
  audienceSegment: z.record(z.any()).optional(),
  journey: z.any().optional(),
  budgetPlan: z.record(z.any()).optional(),
  optimization: z.record(z.any()).optional(),
  message: z.record(z.any()).optional(), // copy por canal: { whatsapp?, instagram?, ... }
  autonomyLevel: z.number().int().min(0).max(4).default(2),
  scheduledAt: z.string().datetime().optional(),
});

// GET /api/impulso
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { organizationId: req.organizationId!, isImpulso: true },
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { id: true, name: true } },
        _count: { select: { variants: true, attributions: true } },
      },
    });
    // Copiloto & Coach: sugestões determinísticas embutidas na listagem
    // (sem custo extra de LLM, sem round-trip adicional pro frontend).
    const withCoach = campaigns.map((c) => ({
      ...c,
      coachInsights: computeCoachInsights({
        status: c.status,
        sentCount: c.sentCount,
        deliveredCount: c.deliveredCount,
        readCount: c.readCount,
        repliedCount: c.repliedCount,
        failedCount: c.failedCount,
        budgetPlan: c.budgetPlan as any,
      }),
    }));
    res.json({ success: true, data: withCoach });
  } catch (err) {
    next(err);
  }
});

// POST /api/impulso
router.post('/', validate(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scheduledAt } = req.body;
    // Gate de Instagram server-side: remove o canal se a org não tem IG conectado.
    const hasInstagram = await orgHasInstagram(req.organizationId!);
    const channels = sanitizeChannels(req.body.channels, { hasInstagram });
    const campaign = await prisma.campaign.create({
      data: {
        ...req.body,
        channels,
        isImpulso: true,
        organizationId: req.organizationId!,
        status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
      },
    });
    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

// GET /api/impulso/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId!, isImpulso: true },
      include: { template: true, variants: true },
    });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

// PUT /api/impulso/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = { ...req.body };
    // Mesmo gate de Instagram na edição: nunca deixa uma campanha passar a
    // mirar o IG sem a org ter o Instagram conectado.
    if (data.channels !== undefined) {
      const hasInstagram = await orgHasInstagram(req.organizationId!);
      data.channels = sanitizeChannels(data.channels, { hasInstagram });
    }
    const result = await prisma.campaign.updateMany({
      where: { id: req.params.id, organizationId: req.organizationId!, isImpulso: true },
      data,
    });
    if (result.count === 0) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    const updated = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/impulso/:id/publish — dispara/agenda (enfileira no BullMQ)
router.post('/:id/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId!, isImpulso: true },
    });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'SENDING' } });
    await campaignDispatchQueue.add('dispatch', {
      campaignId: campaign.id,
      organizationId: req.organizationId!,
    });
    logger.info(`[Impulso] Campaign ${campaign.id} publicada/enfileirada`);
    res.json({ success: true, message: 'Campanha enfileirada para disparo' });
  } catch (err) {
    next(err);
  }
});

// POST /api/impulso/:id/pause
router.post('/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.campaign.updateMany({
      where: { id: req.params.id, organizationId: req.organizationId!, isImpulso: true },
      data: { status: 'CANCELLED' },
    });
    if (result.count === 0) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    res.json({ success: true, message: 'Campanha pausada' });
  } catch (err) {
    next(err);
  }
});

// GET /api/impulso/:id/stats — inclui atribuição de receita
router.get('/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId!, isImpulso: true },
      select: {
        id: true,
        name: true,
        status: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        repliedCount: true,
        failedCount: true,
        createdAt: true,
        completedAt: true,
      },
    });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    const agg = await prisma.campaignAttribution.aggregate({
      where: { campaignId: campaign.id, organizationId: req.organizationId! },
      _sum: { revenueCents: true },
    });
    const conversions = await prisma.campaignAttribution.count({
      where: { campaignId: campaign.id, organizationId: req.organizationId!, converted: true },
    });
    const total = campaign.sentCount || 1;
    res.json({
      success: true,
      data: {
        ...campaign,
        deliveryRate: Math.round((campaign.deliveredCount / total) * 100),
        readRate: Math.round((campaign.readCount / total) * 100),
        replyRate: Math.round((campaign.repliedCount / total) * 100),
        attributedConversions: conversions,
        attributedRevenueBrl: (agg._sum.revenueCents ?? 0) / 100,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/impulso/:id/coach — Copiloto & Coach isolado (para tela de detalhe futura)
router.get('/:id/coach', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId!, isImpulso: true },
      select: {
        status: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        repliedCount: true,
        failedCount: true,
        budgetPlan: true,
      },
    });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    const insights = computeCoachInsights({
      status: campaign.status,
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      readCount: campaign.readCount,
      repliedCount: campaign.repliedCount,
      failedCount: campaign.failedCount,
      budgetPlan: campaign.budgetPlan as any,
    });
    res.json({ success: true, data: { insights } });
  } catch (err) {
    next(err);
  }
});

export default router;
