import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const findUnique = vi.fn();
const cacheGet = vi.fn();
const cacheSet = vi.fn();
const cacheDel = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: { organization: { findUnique: (...a: any[]) => findUnique(...a) } },
}));
vi.mock('../services/cloud/index.js', () => ({
  cache: {
    get: (...a: any[]) => cacheGet(...a),
    set: (...a: any[]) => cacheSet(...a),
    del: (...a: any[]) => cacheDel(...a),
  },
}));
vi.mock('../utils/logger.js', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { requireActivePlan } from './requireActivePlan.js';

function mkRes() {
  const r: any = {};
  r.status = vi.fn(() => r);
  r.json = vi.fn(() => r);
  return r;
}

const past = new Date(Date.now() - 40 * 864e5);
const future = new Date(Date.now() + 5 * 864e5);

const expiredOrg = {
  plan: 'IZA_LITE',
  trialEndsAt: past,
  isTrialActive: false,
  trialConverted: false,
  paidAt: null,
  churnedAt: null,
  stripeSubscriptionId: null,
  subscriptionStatus: 'trialing', // podre (incidente Antonella)
  paywallGraceUntil: null,
};

beforeEach(() => {
  findUnique.mockReset();
  cacheGet.mockReset().mockResolvedValue(null);
  cacheSet.mockReset().mockResolvedValue(true);
  cacheDel.mockReset().mockResolvedValue(true);
  delete process.env.TRIAL_PAYWALL_ENFORCE;
});
afterEach(() => {
  delete process.env.TRIAL_PAYWALL_ENFORCE;
});

describe('requireActivePlan', () => {
  it('SUPERADMIN passa sem tocar no banco', async () => {
    const next = vi.fn();
    await requireActivePlan({ user: { role: 'SUPERADMIN' }, organizationId: 'o1' } as any, mkRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('TRIAL_EXPIRED sem carência → 402 (não chama next)', async () => {
    findUnique.mockResolvedValue(expiredOrg);
    const res = mkRes();
    const next = vi.fn();
    await requireActivePlan({ user: { role: 'ADMIN' }, organizationId: 'o1' } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'trial_expired', redirectTo: '/billing' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('TRIAL_EXPIRED com carência ativa → passa com req.paywall=soft', async () => {
    findUnique.mockResolvedValue({ ...expiredOrg, paywallGraceUntil: future });
    const req: any = { user: { role: 'ADMIN' }, organizationId: 'o1' };
    const next = vi.fn();
    await requireActivePlan(req, mkRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.paywall).toBe('soft');
  });

  it('ENTERPRISE isento mesmo vencido', async () => {
    findUnique.mockResolvedValue({ ...expiredOrg, plan: 'ENTERPRISE' });
    const next = vi.fn();
    await requireActivePlan({ user: { role: 'ADMIN' }, organizationId: 'o1' } as any, mkRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('kill-switch TRIAL_PAYWALL_ENFORCE=0 → passa sem tocar no banco', async () => {
    process.env.TRIAL_PAYWALL_ENFORCE = '0';
    const next = vi.fn();
    await requireActivePlan({ user: { role: 'ADMIN' }, organizationId: 'o1' } as any, mkRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('erro no banco → fail-open (next, sem 402)', async () => {
    findUnique.mockRejectedValue(new Error('db down'));
    const res = mkRes();
    const next = vi.fn();
    await requireActivePlan({ user: { role: 'ADMIN' }, organizationId: 'o1' } as any, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('usa cache quando presente (não vai ao banco)', async () => {
    cacheGet.mockResolvedValue(JSON.stringify({ ...expiredOrg, paywallGraceUntil: future }));
    const req: any = { user: { role: 'ADMIN' }, organizationId: 'o1' };
    const next = vi.fn();
    await requireActivePlan(req, mkRes(), next);
    expect(findUnique).not.toHaveBeenCalled();
    expect(req.paywall).toBe('soft');
  });
});
