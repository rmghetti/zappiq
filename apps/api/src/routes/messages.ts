import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';
import { messageSendQueue } from '../services/queueService.js';

const router = Router();

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// ── GET /api/conversations/:id/messages ─────────
router.get('/:id/messages', validate(querySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = req.query as any;
    const skip = (page - 1) * limit;

    // Verify conversation belongs to org
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: req.params.id },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          sender: { select: { id: true, name: true, avatar: true } },
        },
      }),
      prisma.message.count({ where: { conversationId: req.params.id } }),
    ]);

    res.json({
      success: true,
      data: messages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/conversations/:id/messages ────────
router.post('/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, type = 'TEXT' } = req.body;
    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    // Verify conversation belongs to org
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: { contact: true },
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Save message
    const message = await prisma.message.create({
      data: {
        direction: 'OUTBOUND',
        type: type as any,
        content,
        status: 'SENT',
        conversationId: conversation.id,
        senderId: req.user!.userId,
        isFromBot: false,
      },
    });

    // Enfileira envio via WhatsApp API (BullMQ com rate limit 80/seg)
    await messageSendQueue.add('send', {
      messageId: message.id,
      conversationId: conversation.id,
      content,
      to: conversation.contact.whatsappId,
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`org:${req.organizationId}`).emit('new_message', {
        conversationId: conversation.id,
        message: {
          id: message.id,
          content: message.content,
          direction: message.direction,
          type: message.type,
          isFromBot: false,
          createdAt: message.createdAt.toISOString(),
        },
      });
    }

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
});

export default router;
