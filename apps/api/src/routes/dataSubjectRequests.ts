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
import { createPublicDsr, validatePortalDsr } from '../services/dsrIntake.js';
import {
  findDataSubjectContacts,
  buildDsrExport,
  exportPackageToCsv,
  executeDeletion,
} from '../services/dsrFulfillment.js';
import { sendEmail } from '../services/email/emailProvider.js';
import { renderDsrCompletedEmail, type DsrOutcome } from '../services/email/templates/dsrCompleted.js';

const router = Router();

const DSR_DEADLINE_DAYS = 15;

// Rótulos pt-BR do tipo (espelha a tela /dsr) para os e-mails ao titular.
const TYPE_LABEL_PT: Record<string, string> = {
  ACCESS: 'Acesso aos dados',
  CORRECTION: 'Correção',
  ANONYMIZATION: 'Anonimização',
  PORTABILITY: 'Portabilidade',
  DELETION: 'Eliminação',
  CONSENT_REVOKE: 'Revogação de consentimento',
  INFORMATION: 'Informação sobre compartilhamento',
};

function protocolOf(id: string): string {
  return `DSR-${id.slice(-8).toUpperCase()}`;
}

/**
 * O intake público guarda telefone/documento dentro de `reason`
 * ("Vínculo: X | Documento: 123 | Telefone: +55...."). Extrai o telefone
 * para casar com Contact.phone quando a DSR não tem contactId.
 */
function extractPhoneFromReason(reason: string | null): string | null {
  if (!reason) return null;
  const m = reason.match(/Telefone:\s*([^|]+)/i);
  return m ? m[1].trim() : null;
}

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

// ── POST /api/dsr/public — ABERTO ao titular (sem auth) ──
// Recebe o payload do PORTAL PÚBLICO (pt-BR: tipo/nomeCompleto/vinculo/...) e
// grava na MESMA fonte do admin (data_subject_requests), resolvendo a org e o
// SLA. Antes o portal gravava em public.dsr_requests (Supabase) e a solicitação
// nunca aparecia na fila do admin (W2.6). Rate-limit aplicado no server.ts.
router.post('/public', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = validatePortalDsr(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const result = await createPublicDsr(validation.data);

    logger.info('[DSR] Solicitação pública registrada na fila do admin', {
      id: result.id,
      protocol: result.protocol,
      tipo: validation.data.tipo,
    });

    res.status(201).json({
      success: true,
      protocolo: result.protocol,
      data: { id: result.id, protocol: result.protocol, dueDate: result.dueDate },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/dsr/protocol/:id — ABERTO ao titular (consulta de status) ──
// Página pública de protocolo: o titular acompanha o andamento da solicitação
// pelo id/protocolo, sem autenticação e sem expor PII de terceiros. Devolve só
// tipo, status, datas e protocolo. O mount no server.ts aplica rate-limit ao
// GET /protocol/* (mesma faixa dos POSTs públicos).
router.get('/protocol/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dsr = await prisma.dataSubjectRequest.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        dueDate: true,
        completedAt: true,
      },
    });
    if (!dsr) {
      res.status(404).json({ error: 'Protocolo não encontrado' });
      return;
    }
    res.json({
      success: true,
      data: {
        protocol: protocolOf(dsr.id),
        type: dsr.type,
        typeLabel: TYPE_LABEL_PT[dsr.type] ?? dsr.type,
        status: dsr.status,
        createdAt: dsr.createdAt,
        dueDate: dsr.dueDate,
        completedAt: dsr.completedAt,
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

// ── GET /api/dsr/:id/export — EXPORTAR dados do titular (acesso/portabilidade) ──
// Junta Contact + conversas + mensagens do titular (casando por contactId da
// DSR ou por email/telefone) e devolve JSON (default) ou CSV (?format=csv).
// É acao de LEITURA — não muda o status da DSR (a conclusão é separada).
const exportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
});

router.get('/:id/export', validate(exportQuerySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dsr = await prisma.dataSubjectRequest.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!dsr) {
      res.status(404).json({ error: 'Requisição não encontrada' });
      return;
    }

    const { format } = req.query as unknown as z.infer<typeof exportQuerySchema>;
    const protocol = protocolOf(dsr.id);

    const contactIds = await findDataSubjectContacts({
      organizationId: dsr.organizationId,
      contactId: dsr.contactId,
      email: dsr.requesterEmail,
      phone: extractPhoneFromReason(dsr.reason),
    });

    const pkg = await buildDsrExport({
      organizationId: dsr.organizationId,
      protocol,
      requesterName: dsr.requesterName,
      requesterEmail: dsr.requesterEmail,
      contactIds,
    });

    await logAuditEvent(req, {
      action: 'dsr.export',
      resource: 'data_subject_request',
      resourceId: dsr.id,
      dataSubjectId: dsr.contactId ?? undefined,
      purpose: `Exportação de dados do titular (${dsr.type}) — acesso/portabilidade`,
      legalBasis: 'LEGAL_OBLIGATION',
      details: { format, ...pkg.totals },
    });

    const filename = `${protocol}.${format}`;
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportPackageToCsv(pkg));
      return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(pkg, null, 2));
  } catch (err) {
    next(err);
  }
});

const fulfillSchema = z.object({
  // Se true, dispara e-mail de conclusão ao titular (default true).
  notify: z.boolean().default(true),
});

// ── POST /api/dsr/:id/delete — ELIMINAR (soft-delete + anonimização) ──
// Executa a eliminação do Art. 18 VI: anonimiza os contatos do titular
// (nome/telefone/email → placeholders, preserva métricas agregadas) e
// soft-deleta as conversas. Marca a DSR como COMPLETED e (opcional) notifica.
router.post('/:id/delete', validate(fulfillSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = req.body as z.infer<typeof fulfillSchema>;

    const dsr = await prisma.dataSubjectRequest.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!dsr) {
      res.status(404).json({ error: 'Requisição não encontrada' });
      return;
    }
    if (dsr.status === 'COMPLETED' || dsr.status === 'REJECTED') {
      res.status(409).json({ error: 'Requisição já foi finalizada' });
      return;
    }

    const protocol = protocolOf(dsr.id);
    const contactIds = await findDataSubjectContacts({
      organizationId: dsr.organizationId,
      contactId: dsr.contactId,
      email: dsr.requesterEmail,
      phone: extractPhoneFromReason(dsr.reason),
    });

    const result = await executeDeletion({
      organizationId: dsr.organizationId,
      contactIds,
      operatorUserId: req.user!.userId,
      reason: `DSR ${protocol} — eliminação/anonimização (Art. 18 VI)`,
    });

    const updated = await prisma.dataSubjectRequest.update({
      where: { id: dsr.id },
      data: {
        status: 'COMPLETED',
        handledById: req.user!.userId,
        completedAt: new Date(),
        responseData: {
          action: 'deletion',
          contactsAnonymized: result.contactsAnonymized,
          conversationsSoftDeleted: result.conversationsSoftDeleted,
        } as Prisma.InputJsonValue,
      },
    });

    await logAuditEvent(req, {
      action: 'dsr.delete',
      resource: 'data_subject_request',
      resourceId: dsr.id,
      dataSubjectId: dsr.contactId ?? undefined,
      purpose: `Eliminação/anonimização dos dados do titular (${dsr.type}) — Art. 18 VI`,
      legalBasis: 'LEGAL_OBLIGATION',
      before: dsr,
      after: updated,
      details: { ...result },
    });

    let notified = false;
    if (input.notify) {
      notified = await notifyRequester(dsr.requesterEmail, dsr.requesterName, dsr.type, protocol, 'deletion', req.organizationId!);
    }

    res.json({ success: true, data: { ...result, status: updated.status, notified } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/dsr/:id/complete-export — concluir ACESSO/PORTABILIDADE ──
// Marca a DSR como COMPLETED e (opcional) notifica o titular de que o export
// está disponível. O arquivo em si é baixado pelo operador via GET /:id/export.
router.post('/:id/complete-export', validate(fulfillSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = req.body as z.infer<typeof fulfillSchema>;

    const dsr = await prisma.dataSubjectRequest.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!dsr) {
      res.status(404).json({ error: 'Requisição não encontrada' });
      return;
    }
    if (dsr.status === 'COMPLETED' || dsr.status === 'REJECTED') {
      res.status(409).json({ error: 'Requisição já foi finalizada' });
      return;
    }

    const protocol = protocolOf(dsr.id);
    const updated = await prisma.dataSubjectRequest.update({
      where: { id: dsr.id },
      data: {
        status: 'COMPLETED',
        handledById: req.user!.userId,
        completedAt: new Date(),
        responseData: { action: 'export' } as Prisma.InputJsonValue,
      },
    });

    await logAuditEvent(req, {
      action: 'dsr.complete_export',
      resource: 'data_subject_request',
      resourceId: dsr.id,
      dataSubjectId: dsr.contactId ?? undefined,
      purpose: `Conclusão de acesso/portabilidade (${dsr.type})`,
      legalBasis: 'LEGAL_OBLIGATION',
      before: dsr,
      after: updated,
    });

    let notified = false;
    if (input.notify) {
      notified = await notifyRequester(dsr.requesterEmail, dsr.requesterName, dsr.type, protocol, 'export', req.organizationId!);
    }

    res.json({ success: true, data: { status: updated.status, notified } });
  } catch (err) {
    next(err);
  }
});

/**
 * Envia o e-mail de conclusão ao titular. Nunca lança: falha de e-mail não pode
 * reverter a operação LGPD já concluída — apenas loga e devolve false.
 */
async function notifyRequester(
  requesterEmail: string,
  requesterName: string | null,
  type: string,
  protocol: string,
  outcome: DsrOutcome,
  organizationId: string,
): Promise<boolean> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    const { subject, html, text } = renderDsrCompletedEmail({
      requesterName,
      protocol,
      requestTypeLabel: TYPE_LABEL_PT[type] ?? type,
      outcome,
      orgName: org?.name ?? 'ZappIQ',
    });
    await sendEmail({ to: requesterEmail, subject, html, text, tags: ['dsr', outcome] });
    return true;
  } catch (err) {
    logger.error('[DSR] Falha ao notificar titular na conclusão', {
      protocol,
      error: String(err),
    });
    return false;
  }
}

export default router;
