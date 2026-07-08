import { describe, it, expect } from 'vitest';
import { tzOffsetMs, localMidnightUtcMs, localDayOfWeek } from './schedulingTz.js';

describe('schedulingTz', () => {
  it('São Paulo é UTC-3 (offset -3h)', () => {
    // 2027-01-15 12:00 UTC — SP sem horário de verão desde 2019
    const ms = Date.UTC(2027, 0, 15, 12, 0, 0);
    expect(tzOffsetMs('America/Sao_Paulo', ms)).toBe(-3 * 3_600_000);
  });

  it('meia-noite local de SP fica às 03:00 UTC', () => {
    const nowMs = Date.UTC(2027, 0, 15, 12, 0, 0);
    const midnight = localMidnightUtcMs('America/Sao_Paulo', nowMs, 0);
    // 00:00 em SP (UTC-3) = 03:00 UTC do mesmo dia
    const d = new Date(midnight);
    expect(d.getUTCHours()).toBe(3);
    expect(d.getUTCDate()).toBe(15);
  });

  it('dia da semana local correto', () => {
    // 2027-01-15 é uma sexta-feira (dow=5)
    const nowMs = Date.UTC(2027, 0, 15, 12, 0, 0);
    expect(localDayOfWeek('America/Sao_Paulo', nowMs, 0)).toBe(5);
    expect(localDayOfWeek('America/Sao_Paulo', nowMs, 2)).toBe(0); // domingo
  });
});
