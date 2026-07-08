/**
 * Tools de AGENDAMENTO que a Iza executa na conversa (function calling).
 *
 * - check_availability: devolve horários REAIS livres (nunca inventados). Base
 *   da regra anti-alucinação: o agente só oferece o que sai daqui.
 * - create_appointment: grava o agendamento na agenda interna (hub). A reflexão
 *   no calendário externo (Google) é feita por um sync separado (Fase 2B).
 *
 * Registradas no registry global (tools.ts) e só oferecidas quando a org tem
 * agendamento ativo (getToolsForContext filtra por isso).
 */
import { prisma } from '@zappiq/database';
import type { RegisteredTool } from '../services/llm/tools.js';
import { computeSlots, isSlotFree, type BusyInterval } from './schedulingAvailability.js';
import { localMidnightUtcMs, localDayOfWeek, fmtLocal } from './schedulingTz.js';
import { logger } from '../utils/logger.js';

// Carrega os tipos ativos da org (com as regras).
async function loadActiveTypes(orgId: string) {
  return (prisma as any).appointmentType.findMany({ where: { organizationId: orgId, active: true } });
}

// Agendamentos que ocupam a agenda (confirmados/pendentes) viram "busy".
async function loadBusy(orgId: string, fromMs: number, toMs: number): Promise<BusyInterval[]> {
  const rows = await (prisma as any).appointment.findMany({
    where: {
      organizationId: orgId,
      status: { in: ['pending', 'confirmed'] },
      startAt: { gte: new Date(fromMs), lte: new Date(toMs) },
    },
    select: { startAt: true, endAt: true },
  });
  return rows.map((r: any) => ({ startMs: new Date(r.startAt).getTime(), endMs: new Date(r.endAt).getTime() }));
}

function resolveType(types: any[], nameHint?: string) {
  if (types.length === 0) return null;
  if (!nameHint) return types.length === 1 ? types[0] : null;
  const n = nameHint.toLowerCase();
  return types.find((t) => t.name.toLowerCase().includes(n) || n.includes(t.name.toLowerCase())) || (types.length === 1 ? types[0] : null);
}

export const checkAvailabilityTool: RegisteredTool = {
  schedulingOnly: true,
  definition: {
    name: 'check_availability',
    description:
      'Consulta os horários REALMENTE livres para agendar. Use SEMPRE antes de oferecer ' +
      'ou confirmar qualquer horário ao cliente. Nunca invente horários; ofereça apenas os ' +
      'que esta ferramenta retornar. Se houver mais de um tipo de agendamento, informe qual.',
    inputSchema: {
      type: 'object',
      properties: {
        appointment_type: { type: 'string', description: 'Nome do tipo (ex.: Consulta). Opcional se só existe um.' },
      },
      required: [],
    },
  },
  handler: async (input, ctx) => {
    const types = await loadActiveTypes(ctx.organizationId);
    if (types.length === 0) return { error: 'agendamento_indisponivel', message: 'Este negócio não oferece agendamento.' };
    const t = resolveType(types, input.appointment_type as string | undefined);
    if (!t) return { need_type: true, options: types.map((x: any) => x.name) };

    const tz = t.availability?.timezone || 'America/Sao_Paulo';
    const nowMs = Date.now();
    const horizonMs = nowMs + (t.futureHorizonDays || 60) * 86_400_000;
    const busy = await loadBusy(ctx.organizationId, nowMs, horizonMs);

    const slots = computeSlots({
      nowMs,
      availability: t.availability || {},
      rules: {
        durationMin: t.durationMin, minNoticeMin: t.minNoticeMin,
        bufferBeforeMin: t.bufferBeforeMin, bufferAfterMin: t.bufferAfterMin,
        futureHorizonDays: t.futureHorizonDays, maxPerDay: t.maxPerDay,
      },
      busy,
      dayStartMsUtc: (off) => localMidnightUtcMs(tz, nowMs, off),
      dayOfWeek: (off) => localDayOfWeek(tz, nowMs, off),
      limit: 12,
    });

    return {
      appointment_type: t.name,
      duration_min: t.durationMin,
      timezone: tz,
      slots: slots.map((s) => ({ start_iso: new Date(s.startMs).toISOString(), label: fmtLocal(tz, s.startMs) })),
      booking_fields: t.bookingFields || [],
    };
  },
};

export const createAppointmentTool: RegisteredTool = {
  schedulingOnly: true,
  definition: {
    name: 'create_appointment',
    description:
      'Cria o agendamento na agenda do negócio. SÓ chame depois de check_availability confirmar ' +
      'que o horário está livre e de coletar o nome do cliente e os campos pedidos pelo tipo. ' +
      'start_iso deve ser EXATAMENTE um dos horários retornados por check_availability.',
    inputSchema: {
      type: 'object',
      properties: {
        appointment_type: { type: 'string', description: 'Nome do tipo de agendamento.' },
        start_iso: { type: 'string', description: 'Horário escolhido (ISO 8601), vindo de check_availability.' },
        customer_name: { type: 'string', description: 'Nome do cliente.' },
        customer_phone: { type: 'string', description: 'Telefone do cliente (opcional).' },
        customer_email: { type: 'string', description: 'E-mail do cliente (opcional).' },
        answers: { type: 'object', description: 'Respostas dos campos pedidos pelo tipo (chave->valor).' },
      },
      required: ['start_iso', 'customer_name'],
    },
  },
  handler: async (input, ctx) => {
    const types = await loadActiveTypes(ctx.organizationId);
    const t = resolveType(types, input.appointment_type as string | undefined);
    if (!t) return { error: 'tipo_nao_encontrado', options: types.map((x: any) => x.name) };

    const startMs = Date.parse(input.start_iso as string);
    if (!Number.isFinite(startMs)) return { error: 'horario_invalido' };

    // Revalida contra a disponibilidade REAL (o cliente não fura a fila nem
    // pega um horário que encheu no meio da conversa). Anti-alucinação de ponta.
    const tz = t.availability?.timezone || 'America/Sao_Paulo';
    const nowMs = Date.now();
    const busy = await loadBusy(ctx.organizationId, nowMs, nowMs + (t.futureHorizonDays || 60) * 86_400_000);
    const slots = computeSlots({
      nowMs, availability: t.availability || {},
      rules: { durationMin: t.durationMin, minNoticeMin: t.minNoticeMin, bufferBeforeMin: t.bufferBeforeMin, bufferAfterMin: t.bufferAfterMin, futureHorizonDays: t.futureHorizonDays, maxPerDay: t.maxPerDay },
      busy, dayStartMsUtc: (off) => localMidnightUtcMs(tz, nowMs, off), dayOfWeek: (off) => localDayOfWeek(tz, nowMs, off), limit: 500,
    });
    if (!isSlotFree(startMs, slots)) {
      return { error: 'horario_indisponivel', message: 'Esse horário não está mais livre. Ofereça outro de check_availability.' };
    }

    const endMs = startMs + t.durationMin * 60_000;
    const status = t.requiresConfirmation ? 'pending' : 'confirmed';
    const appt = await (prisma as any).appointment.create({
      data: {
        organizationId: ctx.organizationId,
        appointmentTypeId: t.id,
        contactId: ctx.contactId || null,
        conversationId: ctx.conversationId || null,
        status,
        startAt: new Date(startMs),
        endAt: new Date(endMs),
        timezone: tz,
        modality: t.modality,
        customerName: String(input.customer_name),
        customerPhone: (input.customer_phone as string) || null,
        customerEmail: (input.customer_email as string) || null,
        answers: (input.answers as Record<string, unknown>) || {},
        location: t.locationText || null,
        source: 'ai',
      },
    });
    logger.info(`[scheduling] Agendamento criado via IA: ${appt.id} org=${ctx.organizationId} tipo=${t.name}`);

    return {
      ok: true,
      appointment_id: appt.id,
      status,
      when: fmtLocal(tz, startMs),
      requires_confirmation: t.requiresConfirmation,
      cancel_policy: t.cancelPolicyText || null,
    };
  },
};
