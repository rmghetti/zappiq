import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { logAuditEvent } from '../services/auditService.js';
import { cache } from '../services/cloud/index.js';
import {
  aiPauseCacheKey,
  AI_PAUSE_HUMAN_VALUE,
  AI_PAUSE_TTL_SECONDS,
  planAssign,
  planReopen,
  planResumeAi,
} from './conversations.handoff.js';

const router = Router();

/** Espelha o estado de pausa da IA no cache (fast-path). fail-soft por contrato. */
async function mirrorPauseCache(
  effect: 'pause' | 'resume' | 'none',
  organizationId: string,
  contactPhone: string,
) {
  if (effect === 'none') return;
  const key = aiPauseCacheKey(organizationId, contactPhone);
  if (effect === 'pause') {
    await cache.set(key, AI_PAUSE_HUMAN_VALUE, AI_PAUSE_TTL_SECONDS);
  } else {
    await cache.del(key);
  }
}

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(30),
  status: z.enum(['OPEN', 'WAITING', 'ASSIGNED', 'CLOSED']).optional(),
  assignedToId: z.string().optional(),
  includeDeleted: z.coerce.boolean().default(false),
});

// ── GET /api/conversations ──────────────────────
router.get('/', validate(querySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, status, assignedToId, includeDeleted } = req.query as any;
    const skip = (page - 1) * limit;

    // includeDeleted só vale para ADMIN/AUDITOR (já ranqueia conversas soft-deleted)
    const canSeeDeleted = includeDeleted && ['ADMIN', 'AUDITOR'].includes(req.user!.role);

    const where: Prisma.ConversationWhereInput = {
      organizationId: req.organizationId!,
      ...(status && { status }),
      ...(assignedToId && { assignedToId }),
      ...(canSeeDeleted ? {} : { deletedAt: null }),
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

// ── GET /api/conversations/:id/context — card de CRM do contato ──
// CRM Onda 2: painel de contexto. Card do contato (lead status/score/estágio) +
// deal aberto + tarefas pendentes + timeline de atividades. Org-scoped (RLS via
// middleware + filtro explícito). Alimenta o 3o painel do dashboard de Conversas.
router.get('/:id/context', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId!, deletedAt: null },
      select: { id: true, contactId: true, channel: true, status: true, sentiment: true, summary: true, createdAt: true },
    });
    if (!conv) {
      res.status(404).json({ success: false, error: 'Conversa não encontrada' });
      return;
    }

    const [contact, deal, tasks, activities] = await Promise.all([
      prisma.contact.findUnique({
        where: { id: conv.contactId },
        select: {
          id: true, name: true, phone: true, email: true, company: true,
          leadStatus: true, leadScore: true, funnelStage: true, tags: true,
          firstTouchAt: true, lastTouchAt: true, createdAt: true,
        },
      }),
      prisma.deal.findFirst({
        where: { contactId: conv.contactId, organizationId: req.organizationId!, wonAt: null, lostAt: null },
        orderBy: { createdAt: 'desc' },
        include: { pipelineStage: { select: { name: true, color: true, order: true } } },
      }),
      prisma.task.findMany({
        where: { contactId: conv.contactId, organizationId: req.organizationId!, status: 'PENDING' },
        orderBy: [{ dueDate: 'asc' }],
        take: 5,
      }),
      prisma.activity.findMany({
        where: { contactId: conv.contactId, organizationId: req.organizationId! },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);

    res.json({ success: true, data: { conversation: conv, contact, deal, tasks, activities } });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/conversations/:id ──────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const canSeeDeleted = ['ADMIN', 'AUDITOR'].includes(req.user!.role);

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
        ...(canSeeDeleted ? {} : { deletedAt: null }),
      },
      include: {
        contact: true,
        assignedTo: { select: { id: true, name: true, avatar: true } },
        deletedBy: { select: { id: true, name: true, email: true } },
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

    const existing = await prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId!, deletedAt: null },
      include: { contact: { select: { whatsappId: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Tenant scoping do RESPONSÁVEL: atribuir só a um usuário da MESMA org.
    // Sem isso, o agentId do body virava assignedToId sem checagem — dava para
    // atribuir a conversa a um usuário de outra org. Desatribuir (agentId
    // vazio/nulo) segue permitido sem validação. 404 para não revelar existência.
    if (agentId) {
      const agent = await prisma.user.findFirst({
        where: { id: agentId, organizationId: req.organizationId! },
        select: { id: true },
      });
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
    }

    // W3.4 — atribuir a um humano PAUSA a Iza nesta conversa; desatribuir
    // (agentId vazio) devolve o atendimento à IA (aiPaused=false).
    const transition = planAssign(agentId);

    const updated = await prisma.conversation.update({
      where: { id: req.params.id },
      data: transition.data,
    });

    // Espelha no cache (fast-path que orchestrator/flowScheduler consultam).
    await mirrorPauseCache(transition.cacheEffect, req.organizationId!, existing.contact.whatsappId);

    await logAuditEvent(req, {
      action: 'conversation.assign',
      resource: 'conversation',
      resourceId: updated.id,
      dataSubjectId: existing.contactId,
      purpose: 'Atribuição/reatribuição operacional de atendimento',
      legalBasis: 'CONTRACT',
      before: { assignedToId: existing.assignedToId, status: existing.status },
      after: { assignedToId: updated.assignedToId, status: updated.status },
    });

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
    const existing = await prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId!, deletedAt: null },
    });
    if (!existing) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const updated = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    await logAuditEvent(req, {
      action: 'conversation.close',
      resource: 'conversation',
      resourceId: updated.id,
      dataSubjectId: existing.contactId,
      purpose: 'Encerramento de atendimento',
      legalBasis: 'CONTRACT',
      before: { status: existing.status, closedAt: existing.closedAt },
      after: { status: updated.status, closedAt: updated.closedAt },
    });

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

// ── PUT /api/conversations/:id/reopen ───────────
// Feature 5a.1 — reabre uma conversa fechada. Se ainda houver humano
// atribuído, volta como ASSIGNED (IA segue pausada); senão OPEN.
router.put('/:id/reopen', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId!, deletedAt: null },
    });
    if (!existing) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const transition = planReopen(existing.assignedToId);

    const updated = await prisma.conversation.update({
      where: { id: req.params.id },
      data: transition.data,
    });

    await logAuditEvent(req, {
      action: 'conversation.reopen',
      resource: 'conversation',
      resourceId: updated.id,
      dataSubjectId: existing.contactId,
      purpose: 'Reabertura de atendimento',
      legalBasis: 'CONTRACT',
      before: { status: existing.status, closedAt: existing.closedAt },
      after: { status: updated.status, closedAt: updated.closedAt },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`org:${req.organizationId}`).emit('conversation_reopened', {
        conversationId: req.params.id,
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/conversations/:id/resume-ai ────────
// Feature 5a.1 — RETOMAR IZA: despausa a IA nesta conversa (aiPaused=false)
// e limpa o espelho de pausa no cache. Se estava ASSIGNED, reabre para OPEN
// para a IA voltar a responder; nunca "desfecha" uma CLOSED.
router.put('/:id/resume-ai', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId!, deletedAt: null },
      include: { contact: { select: { whatsappId: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const transition = planResumeAi(existing.status);

    const updated = await prisma.conversation.update({
      where: { id: req.params.id },
      data: transition.data,
    });

    await mirrorPauseCache(transition.cacheEffect, req.organizationId!, existing.contact.whatsappId);

    await logAuditEvent(req, {
      action: 'conversation.resume_ai',
      resource: 'conversation',
      resourceId: updated.id,
      dataSubjectId: existing.contactId,
      purpose: 'Retomada do atendimento pela IA',
      legalBasis: 'CONTRACT',
      before: { status: existing.status, aiPaused: existing.aiPaused },
      after: { status: updated.status, aiPaused: updated.aiPaused },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`org:${req.organizationId}`).emit('conversation_ai_resumed', {
        conversationId: req.params.id,
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

const deleteSchema = z.object({
  reason: z.string().max(500).optional(),
  legalBasis: z
    .enum([
      'CONSENT',
      'CONTRACT',
      'LEGAL_OBLIGATION',
      'LEGITIMATE_INTEREST',
      'VITAL_INTERESTS',
      'PUBLIC_INTEREST',
      'CREDIT_PROTECTION',
      'HEALTH_PROTECTION',
    ])
    .default('LEGITIMATE_INTEREST'),
  purpose: z.string().max(500).optional(),
});

// ── DELETE /api/conversations/:id — LGPD soft delete (ADMIN/SUPERVISOR) ──
// Nunca hard-delete: marca deletedAt + deletedById + registra audit log.
// Purge real acontece no job de retenção após prazo configurado.
router.delete('/:id', requireRole('ADMIN', 'SUPERVISOR'), validate(deleteSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason, legalBasis, purpose } = req.body as z.infer<typeof deleteSchema>;

    const existing = await prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId!, deletedAt: null },
      include: { contact: { select: { id: true, name: true, phone: true } } },
    });

    if (!existing) {
      res.status(404).json({ error: 'Conversation not found or already deleted' });
      return;
    }

    const updated = await prisma.conversation.update({
      where: { id: req.params.id },
      data: {
        deletedAt: new Date(),
        deletedById: req.user!.userId,
        deletionReason: reason ?? null,
      },
    });

    await logAuditEvent(req, {
      action: 'conversation.soft_delete',
      resource: 'conversation',
      resourceId: updated.id,
      dataSubjectId: existing.contactId,
      purpose: purpose ?? reason ?? 'Exclusão solicitada pelo operador',
      legalBasis,
      before: existing,
      after: updated,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`org:${req.organizationId}`).emit('conversation_deleted', { conversationId: updated.id });
    }

    res.json({ success: true, data: { id: updated.id, deletedAt: updated.deletedAt } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/conversations/:id/restore — reverter soft delete (ADMIN) ──
router.post('/:id/restore', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId!, deletedAt: { not: null } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Conversation not found or not deleted' });
      return;
    }

    const updated = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { deletedAt: null, deletedById: null, deletionReason: null },
    });

    await logAuditEvent(req, {
      action: 'conversation.restore',
      resource: 'conversation',
      resourceId: updated.id,
      dataSubjectId: existing.contactId,
      purpose: 'Reversão de exclusão soft',
      legalBasis: 'LEGITIMATE_INTEREST',
      before: existing,
      after: updated,
    });

    res.json({ success: true, data: updated });
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

    // Tenant scoping: só cria nota se a conversa pertence à org do usuário.
    // Sem isso, um cliente escrevia nota interna na conversa de outra org.
    // 404 (não 403) para não revelar a existência de conversas de outras orgs.
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId!, deletedAt: null },
      select: { id: true },
    });
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
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
