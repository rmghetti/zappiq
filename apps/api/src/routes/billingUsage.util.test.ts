/**
 * billingUsage.util.test.ts — FIX W3.1
 * ============================================================================
 * Cobre computeBillingUsage: uso REAL do periodo vs limite do plano. Garante
 * que o bloco "Uso do plano atual" nao volte a ser mock hardcoded.
 * ============================================================================
 */
import { describe, it, expect, vi } from 'vitest';
import { PLAN_CONFIG } from '@zappiq/shared';
import {
  computeBillingUsage,
  resolvePlanId,
  currentPeriodYearMonth,
  currentMonthRange,
  type ComputeBillingUsageDeps,
} from './billingUsage.util.js';

function makeDeps(overrides: Partial<ComputeBillingUsageDeps> = {}): ComputeBillingUsageDeps {
  return {
    countConversations: vi.fn().mockResolvedValue(0),
    countAgents: vi.fn().mockResolvedValue(0),
    countDocs: vi.fn().mockResolvedValue(0),
    getAiMessagesUsage: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

describe('resolvePlanId', () => {
  it('mantem plano valido', () => {
    expect(resolvePlanId('GROWTH')).toBe('GROWTH');
    expect(resolvePlanId('SCALE')).toBe('SCALE');
  });

  it('faz fallback pra IZA_LITE em plano nulo/desconhecido', () => {
    expect(resolvePlanId(null)).toBe('IZA_LITE');
    expect(resolvePlanId(undefined)).toBe('IZA_LITE');
    expect(resolvePlanId('PLANO_INEXISTENTE')).toBe('IZA_LITE');
  });
});

describe('currentPeriodYearMonth / currentMonthRange', () => {
  it('formata YYYY-MM em UTC (mes 1-indexed, zero-pad)', () => {
    expect(currentPeriodYearMonth(new Date('2026-07-05T00:00:00Z'))).toBe('2026-07');
    expect(currentPeriodYearMonth(new Date('2026-01-31T23:00:00Z'))).toBe('2026-01');
  });

  it('range cobre [1o dia do mes, 1o dia do proximo) em UTC', () => {
    const { start, end } = currentMonthRange(new Date('2026-07-05T12:00:00Z'));
    expect(start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });
});

describe('computeBillingUsage', () => {
  it('casa used real com os limites do plano IZA_LITE', async () => {
    const deps = makeDeps({
      countConversations: vi.fn().mockResolvedValue(340),
      countAgents: vi.fn().mockResolvedValue(1),
      countDocs: vi.fn().mockResolvedValue(3),
      getAiMessagesUsage: vi.fn().mockResolvedValue(420),
      now: new Date('2026-07-05T00:00:00Z'),
    });

    const r = await computeBillingUsage('IZA_LITE', deps);
    const lim = PLAN_CONFIG.IZA_LITE.limits;

    expect(r.planId).toBe('IZA_LITE');
    expect(r.period).toBe('2026-07');
    expect(r.conversas).toEqual({ used: 340, limit: lim.contacts });
    expect(r.atendentes).toEqual({ used: 1, limit: lim.agents });
    expect(r.docs).toEqual({ used: 3, limit: lim.knowledgeBaseDocs });
    expect(r.aiMessages).toEqual({ used: 420, limit: lim.aiMessagesPerMonth });
  });

  it('usa limites do plano correto (GROWTH != IZA_LITE)', async () => {
    const r = await computeBillingUsage('GROWTH', makeDeps());
    const lim = PLAN_CONFIG.GROWTH.limits;
    expect(r.atendentes.limit).toBe(lim.agents);
    expect(r.docs.limit).toBe(lim.knowledgeBaseDocs);
    expect(r.aiMessages.limit).toBe(lim.aiMessagesPerMonth);
    // sanity: GROWTH tem mais atendentes que Lite (nao e o mesmo mock fixo)
    expect(r.atendentes.limit).toBeGreaterThan(PLAN_CONFIG.IZA_LITE.limits.agents);
  });

  it('plano nulo cai em IZA_LITE mas ainda reflete used real', async () => {
    const deps = makeDeps({ countDocs: vi.fn().mockResolvedValue(7) });
    const r = await computeBillingUsage(null, deps);
    expect(r.planId).toBe('IZA_LITE');
    expect(r.docs.used).toBe(7);
  });

  it('nao inventa numeros: used vem 100% das deps injetadas', async () => {
    const countConversations = vi.fn().mockResolvedValue(12);
    const r = await computeBillingUsage('SCALE', makeDeps({ countConversations }));
    expect(countConversations).toHaveBeenCalledOnce();
    expect(r.conversas.used).toBe(12);
    // sem chamadas reais nenhum campo herda o mock antigo 340/1/3
    expect(r.atendentes.used).toBe(0);
    expect(r.docs.used).toBe(0);
  });
});
