import { z } from 'zod';

/**
 * Configuração de Agendamento — schemas e builder do documento de RAG.
 * Isolado para teste puro (sem Express/Prisma).
 *
 * Modelo mental: o dono do negócio define TIPOS de agendamento (Consulta,
 * Visita…) com regras. A IA lê essas regras (via RAG) e as respeita ao agendar.
 */

// Janela de horário "HH:MM" (24h).
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use HH:MM');
const dayWindows = z.array(z.tuple([timeStr, timeStr])).max(4); // até 4 janelas/dia

export const availabilitySchema = z.object({
  timezone: z.string().min(1).default('America/Sao_Paulo'),
  weekly: z
    .object({
      mon: dayWindows.optional(),
      tue: dayWindows.optional(),
      wed: dayWindows.optional(),
      thu: dayWindows.optional(),
      fri: dayWindows.optional(),
      sat: dayWindows.optional(),
      sun: dayWindows.optional(),
    })
    .default({}),
});

export const bookingFieldSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  type: z.enum(['text', 'phone', 'email', 'select']).default('text'),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(), // para type=select
});

export const reminderSchema = z.object({
  offsetMin: z.number().int().min(5).max(20160), // 5min a 14 dias antes
  channel: z.enum(['whatsapp', 'email']).default('whatsapp'),
});

export const appointmentTypeSchema = z.object({
  name: z.string().trim().min(2).max(60),
  icon: z.string().max(8).optional(),
  durationMin: z.number().int().min(5).max(1440).default(30),
  durationBookerChoice: z.boolean().default(false),
  modality: z.enum(['in_person', 'online', 'phone', 'video']).default('online'),
  locationText: z.string().max(300).optional(),
  meetingLinkTemplate: z.string().max(300).optional(),
  availability: availabilitySchema.default({ timezone: 'America/Sao_Paulo', weekly: {} }),
  minNoticeMin: z.number().int().min(0).max(43200).default(120),
  bufferBeforeMin: z.number().int().min(0).max(240).default(0),
  bufferAfterMin: z.number().int().min(0).max(240).default(0),
  maxPerDay: z.number().int().min(1).max(100).nullable().optional(),
  futureHorizonDays: z.number().int().min(1).max(365).default(60),
  requiresConfirmation: z.boolean().default(false),
  bookingFields: z.array(bookingFieldSchema).max(15).default([]),
  reminders: z.array(reminderSchema).max(5).default([]),
  cancelPolicyText: z.string().max(600).optional(),
  active: z.boolean().default(true),
});

export const schedulingConfigSchema = z.object({
  // optOut=true => "Não desejo oferecer agendamento": some a config.
  optOut: z.boolean().default(false),
});

export type AppointmentTypeInput = z.infer<typeof appointmentTypeSchema>;

const DAY_LABEL: Record<string, string> = {
  mon: 'Segunda', tue: 'Terça', wed: 'Quarta', thu: 'Quinta',
  fri: 'Sexta', sat: 'Sábado', sun: 'Domingo',
};
const MODALITY_LABEL: Record<string, string> = {
  in_person: 'Presencial', online: 'Online', phone: 'Telefone', video: 'Vídeo',
};

function fmtAvailability(av: any): string {
  const weekly = av?.weekly || {};
  const lines: string[] = [];
  for (const d of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
    const wins = weekly[d];
    if (Array.isArray(wins) && wins.length > 0) {
      lines.push(`${DAY_LABEL[d]}: ${wins.map((w: string[]) => `${w[0]} às ${w[1]}`).join(', ')}`);
    }
  }
  return lines.length ? lines.join(' | ') : 'sem horários definidos';
}

/**
 * Constrói o documento textual que vai pro RAG. É a "verdade" que a IA lê para
 * saber o que pode agendar e sob quais regras. Determinístico (testável).
 */
export function buildSchedulingKnowledge(types: Array<AppointmentTypeInput & { id?: string }>): string {
  const active = types.filter((t) => t.active !== false);
  if (active.length === 0) {
    return 'AGENDAMENTO: o negócio não oferece agendamento pela IA no momento.';
  }
  const header = [
    '=== AGENDAMENTO DISPONÍVEL ===',
    'A IA PODE agendar com o cliente os tipos abaixo. Sempre confirme um horário',
    'REAL e livre na agenda antes de prometer. Nunca invente horário.',
    '',
  ];
  const blocks = active.map((t) => {
    const parts = [
      `• Tipo: ${t.name}${t.icon ? ` ${t.icon}` : ''}`,
      `  Duração: ${t.durationMin} min${t.durationBookerChoice ? ' (cliente pode escolher)' : ''}`,
      `  Modalidade: ${MODALITY_LABEL[t.modality] || t.modality}${t.locationText ? ` (${t.locationText})` : ''}`,
      `  Disponibilidade (${t.availability?.timezone || 'America/Sao_Paulo'}): ${fmtAvailability(t.availability)}`,
      `  Antecedência mínima: ${t.minNoticeMin} min. Agenda até ${t.futureHorizonDays} dias à frente.`,
    ];
    if (t.bufferBeforeMin || t.bufferAfterMin) {
      parts.push(`  Folga: ${t.bufferBeforeMin}min antes, ${t.bufferAfterMin}min depois.`);
    }
    if (t.maxPerDay) parts.push(`  Limite: ${t.maxPerDay} por dia.`);
    if (t.requiresConfirmation) parts.push('  Requer confirmação humana antes de valer.');
    if (t.bookingFields?.length) {
      parts.push(`  Pergunte ao cliente: ${t.bookingFields.map((f) => `${f.label}${f.required ? ' (obrigatório)' : ''}`).join(', ')}.`);
    }
    if (t.reminders?.length) {
      parts.push(`  Lembretes: ${t.reminders.map((r) => `${r.offsetMin}min antes por ${r.channel}`).join(', ')}.`);
    }
    if (t.cancelPolicyText) parts.push(`  Cancelamento/remarcação: ${t.cancelPolicyText}`);
    return parts.join('\n');
  });
  return [...header, ...blocks].join('\n');
}

export const SCHEDULING_RAG_SOURCE = 'agendamento-config.txt';
