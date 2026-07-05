/**
 * planLimits.quota.test.ts — W2.5 (quota nunca aplicada)
 * ============================================================================
 * enforceAiReplyQuota é o gate montado no pipeline de resposta da IA
 * (agentOrchestrator) que finalmente CONSOME e (em enforce) BLOQUEIA a quota
 * de aiMessagesPerMonth. Antes deste fix, checkLimit/enforceLimit existiam mas
 * não tinham caller vivo no fluxo de resposta — a quota nunca era aplicada.
 *
 * Cobertura:
 *   audit_only (default):
 *     ✓ dentro do plano → allowed, consome 1 crédito
 *     ✓ acima do plano → allowed (NÃO bloqueia), audita + reporta overage
 *   enforce:
 *     ✓ dentro do plano → allowed, consome 1 crédito
 *     ✓ acima do plano sem autoOverage/grace → BLOQUEIA (allowed=false), NÃO consome
 *     ✓ acima do plano com autoOverage → allowed (overage), consome + reporta
 *   ✓ erro interno → fail-soft (allowed=true)
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── env mutável por teste ────────────────────────────────────────────────
const envMock = { QUOTA_OVERAGE_MODE: 'audit_only' as 'audit_only' | 'enforce' };
vi.mock('../config/env.js', () => ({
  get env() {
    return envMock;
  },
}));

// ── prisma: org STARTER (aiMessagesPerMonth=1500), createdAt antigo (sem grace) ─
const orgRecord: any = {
  id: 'org-1',
  plan: 'STARTER',
  isTrialActive: false,
  trialConverted: true,
  trialEndsAt: null,
  trialCostCapUsd: 0,
  createdAt: new Date('2020-01-01'), // > 60d → sem grace period
  settings: { billing: {} },
};
const findUnique = vi.fn(async () => orgRecord);
vi.mock('@zappiq/database', () => ({
  prisma: { organization: { findUnique: (...a: any[]) => findUnique(...a) } },
}));

// ── cache: getUsage lê 'current', incrementUsage soma ────────────────────
let usageCurrent = 0;
const incrby = vi.fn(async (_k: string, amount: number) => {
  usageCurrent += amount;
  return usageCurrent;
});
const cacheGet = vi.fn(async () => (usageCurrent > 0 ? String(usageCurrent) : null));
const expire = vi.fn(async () => true);
vi.mock('../services/cloud/index.js', () => ({
  cache: {
    incrby: (...a: any[]) => incrby(...(a as [string, number])),
    incrbyfloat: vi.fn(async () => 0),
    get: (...a: any[]) => cacheGet(...(a as [string])),
    expire: (...a: any[]) => expire(...(a as [string, number])),
  },
}));

// ── overage reporter mockado ─────────────────────────────────────────────
const reportOverageMeterEvent = vi.fn(async () => ({ reported: true, meterEventId: 'evt_1' }));
vi.mock('../services/quotaOverageService.js', () => ({
  reportOverageMeterEvent: (...a: any[]) => reportOverageMeterEvent(...a),
  estimateOverageBrl: (n: number) => n * 0.03,
}));

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { enforceAiReplyQuota } from './planLimits.js';

function resetState(opts?: { current?: number; billing?: any; plan?: string }) {
  usageCurrent = opts?.current ?? 0;
  orgRecord.plan = opts?.plan ?? 'STARTER';
  orgRecord.settings = { billing: opts?.billing ?? {} };
  incrby.mockClear();
  reportOverageMeterEvent.mockClear();
}

describe('enforceAiReplyQuota — W2.5 quota aplicada no pipeline da IA', () => {
  beforeEach(() => {
    envMock.QUOTA_OVERAGE_MODE = 'audit_only';
    resetState();
  });

  it('audit_only + dentro do plano: permite e consome 1 crédito', async () => {
    resetState({ current: 10 }); // 10/1500
    const r = await enforceAiReplyQuota('org-1');
    expect(r.allowed).toBe(true);
    expect(r.mode).toBe('audit_only');
    expect(incrby).toHaveBeenCalledTimes(1);
    expect(reportOverageMeterEvent).not.toHaveBeenCalled();
  });

  it('audit_only + acima do plano: NÃO bloqueia, audita e reporta overage', async () => {
    resetState({ current: 1500 }); // já no limite → wouldBe 1501 > 1500
    const r = await enforceAiReplyQuota('org-1');
    expect(r.allowed).toBe(true); // audit_only nunca bloqueia
    expect(r.isOverage).toBe(true);
    expect(incrby).toHaveBeenCalledTimes(1); // ainda consome
    expect(reportOverageMeterEvent).toHaveBeenCalledTimes(1);
  });

  it('enforce + dentro do plano: permite e consome', async () => {
    envMock.QUOTA_OVERAGE_MODE = 'enforce';
    resetState({ current: 10 });
    const r = await enforceAiReplyQuota('org-1');
    expect(r.allowed).toBe(true);
    expect(r.mode).toBe('enforce');
    expect(incrby).toHaveBeenCalledTimes(1);
  });

  it('enforce + acima do plano sem autoOverage/grace: BLOQUEIA e NÃO consome', async () => {
    envMock.QUOTA_OVERAGE_MODE = 'enforce';
    resetState({ current: 1500, billing: { autoOverage: false } });
    const r = await enforceAiReplyQuota('org-1');
    expect(r.allowed).toBe(false);
    expect(r.reason).toBeTruthy();
    expect(incrby).not.toHaveBeenCalled(); // bloqueou antes de consumir
    expect(reportOverageMeterEvent).not.toHaveBeenCalled();
  });

  it('enforce + acima do plano COM autoOverage: permite overage, consome e reporta', async () => {
    envMock.QUOTA_OVERAGE_MODE = 'enforce';
    resetState({ current: 1500, billing: { autoOverage: true } });
    const r = await enforceAiReplyQuota('org-1');
    expect(r.allowed).toBe(true);
    expect(r.isOverage).toBe(true);
    expect(incrby).toHaveBeenCalledTimes(1);
    expect(reportOverageMeterEvent).toHaveBeenCalledTimes(1);
  });

  it('erro interno (prisma throw): fail-soft, permite a resposta', async () => {
    envMock.QUOTA_OVERAGE_MODE = 'enforce';
    resetState({ current: 10 });
    findUnique.mockRejectedValueOnce(new Error('db down'));
    const r = await enforceAiReplyQuota('org-1');
    expect(r.allowed).toBe(true);
  });
});
