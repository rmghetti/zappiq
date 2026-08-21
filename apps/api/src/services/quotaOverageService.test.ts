/**
 * quotaOverageService.test.ts — curto-circuito do meter aposentado (PR-L 20/08/2026).
 * ============================================================================
 * DECISÃO: packs + upgrade substituem o metered billing de R$ 0,03/msg; o
 * meter será arquivado no Stripe. Este teste TRAVA o comportamento novo:
 * mesmo com QUOTA_OVERAGE_MODE=enforce, autoOverage ligado e stripeCustomerId
 * presente (o cenário que antes COBRAVA), o serviço:
 *   ✓ NÃO chama a API do Stripe (fetch nunca dispara)
 *   ✓ loga um erro claro apontando a aposentadoria
 *   ✓ devolve reported=false com skipped='meter_aposentado_20260820'
 * E o modo audit_only continua com o skip silencioso de sempre (sem erro).
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── env mutável por teste (mesmo padrão do planLimits.quota.test.ts) ────
const envMock = {
  QUOTA_OVERAGE_MODE: 'enforce' as 'audit_only' | 'enforce',
  STRIPE_SECRET_KEY: 'sk_test_ficticia_para_teste',
};
vi.mock('../config/env.js', () => ({
  get env() {
    return envMock;
  },
}));

// ── prisma: org com o cenário que ANTES cobrava (autoOverage + customer) ─
const findUnique = vi.fn(async () => ({
  id: 'org-1',
  name: 'Org Teste',
  settings: {
    billing: { autoOverage: true },
    stripeCustomerId: 'cus_ficticio',
  },
}));
vi.mock('@zappiq/database', () => ({
  prisma: { organization: { findUnique: (...a: any[]) => findUnique(...a) } },
}));

const loggerError = vi.fn();
const loggerDebug = vi.fn();
vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: (...a: any[]) => loggerError(...a), debug: (...a: any[]) => loggerDebug(...a) },
}));

import { reportOverageMeterEvent, estimateOverageBrl } from './quotaOverageService.js';

const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'evt_x' }) }));

describe('reportOverageMeterEvent — meter aposentado (curto-circuito)', () => {
  beforeEach(() => {
    envMock.QUOTA_OVERAGE_MODE = 'enforce';
    envMock.STRIPE_SECRET_KEY = 'sk_test_ficticia_para_teste';
    findUnique.mockClear();
    loggerError.mockClear();
    loggerDebug.mockClear();
    fetchSpy.mockClear();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('enforce + autoOverage: NÃO chama o Stripe e loga erro de aposentadoria', async () => {
    const r = await reportOverageMeterEvent({ orgId: 'org-1', count: 5 });

    expect(r.reported).toBe(false);
    expect(r.skipped).toBe('meter_aposentado_20260820');
    // Nenhum HTTP pro Stripe: cobrança por meter morto é impossível.
    expect(fetchSpy).not.toHaveBeenCalled();
    // Erro claro no log, apontando a decisão.
    expect(loggerError).toHaveBeenCalledTimes(1);
    expect(String(loggerError.mock.calls[0][0])).toContain('METER APOSENTADO');
    expect(String(loggerError.mock.calls[0][0])).toContain('org=org-1');
  });

  it('audit_only: mantém o skip silencioso histórico (sem erro, sem Stripe)', async () => {
    envMock.QUOTA_OVERAGE_MODE = 'audit_only';
    const r = await reportOverageMeterEvent({ orgId: 'org-1', count: 3 });

    expect(r.reported).toBe(false);
    expect(r.skipped).toBe('mode_audit_only');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('count <= 0 continua saindo cedo sem log de erro', async () => {
    const r = await reportOverageMeterEvent({ orgId: 'org-1', count: 0 });
    expect(r).toEqual({ reported: false, skipped: 'count_zero_or_negative' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(loggerError).not.toHaveBeenCalled();
  });
});

describe('estimateOverageBrl — deprecated mas ainda computa o valor histórico', () => {
  it('mantém R$ 0,03/msg enquanto planLimits ainda chama (teto de projeção)', () => {
    expect(estimateOverageBrl(100)).toBeCloseTo(3.0);
    expect(estimateOverageBrl(0)).toBe(0);
  });
});
