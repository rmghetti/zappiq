import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { META_TEMPLATE_CATEGORIES } from '../utils/messageTemplate.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(2),
  category: z.enum(META_TEMPLATE_CATEGORIES).default('MARKETING'),
  language: z.string().default('pt_BR'),
  headerType: z.string().optional(),
  headerContent: z.string().optional(),
  bodyText: z.string().min(1),
  footerText: z.string().optional(),
  buttons: z.any().optional(),
  // FEATURE 5b.2 — template pra REABRIR a janela de 24h da Meta.
  isReengagement: z.boolean().default(false),
});

// PUT aceita subconjunto editável. metaStatus/metaTemplateId NÃO são editáveis
// aqui (só o fluxo /submit os altera). Evita que o cliente marque um template
// como APPROVED sem passar pela Meta.
const updateSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.enum(META_TEMPLATE_CATEGORIES).optional(),
  language: z.string().optional(),
  headerType: z.string().nullable().optional(),
  headerContent: z.string().nullable().optional(),
  bodyText: z.string().min(1).optional(),
  footerText: z.string().nullable().optional(),
  buttons: z.any().optional(),
  isReengagement: z.boolean().optional(),
});

// CRUD
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.messageTemplate.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: templates });
  } catch (err) { next(err); }
});

router.post('/', validate(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.messageTemplate.create({
      data: { ...req.body, organizationId: req.organizationId! },
    });
    res.status(201).json({ success: true, data: template });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const t = await prisma.messageTemplate.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!t) { res.status(404).json({ error: 'Template not found' }); return; }
    res.json({ success: true, data: t });
  } catch (err) { next(err); }
});

router.put('/:id', validate(updateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.messageTemplate.updateMany({ where: { id: req.params.id, organizationId: req.organizationId! }, data: req.body });
    if (result.count === 0) { res.status(404).json({ error: 'Template not found' }); return; }
    const updated = await prisma.messageTemplate.findUnique({ where: { id: req.params.id } });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.messageTemplate.deleteMany({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (result.count === 0) { res.status(404).json({ error: 'Template not found' }); return; }
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) { next(err); }
});

// POST /api/templates/:id/submit — submit to Meta for approval
router.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.messageTemplate.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!template) { res.status(404).json({ error: 'Template not found' }); return; }

    // Submeter template à Meta Graph API para aprovação
    const metaRes = await fetch(
      `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: template.name,
          category: template.category,
          language: template.language,
          components: [
            ...(template.headerType
              ? [{ type: 'HEADER', format: template.headerType, text: template.headerContent }]
              : []),
            { type: 'BODY', text: template.bodyText },
            ...(template.footerText ? [{ type: 'FOOTER', text: template.footerText }] : []),
            ...(template.buttons ? [{ type: 'BUTTONS', buttons: template.buttons }] : []),
          ],
        }),
      },
    );

    const metaBody = await metaRes.json() as { id?: string; status?: string; error?: { message: string } };

    if (!metaRes.ok) {
      logger.error(`[Template] Meta API rejected ${template.name}: ${metaBody.error?.message}`);
      await prisma.messageTemplate.update({
        where: { id: template.id },
        data: { metaStatus: 'REJECTED' },
      });
      res.status(metaRes.status).json({ success: false, error: metaBody.error?.message || 'Meta API error' });
      return;
    }

    await prisma.messageTemplate.update({
      where: { id: template.id },
      data: {
        metaStatus: metaBody.status || 'SUBMITTED',
        metaTemplateId: metaBody.id || null,
      },
    });

    logger.info(`[Template] Submitted ${template.name} to Meta — id=${metaBody.id}, status=${metaBody.status}`);
    res.json({ success: true, message: 'Template submitted for Meta approval', data: { metaTemplateId: metaBody.id, metaStatus: metaBody.status } });
  } catch (err) { next(err); }
});

export default router;
