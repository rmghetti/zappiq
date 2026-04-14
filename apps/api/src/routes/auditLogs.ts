/**
 * Audit Log API — apenas ADMIN e AUDITOR.
 * LGPD: disponibilizar ROPA para consulta é obrigação decorrente do Art. 37.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@zappiq/database';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { verifyAuditChain, logAuditEvent } from '../services/auditService.js';

const router = Router();

// Todas as rotas exigem ADMIN ou AUDITOR
router.use(requireRole('ADMIN', 'AUDITOR'));

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(50),
  action: z.string().optional(),
  resource: z.string().optional(),
  resourceId: z.string().optional(),
  userId: z.string().optional(),
  dataSubjectId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// ── GET /api/audit-logs ─────────────────────────
router.get('/', validate(listQuerySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, action, resource, resourceId, userId, dataSubjectId, from, to } = req.query as any;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      organizationId: req.organizationId!,
      ...(action && { action }),
      ...(resource && { resource }),
      ...(resourceId && { resourceId }),
      ...(userId && { userId }),
      ...(dataSubjectId && { dataSubjectId }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: from }),
          ...(to && { lte: to }),
        },
      }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sequence: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // BigInt não é JSON-serializável — converter sequence para string
    const serialized = logs.map((l) => ({ ...l, sequence: l.sequence.toString() }));

    // Meta-audit: consultas a audit logs devem ser auditadas (Art. 48)
    await logAuditEvent(req, {
      action: 'audit_log.list',
      resource: 'audit_log',
      purpose: 'Consulta de trilha de auditoria (ROPA — Art. 37)',
      legalBasis: 'LEGAL_OBLIGATION',
      details: { filters: req.query, resultCount: logs.length },
    });

    res.json({
      success: true,
      data: serialized,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/audit-logs/verify — verificar integridade da cadeia ──
router.get('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await verifyAuditChain(req.organizationId!);

    await logAuditEvent(req, {
      action: 'audit_log.verify_chain',
      resource: 'audit_log',
      purpose: 'Verificação de integridade da cadeia de auditoria (Art. 46)',
      legalBasis: 'LEGAL_OBLIGATION',
      details: {
        valid: result.valid,
        checkedCount: result.checkedCount,
        brokenAtSequence: result.brokenAtSequence?.toString() ?? null,
      },
    });

    res.json({
      success: true,
      valid: result.valid,
      checkedCount: result.checkedCount,
      brokenAtSequence: result.brokenAtSequence?.toString() ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/audit-logs/subject/:contactId — trilha consolidada do titular (DSR Art. 18, II) ──
router.get('/subject/:contactId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: req.organizationId!,
        dataSubjectId: req.params.contactId,
      },
      orderBy: { sequence: 'desc' },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });

    const serialized = logs.map((l) => ({ ...l, sequence: l.sequence.toString() }));

    await logAuditEvent(req, {
      action: 'audit_log.subject_access',
      resource: 'audit_log',
      dataSubjectId: req.params.contactId,
      purpose: 'Atendimento a requisição de acesso do titular (Art. 18, II)',
      legalBasis: 'LEGAL_OBLIGATION',
      details: { entriesReturned: logs.length },
    });

    res.json({ success: true, data: serialized, total: logs.length });
  } catch (err) {
    next(err);
  }
});

export default router;
