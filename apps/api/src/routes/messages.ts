import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';
import { messageSendQueue } from '../services/queueService.js';
// C1b (Passo 3, A158): a resposta humana a uma conversa do chat do site sai
// pelo canal 'site' do despachante (socket da sessão do visitante), nunca
// pela fila do WhatsApp.
import { sendReplyText } from '../services/channelDispatcher.js';
import { withTenant } from '../middleware/rlsTenant.js';
import { cache } from '../services/cloud/index.js';
import {
  messagesQuerySchema,
  buildMessagesFindArgs,
  buildMessagesPayload,
} from './messages.pagination.js';

const router = Router();

// ── GET /api/conversations/:id/messages ─────────
// V2-024: encapsulado em withTenant — verify conversation + load messages
// na MESMA transaction (consistência + RLS no pgbouncer transaction-mode).
// W2.3: retorna a JANELA MAIS RECENTE (desc + reverse → payload cronológico).
// Suporta `?before=<messageId>` para "carregar anteriores" (cursor keyset).
router.get('/:id/messages', validate(messagesQuerySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as any;

    const result = await withTenant(req, async (tx) => {
      // Verify conversation belongs to org
      const conversation = await tx.conversation.findFirst({
        where: { id: req.params.id, organizationId: req.organizationId! },
      });
      if (!conversation) return null;

      const [messagesDesc, total] = await Promise.all([
        tx.message.findMany(buildMessagesFindArgs(req.params.id, query)),
        tx.message.count({ where: { conversationId: req.params.id } }),
      ]);
      return { messagesDesc, total };
    });

    if (!result) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const { data, nextBefore, hasMore } = buildMessagesPayload(result.messagesDesc, query);

    res.json({
      success: true,
      data,
      total: result.total,
      limit: query.limit,
      nextBefore,
      hasMore,
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

      // W3.4 — humano respondeu: assume a conversa e PAUSA a Iza nesta conversa.
      // Antes, IA e humano falavam com o cliente ao mesmo tempo. Agora o envio
      // manual atribui (assignedToId) + marca ASSIGNED + aiPaused=true na MESMA
      // transação do message.create (atomicidade). O orchestrator checa esse
      // estado antes de responder e não gera autoreply enquanto pausado.
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          assignedToId: req.user!.userId,
          status: 'ASSIGNED',
          aiPaused: true,
        },
      });

      return { conversation, message };
    });

    if (!result) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const { conversation, message } = result;

    // W3.4 — espelha a pausa no cache (fast-path que o orchestrator e o
    // flowScheduler já consultam: ai_paused:<org>:<phone> com valor != 'autoreply').
    // fail-soft por contrato; a fonte de verdade durável é conversation.aiPaused.
    await cache.set(
      `ai_paused:${req.organizationId}:${conversation.contact.whatsappId}`,
      'human',
      60 * 60 * 24 * 7,
    );

    if (conversation.channel === 'web') {
      // C1b (Passo 3, A158): conversa do chat do site. O contato é
      // `web:<sessão>`, que não é telefone: a fila do WhatsApp mandava a
      // resposta humana para a Cloud API e o visitante nunca a via. Aqui ela
      // sai pelo canal 'site' do despachante, que emite na sala da sessão do
      // visitante. A mensagem já está gravada acima, na mesma transação: se
      // o visitante saiu, ou o socket falhar, ela aparece quando ele voltar.
      try {
        await sendReplyText({
          organizationId: req.organizationId!,
          conversationId: conversation.id,
          content,
          messageId: message.id,
        });
      } catch (err) {
        logger.warn('[Messages] entrega no chat do site falhou (a mensagem ficou gravada)', {
          conversationId: conversation.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      // Enfileira envio via WhatsApp API (BullMQ com rate limit 80/seg)
      await messageSendQueue.add('send', {
        messageId: message.id,
        conversationId: conversation.id,
        content,
        to: conversation.contact.whatsappId,
      });
    }

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
