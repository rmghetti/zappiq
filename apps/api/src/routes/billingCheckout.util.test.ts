import { describe, it, expect } from 'vitest';
import { effectiveTrialDays, type TrialEligibilityOrg } from './billingCheckout.util.js';

const NEVER_TRIALED: TrialEligibilityOrg = {
  trialStartedAt: null,
  trialEndsAt: null,
  paidAt: null,
  stripeSubscriptionId: null,
};

describe('effectiveTrialDays', () => {
  it('concede o trial configurado pra org que nunca teve trial nem pagou', () => {
    expect(effectiveTrialDays(14, NEVER_TRIALED)).toBe(14);
  });

  it('plano sem trial configurado nunca concede (mesmo org virgem)', () => {
    expect(effectiveTrialDays(0, NEVER_TRIALED)).toBe(0);
  });

  it('NAO concede novo trial a org com trial em andamento', () => {
    expect(
      effectiveTrialDays(14, {
        ...NEVER_TRIALED,
        trialStartedAt: new Date('2026-07-01'),
        trialEndsAt: new Date('2026-07-15'),
      })
    ).toBe(0);
  });

  it('NAO concede novo trial a org com trial ja vencido', () => {
    expect(
      effectiveTrialDays(14, {
        ...NEVER_TRIALED,
        trialStartedAt: new Date('2026-05-01'),
        trialEndsAt: new Date('2026-05-15'),
      })
    ).toBe(0);
  });

  it('NAO concede trial a org que ja pagou alguma vez (paidAt)', () => {
    expect(
      effectiveTrialDays(14, { ...NEVER_TRIALED, paidAt: new Date('2026-06-01') })
    ).toBe(0);
  });

  it('NAO concede trial a org com assinatura Stripe real', () => {
    expect(
      effectiveTrialDays(14, { ...NEVER_TRIALED, stripeSubscriptionId: 'sub_123' })
    ).toBe(0);
  });

  it('so trialEndsAt setado (dado parcial/legado) tambem bloqueia', () => {
    expect(
      effectiveTrialDays(14, { ...NEVER_TRIALED, trialEndsAt: new Date('2026-07-15') })
    ).toBe(0);
  });

  it('org null (nao encontrada) nao concede trial — fail-closed', () => {
    expect(effectiveTrialDays(14, null)).toBe(0);
  });
});
