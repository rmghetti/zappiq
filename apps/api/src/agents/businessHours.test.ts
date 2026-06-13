import { describe, it, expect } from 'vitest';
import { isOpen } from './businessHours.js';
import type { BusinessHoursConfig } from './flowEngine.js';

// Seg-Sex 09:00–18:00, América/Sao_Paulo. Sáb/Dom fechado.
const cfg: BusinessHoursConfig = {
  timezone: 'America/Sao_Paulo',
  days: {
    0: null,
    1: { open: '09:00', close: '18:00' },
    2: { open: '09:00', close: '18:00' },
    3: { open: '09:00', close: '18:00' },
    4: { open: '09:00', close: '18:00' },
    5: { open: '09:00', close: '18:00' },
    6: null,
  },
};

// Helper: instante UTC. SP = UTC-3 (sem horário de verão desde 2019).
const at = (iso: string) => new Date(iso);

describe('isOpen', () => {
  it('dentro do horário em dia útil → aberto', () => {
    // Terça 2026-06-16 14:00 SP = 17:00Z
    expect(isOpen(cfg, at('2026-06-16T17:00:00Z'))).toBe(true);
  });

  it('antes de abrir → fechado', () => {
    // Terça 08:00 SP = 11:00Z
    expect(isOpen(cfg, at('2026-06-16T11:00:00Z'))).toBe(false);
  });

  it('exatamente no fechamento → fechado (intervalo [open, close))', () => {
    // Terça 18:00 SP = 21:00Z
    expect(isOpen(cfg, at('2026-06-16T21:00:00Z'))).toBe(false);
  });

  it('fim de semana → fechado', () => {
    // Domingo 2026-06-14 14:00 SP = 17:00Z
    expect(isOpen(cfg, at('2026-06-14T17:00:00Z'))).toBe(false);
  });

  it('config null ou now null → fechado (fail-closed)', () => {
    expect(isOpen(null, at('2026-06-16T17:00:00Z'))).toBe(false);
    expect(isOpen(cfg, null)).toBe(false);
  });

  it('janela vira-noite (22:00–02:00) cobre madrugada', () => {
    const night: BusinessHoursConfig = {
      timezone: 'America/Sao_Paulo',
      days: { 0:null,1:null,2:null,3:null,4:null,5:{ open:'22:00', close:'02:00' },6:null },
    };
    // Sexta 23:00 SP = sábado 02:00Z → aberto (lado da sexta)
    expect(isOpen(night, at('2026-06-13T02:00:00Z'))).toBe(true);
  });
});
