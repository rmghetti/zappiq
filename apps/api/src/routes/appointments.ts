/**
 * Agenda interna (hub) — /api/appointments.
 *
 * É a fonte da verdade dos agendamentos. A IA grava aqui (via tools, Fase 2),
 * o dono do negócio gerencia aqui (página crm/agenda), e calendários externos
 * sincronizam com esta agenda. Todas as rotas: auth + tenant scoping.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as googleCalendar from '../services/googleCalendar.js';

const router = Router();
router.use(authMiddleware);

// GET /api/appointments?from=ISO&to=ISO&status=... — lista por janela de tempo.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { from, to, status } = req.query as { from?: string; to?: string; status?: string };
    const where: any = { organizationId: orgId };
    if (from || to) {
      where.startAt = {};
      if (from) where.startAt.gte = new Date(from);
      if (to) where.startAt.lte = new Date(to);
    }
    if (status) where.status = status;
    const appointments = await (prisma as any).appointment.findMany({
      where,
      orderBy: { startAt: 'asc' },
      take: 500,
      include: { appointmentType: { select: { name: true, icon: true, modality: true } } },
    });
    res.json({ appointments });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  appointmentTypeId: z.string().optional(),
  contactId: z.string().optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'no_show', 'completed']).default('confirmed'),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string().default('America/Sao_Paulo'),
  modality: z.enum(['in_person', 'online', 'phone', 'video']).default('online'),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().max(30).optional(),
  customerEmail: z.string().email().optional().or(z.literal('')),
  answers: z.record(z.any()).default({}),
  location: z.string().max(300).optional(),
  meetingUrl: z.string().max(300).optional(),
  notes: z.string().max(1000).optional(),
});

// POST /api/appointments — criação manual (pelo dono do negócio).
router.post('/', validate(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const body = req.body as z.infer<typeof createSchema>;
    // Tenant scoping: tipo e contato referenciados no body precisam ser da própria
    // org. Sem isso, o cliente A referenciaria tipo/contato do cliente B e passaria
    // a ver dados de outra org via o include do GET. Espelha a checagem do PATCH.
    if (body.appointmentTypeId) {
      const type = await (prisma as any).appointmentType.findFirst({ where: { id: body.appointmentTypeId, organizationId: orgId }, select: { id: true } });
      if (!type) {
        res.status(404).json({ error: 'Tipo de agendamento não encontrado' });
        return;
      }
    }
    if (body.contactId) {
      const contact = await (prisma as any).contact.findFirst({ where: { id: body.contactId, organizationId: orgId }, select: { id: true } });
      if (!contact) {
        res.status(404).json({ error: 'Contato não encontrado' });
        return;
      }
    }
    const appt = await (prisma as any).appointment.create({
      data: {
        organizationId: orgId,
        appointmentTypeId: body.appointmentTypeId || null,
        contactId: body.contactId || null,
        status: body.status,
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
        timezone: body.timezone,
        modality: body.modality,
        customerName: body.customerName,
        customerPhone: body.customerPhone || null,
        customerEmail: body.customerEmail || null,
        answers: body.answers,
        location: body.location || null,
        meetingUrl: body.meetingUrl || null,
        notes: body.notes || null,
        source: 'manual',
      },
    });
    // Fase 2: refletir no calendário externo conectado (se houver).
    res.status(201).json({ appointment: appt });
  } catch (err) {
    next(err);
  }
});

const patchSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'no_show', 'completed']).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});

// PATCH /api/appointments/:id — status (confirmar, cancelar, no-show, concluir) ou remarcar.
router.patch('/:id', validate(patchSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { id } = req.params;
    const existing = await (prisma as any).appointment.findFirst({ where: { id, organizationId: orgId }, select: { id: true, externalEventId: true, status: true } });
    if (!existing) {
      res.status(404).json({ error: 'Agendamento não encontrado' });
      return;
    }
    const body = req.body as z.infer<typeof patchSchema>;
    const data: any = {};
    if (body.status) data.status = body.status;
    if (body.startAt) data.startAt = new Date(body.startAt);
    if (body.endAt) data.endAt = new Date(body.endAt);
    if (body.notes !== undefined) data.notes = body.notes;
    const appt = await (prisma as any).appointment.update({ where: { id }, data });

    // Cancelar remove o evento espelho no Google (best-effort). Mantém o hub e o
    // calendário externo em sincronia.
    if (body.status === 'cancelled' && existing.externalEventId) {
      await googleCalendar.deleteEvent(orgId, existing.externalEventId).catch(() => {});
    }
    res.json({ appointment: appt });
  } catch (err) {
    next(err);
  }
});

export default router;
