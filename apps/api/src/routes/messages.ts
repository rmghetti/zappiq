import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';
import { messageSendQueue } from '../services/queueService.js';
import { withTenant } from '../middleware/rlsTenant.js';

const router = Router();

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// ── GET /api/conversations/:id/messages ─────────
// V2-024: encapsulado em withTenant — verify conversation + load messages
// na MESMA transaction (consistência + RLS no pgbouncer transaction-mode).
router.get('/:id/messages', validate(querySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = req.query as any;
    const skip = (page - 1) * limit;

    const result = await withTenant(req, async (tx) => {
      // Verify conversation belongs to org
      const conversation = await tx.conversation.findFirst({
        where: { id: req.params.id, organizationId: req.organizationId! },
      });
      if (!conversation) return null;

      const [messages, total] = await Promise.all([
        tx.message.findMany({
          where: { conversationId: req.params.id },
          skip,
          take: limit,
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, name: true, avatar: true } },
          },
        }),
        tx.message.count({ where: { conversationId: req.params.id } }),
      ]);
      return { messages, total };
    });

    if (!result) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.json({
      success: true,
      data: result.messages,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/conversations/:id/messages ────────
// V2-024: verify + create na mesma transaction. Garante atomicidade
// (se message.create falha, conversation lookup também rollback).
router.post('/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, type = 'TEXT' } = req.body;
    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const result = await withTenant(req, async (tx) => {
      // Verify conversation belongs to org
      const conversation = await tx.conversation.findFirst({
        where: { id: req.params.id, organizationId: req.organizationId! },
        include: { contact: true },
      });
      if (!conversation) return null;

      // Save message
      const message = await tx.message.create({
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
      return { conversation, message };
    });

    if (!result) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const { conversation, message } = result;

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
