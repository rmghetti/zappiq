import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';
import { campaignDispatchQueue } from '../services/queueService.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['BROADCAST', 'TRIGGER', 'SEQUENCE']),
  templateId: z.string().optional(),
  audienceFilter: z.record(z.any()).default({}),
  scheduledAt: z.string().datetime().optional(),
});

// GET /api/campaigns
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { createdAt: 'desc' },
      include: { template: { select: { id: true, name: true } } },
    });
    res.json({ success: true, data: campaigns });
  } catch (err) { next(err); }
});

// POST /api/campaigns
router.post('/', validate(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await prisma.campaign.create({
      data: {
        ...req.body,
        organizationId: req.organizationId!,
        status: req.body.scheduledAt ? 'SCHEDULED' : 'DRAFT',
      },
    });
    res.status(201).json({ success: true, data: campaign });
  } catch (err) { next(err); }
});

// GET /api/campaigns/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: { template: true },
    });
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }
    res.json({ success: true, data: campaign });
  } catch (err) { next(err); }
});

// PUT /api/campaigns/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.campaign.updateMany({
      where: { id: req.params.id, organizationId: req.organizationId! },
      data: req.body,
    });
    if (result.count === 0) { res.status(404).json({ error: 'Campaign not found' }); return; }
    const updated = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// DELETE /api/campaigns/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.campaign.deleteMany({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (result.count === 0) { res.status(404).json({ error: 'Campaign not found' }); return; }
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (err) { next(err); }
});

// POST /api/campaigns/:id/send
router.post('/:id/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'SENDING' },
    });

    // Enfileira despacho da campanha via BullMQ
    await campaignDispatchQueue.add('dispatch', {
      campaignId: campaign.id,
      organizationId: req.organizationId!,
    });
    logger.info(`[Campaign] Campaign ${campaign.id} queued for dispatch`);

    res.json({ success: true, message: 'Campaign queued for sending' });
  } catch (err) { next(err); }
});

// GET /api/campaigns/:id/stats
router.get('/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      select: {
        id: true, name: true, status: true,
        sentCount: true, deliveredCount: true, readCount: true, repliedCount: true, failedCount: true,
        createdAt: true, completedAt: true,
      },
    });
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }

    const total = campaign.sentCount || 1;
    res.json({
      success: true,
      data: {
        ...campaign,
        deliveryRate: Math.round((campaign.deliveredCount / total) * 100),
        readRate: Math.round((campaign.readCount / total) * 100),
        replyRate: Math.round((campaign.repliedCount / total) * 100),
      },
    });
  } catch (err) { next(err); }
});

export default router;
