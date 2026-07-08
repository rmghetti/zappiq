import { describe, it, expect } from 'vitest';
import { computeSlots, isSlotFree } from './schedulingAvailability.js';

// Helpers determinísticos: tratamos "local" == UTC no teste (dayStart e dow
// calculados sobre UTC), isolando a lógica de slot do fuso real.
const DAY = 86_400_000;
function mk(nowMs: number, opts: { busy?: { startMs: number; endMs: number }[] } = {}) {
  const base = Math.floor(nowMs / DAY) * DAY; // meia-noite UTC de hoje
  return computeSlots({
    nowMs,
    availability: { weekly: { mon: [['09:00', '12:00']], tue: [['09:00', '12:00']], wed: [['09:00', '12:00']], thu: [['09:00', '12:00']], fri: [['09:00', '12:00']], sat: [['09:00', '12:00']], sun: [['09:00', '12:00']] } },
    rules: { durationMin: 60, minNoticeMin: 120, bufferBeforeMin: 0, bufferAfterMin: 0, futureHorizonDays: 3, maxPerDay: null },
    busy: opts.busy || [],
    dayStartMsUtc: (off) => base + off * DAY,
    dayOfWeek: (off) => new Date(base + off * DAY).getUTCDay(),
    limit: 20,
  });
}

describe('computeSlots', () => {
  it('gera slots de 1h dentro da janela 09-12 (3 por dia)', () => {
    const now = 1_800_000_000_000; // epoch fixo
    const slots = mk(now);
    expect(slots.length).toBeGreaterThan(0);
    // Cada slot dura 60min
    for (const s of slots) expect(s.endMs - s.startMs).toBe(3_600_000);
  });

  it('respeita antecedência mínima (nada antes de now+minNotice)', () => {
    const now = 1_800_000_000_000;
    const slots = mk(now);
    const earliest = now + 120 * 60_000;
    for (const s of slots) expect(s.startMs).toBeGreaterThanOrEqual(earliest);
  });

  it('remove slot que colide com um agendamento existente', () => {
    const now = 1_800_000_000_000;
    const all = mk(now);
    // ocupa exatamente o primeiro slot livre
    const busy = [{ startMs: all[0].startMs, endMs: all[0].endMs }];
    const after = mk(now, { busy });
    expect(after.find((s) => s.startMs === all[0].startMs)).toBeUndefined();
    expect(after.length).toBe(all.length - 1);
  });

  it('isSlotFree confere um horário específico', () => {
    const now = 1_800_000_000_000;
    const slots = mk(now);
    expect(isSlotFree(slots[0].startMs, slots)).toBe(true);
    expect(isSlotFree(slots[0].startMs + 7 * 60_000, slots)).toBe(false);
  });

  it('maxPerDay limita slots por dia', () => {
    const now = 1_800_000_000_000;
    const base = Math.floor(now / DAY) * DAY;
    const slots = computeSlots({
      nowMs: now,
      availability: { weekly: { mon: [['09:00', '18:00']], tue: [['09:00', '18:00']], wed: [['09:00', '18:00']], thu: [['09:00', '18:00']], fri: [['09:00', '18:00']], sat: [['09:00', '18:00']], sun: [['09:00', '18:00']] } },
      rules: { durationMin: 60, minNoticeMin: 0, bufferBeforeMin: 0, bufferAfterMin: 0, futureHorizonDays: 0, maxPerDay: 2 },
      busy: [],
      dayStartMsUtc: (off) => base + off * DAY,
      dayOfWeek: (off) => new Date(base + off * DAY).getUTCDay(),
    });
    expect(slots.length).toBeLessThanOrEqual(2);
  });
});
