import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ── Schemas ─────────────────────────────────────
const createContactSchema = z.object({
  phone: z.string().min(10),
  name: z.string().optional(),
  email: z.string().email().optional(),
  company: z.string().optional(),
  tags: z.array(z.string()).optional(),
  leadStatus: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED']).optional(),
});

const updateContactSchema = createContactSchema.partial();

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED']).optional(),
  tag: z.string().optional(),
});

// ── GET /api/contacts ───────────────────────────
router.get('/', validate(querySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search, status, tag } = req.query as any;
    const skip = (page - 1) * limit;

    const where: Prisma.ContactWhereInput = {
      organizationId: req.organizationId!,
      ...(status && { leadStatus: status }),
      ...(tag && { tags: { has: tag } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastInteractionAt: 'desc' },
      }),
      prisma.contact.count({ where }),
    ]);

    res.json({
      success: true,
      data: contacts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/contacts ──────────────────────────
router.post('/', validate(createContactSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contact = await prisma.contact.create({
      data: {
        ...req.body,
        whatsappId: req.body.phone,
        organizationId: req.organizationId!,
      },
    });

    res.status(201).json({ success: true, data: contact });
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Contact with this phone already exists' });
      return;
    }
    next(err);
  }
});

// ── GET /api/contacts/:id ───────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: {
        conversations: { orderBy: { updatedAt: 'desc' }, take: 5 },
        deals: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    res.json({ success: true, data: contact });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/contacts/:id ───────────────────────
router.put('/:id', validate(updateContactSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contact = await prisma.contact.updateMany({
      where: { id: req.params.id, organizationId: req.organizationId! },
      data: req.body,
    });

    if (contact.count === 0) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    const updated = await prisma.contact.findUnique({ where: { id: req.params.id } });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/contacts/:id ────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.contact.deleteMany({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    res.json({ success: true, message: 'Contact deleted' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/contacts/export ────────────────────
router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { createdAt: 'desc' },
    });

    // CSV export
    const header = 'name,phone,email,company,leadStatus,tags,leadScore,createdAt\n';
    const rows = contacts.map(c =>
      `"${c.name || ''}","${c.phone}","${c.email || ''}","${c.company || ''}","${c.leadStatus}","${c.tags.join(';')}",${c.leadScore},"${c.createdAt.toISOString()}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
    res.send(header + rows);
  } catch (err) {
    next(err);
  }
});

export default router;
