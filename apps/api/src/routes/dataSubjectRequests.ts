/**
 * DSR — Data Subject Requests (LGPD Art. 18).
 * Endpoints de criação públicos (titular não é usuário do sistema).
 * Gestão e execução exigem ADMIN/AUDITOR.
 *
 * Prazo legal: 15 dias para resposta (Art. 19).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@zappiq/database';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logAuditEvent } from '../services/auditService.js';
import { logger } from '../utils/logger.js';

const router = Router();

const DSR_DEADLINE_DAYS = 15;

const requestTypeEnum = z.enum([
  'ACCESS',
  'CORRECTION',
  'ANONYMIZATION',
  'PORTABILITY',
  'DELETION',
  'CONSENT_REVOKE',
  'INFORMATION',
]);

const createSchema = z.object({
  type: requestTypeEnum,
  requesterEmail: z.string().email(),
  requesterName: z.string().max(200).optional(),
  contactId: z.string().optional(),
  reason: z.string().max(2000).optional(),
  organizationId: z.string(),
});

// ── POST /api/dsr — ABERTO ao titular (sem auth) ──
// Por questão de segurança este endpoint é chamado pela landing/portal do titular.
// Proteção anti-abuso: rate-limit agressivo + CAPTCHA a ser adicionado em camada externa.
router.post('/', validate(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = req.body as z.infer<typeof createSchema>;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + DSR_DEADLINE_DAYS);

    const created = await prisma.dataSubjectRequest.create({
      data: {
        type: input.type,
        status: 'PENDING',
        requesterEmail: input.requesterEmail,
        requesterName: input.requesterName ?? null,
        contactId: input.contactId ?? null,
        reason: input.reason ?? null,
        dueDate,
        organizationId: input.organizationId,
      },
    });

    // TODO: disparar e-mail ao DPO (Art. 41) — integração futura com queueService
    logger.info('[DSR] Nova requisição recebida', {
      id: created.id,
      type: created.type,
      orgId: created.organizationId,
      dueDate,
    });

    res.status(201).json({
      success: true,
      data: {
        id: created.id,
        protocol: created.id.slice(-8).toUpperCase(),
        dueDate,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── A partir daqui exige autenticação + papel ADMIN/AUDITOR ──
router.use(requireRole('ADMIN', 'AUDITOR'));

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(30),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'EXPIRED']).optional(),
  type: requestTypeEnum.optional(),
});

// ── GET /api/dsr ──
router.get('/', validate(listSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, status, type } = req.query as any;
    const skip = (page - 1) * limit;

    const where = {
      organizationId: req.organizationId!,
      ...(status && { status }),
      ...(type && { type }),
    };

    const [requests, total] = await Promise.all([
      prisma.dataSubjectRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }], // pendências primeiro, mais urgentes no topo
      }),
      prisma.dataSubjectRequest.count({ where }),
    ]);

    res.json({ success: true, data: requests, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/dsr/:id ──
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dsr = await prisma.dataSubjectRequest.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!dsr) {
      res.status(404).json({ error: 'Requisição não encontrada' });
      return;
    }
    res.json({ success: true, data: dsr });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'REJECTED']),
  rejectionReason: z.string().max(2000).optional(),
  responseData: z.record(z.unknown()).optional(),
});

// ── PUT /api/dsr/:id — atualizar status / anexar resposta ──
router.put('/:id', validate(updateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = req.body as z.infer<typeof updateSchema>;

    const existing = await prisma.dataSubjectRequest.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!existing) {
      res.status(404).json({ error: 'Requisição não encontrada' });
      return;
    }

    // Prisma JSON input types divergem dos output types (JsonValue vs InputJsonValue).
    // Só escrevemos responseData quando o input traz — se vier vazio, mantemos o existente.
    const updateData: Prisma.DataSubjectRequestUpdateInput = {
      status: input.status,
      rejectionReason: input.rejectionReason ?? null,
      handledById: req.user!.userId,
      completedAt: input.status === 'COMPLETED' || input.status === 'REJECTED' ? new Date() : null,
    };
    if (input.responseData !== undefined) {
      updateData.responseData = input.responseData as Prisma.InputJsonValue;
    }

    const updated = await prisma.dataSubjectRequest.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await logAuditEvent(req, {
      action: `dsr.${input.status.toLowerCase()}`,
      resource: 'data_subject_request',
      resourceId: updated.id,
      dataSubjectId: updated.contactId ?? undefined,
      purpose: `Atendimento a requisição do titular (${updated.type})`,
      legalBasis: 'LEGAL_OBLIGATION',
      before: existing,
      after: updated,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
