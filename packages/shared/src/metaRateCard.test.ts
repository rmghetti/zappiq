/**
 * metaRateCard.test.ts — rate card local da Meta (Resposta Meta 2026).
 *
 * O ponto que paga o teste: a virada de 01/10/2026, quando a categoria
 * service deixa de ser grátis e passa a valer a tarifa de referência
 * (utility). Errar essa data em um dia distorce toda projeção de custo.
 */
import { describe, expect, it } from 'vitest';
import { estimateMetaCostBrl, getMetaRatePerMessage, getMetaRateVigencia } from './metaRateCard.js';

describe('getMetaRatePerMessage — vigências', () => {
  it('service é grátis antes de 01/10/2026 e passa a 0.0350 BRL depois', () => {
    expect(getMetaRatePerMessage('service', new Date('2026-08-20T12:00:00Z'), 'BRL')).toBe(0);
    expect(getMetaRatePerMessage('service', new Date('2026-09-30T23:59:59Z'), 'BRL')).toBe(0);
    expect(getMetaRatePerMessage('service', new Date('2026-10-01T00:00:00Z'), 'BRL')).toBe(0.035);
    expect(getMetaRatePerMessage('service', new Date('2027-01-15T12:00:00Z'), 'BRL')).toBe(0.035);
  });

  it('service em USD acompanha a referência (0 antes, 0.0068 depois)', () => {
    expect(getMetaRatePerMessage('service', new Date('2026-09-01T00:00:00Z'), 'USD')).toBe(0);
    expect(getMetaRatePerMessage('service', new Date('2026-10-01T00:00:00Z'), 'USD')).toBe(0.0068);
  });

  it('utility é 0.0350 BRL / 0.0068 USD nas duas vigências', () => {
    expect(getMetaRatePerMessage('utility', new Date('2026-07-01T00:00:00Z'), 'BRL')).toBe(0.035);
    expect(getMetaRatePerMessage('utility', new Date('2026-12-01T00:00:00Z'), 'BRL')).toBe(0.035);
    expect(getMetaRatePerMessage('utility', new Date('2026-12-01T00:00:00Z'), 'USD')).toBe(0.0068);
  });

  it('marketing e authentication mantêm a tarifa oficial de 01/07/2026', () => {
    expect(getMetaRatePerMessage('marketing', new Date('2026-08-01T00:00:00Z'), 'BRL')).toBe(0.3217);
    expect(getMetaRatePerMessage('marketing', new Date('2026-11-01T00:00:00Z'), 'USD')).toBe(0.0625);
    expect(getMetaRatePerMessage('authentication', new Date('2026-08-01T00:00:00Z'), 'BRL')).toBe(0.035);
  });

  it('data anterior à primeira vigência cai na primeira (projeção retroativa)', () => {
    const antiga = new Date('2026-01-10T00:00:00Z');
    expect(getMetaRateVigencia(antiga).inicio).toBe('2026-07-01');
    expect(getMetaRatePerMessage('marketing', antiga, 'BRL')).toBe(0.3217);
    expect(getMetaRatePerMessage('service', antiga, 'BRL')).toBe(0);
  });
});

describe('estimateMetaCostBrl', () => {
  it('multiplica contagem pela tarifa BRL vigente, sem ruído de float', () => {
    // 3 × 0.035 em float puro daria 0.10500000000000001.
    expect(estimateMetaCostBrl('utility', 3, new Date('2026-08-01T00:00:00Z'))).toBe(0.105);
    expect(estimateMetaCostBrl('marketing', 1000, new Date('2026-08-01T00:00:00Z'))).toBe(321.7);
  });

  it('service: 0 em setembro, cobrado em outubro (o susto que o ledger evita)', () => {
    expect(estimateMetaCostBrl('service', 50_000, new Date('2026-09-15T00:00:00Z'))).toBe(0);
    expect(estimateMetaCostBrl('service', 50_000, new Date('2026-10-02T00:00:00Z'))).toBe(1750);
  });

  it('contagem inválida ou não positiva vale 0', () => {
    const d = new Date('2026-10-02T00:00:00Z');
    expect(estimateMetaCostBrl('marketing', 0, d)).toBe(0);
    expect(estimateMetaCostBrl('marketing', -5, d)).toBe(0);
    expect(estimateMetaCostBrl('marketing', Number.NaN, d)).toBe(0);
  });
});
