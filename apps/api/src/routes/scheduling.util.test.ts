import { describe, it, expect } from 'vitest';
import {
  appointmentTypeSchema,
  buildSchedulingKnowledge,
  availabilitySchema,
} from './scheduling.util.js';

describe('appointmentTypeSchema', () => {
  it('aceita um tipo mínimo e aplica defaults', () => {
    const r = appointmentTypeSchema.parse({ name: 'Consulta' });
    expect(r.durationMin).toBe(30);
    expect(r.modality).toBe('online');
    expect(r.minNoticeMin).toBe(120);
    expect(r.active).toBe(true);
  });

  it('rejeita nome curto e duração inválida', () => {
    expect(appointmentTypeSchema.safeParse({ name: 'C' }).success).toBe(false);
    expect(appointmentTypeSchema.safeParse({ name: 'Consulta', durationMin: 0 }).success).toBe(false);
  });

  it('valida janelas de horário HH:MM', () => {
    expect(availabilitySchema.safeParse({ weekly: { mon: [['09:00', '18:00']] } }).success).toBe(true);
    expect(availabilitySchema.safeParse({ weekly: { mon: [['9h', '18h']] } }).success).toBe(false);
  });
});

describe('buildSchedulingKnowledge (doc do RAG)', () => {
  it('descreve os tipos ativos de forma que a IA respeite as regras', () => {
    const doc = buildSchedulingKnowledge([
      appointmentTypeSchema.parse({
        name: 'Consulta',
        durationMin: 45,
        modality: 'in_person',
        locationText: 'Rua X, 100',
        availability: { timezone: 'America/Sao_Paulo', weekly: { mon: [['09:00', '12:00']] } },
        bookingFields: [{ key: 'convenio', label: 'Qual convênio?', type: 'text', required: true }],
      }),
    ]);
    expect(doc).toContain('AGENDAMENTO DISPONÍVEL');
    expect(doc).toContain('Consulta');
    expect(doc).toContain('45 min');
    expect(doc).toContain('Presencial');
    expect(doc).toContain('Rua X, 100');
    expect(doc).toContain('Segunda: 09:00 às 12:00');
    expect(doc).toContain('Qual convênio? (obrigatório)');
    // instrução anti-alucinação presente
    expect(doc.toLowerCase()).toContain('nunca invente');
  });

  it('quando não há tipos ativos, deixa claro que não há agendamento', () => {
    expect(buildSchedulingKnowledge([])).toContain('não oferece agendamento');
    const inactive = buildSchedulingKnowledge([appointmentTypeSchema.parse({ name: 'Consulta', active: false })]);
    expect(inactive).toContain('não oferece agendamento');
  });
});
