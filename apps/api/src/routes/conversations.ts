import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';

const router = Router();

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(30),
  status: z.enum(['OPEN', 'WAITING', 'ASSIGNED', 'CLOSED']).optional(),
  assignedToId: z.string().optional(),
});

// ── GET /api/conversations ──────────────────────
router.get('/', validate(querySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, status, assignedToId } = req.query as any;
    const skip = (page - 1) * limit;

    const where: Prisma.ConversationWhereInput = {
      organizationId: req.organizationId!,
      ...(status && { status }),
      ...(assignedToId && { assignedToId }),
    };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          contact: { select: { id: true, name: true, phone: true, avatarUrl: true, leadStatus: true } },
          assignedTo: { select: { id: true, name: true, avatar: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { messages: true } },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    res.json({
      success: true,
      data: conversations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/conversations/:id ──────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: {
        contact: true,
        assignedTo: { select: { id: true, name: true, avatar: true } },
        internalNotes: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/conversations/:id/assign ───────────
router.put('/:id/assign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.body;

    const conversation = await prisma.conversation.updateMany({
      where: { id: req.params.id, organizationId: req.organizationId! },
      data: {
        assignedToId: agentId || null,
        status: agentId ? 'ASSIGNED' : 'OPEN',
      },
    });

    if (conversation.count === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`org:${req.organizationId}`).emit('conversation_assigned', {
        conversationId: req.params.id,
        agentId,
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/conversations/:id/close ────────────
router.put('/:id/close', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await prisma.conversation.updateMany({
      where: { id: req.params.id, organizationId: req.organizationId! },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    if (conversation.count === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`org:${req.organizationId}`).emit('conversation_closed', {
        conversationId: req.params.id,
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/conversations/:id/notes ───────────
router.post('/:id/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content } = req.body;
    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const note = await prisma.internalNote.create({
      data: {
        content,
        authorId: req.user!.userId,
        conversationId: req.params.id,
      },
    });

    res.status(201).json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
});

export default router;
