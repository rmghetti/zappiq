import { describe, it, expect } from 'vitest';
import { digestEntryFor } from './superadminTrialDigest.util.js';

const now = new Date('2026-07-06T12:00:00Z');
const base = {
  churnedAt: null,
  subscriptionStatus: null,
  stripeSubscriptionId: null,
  paidAt: null,
  trialConverted: false,
  paywallGraceUntil: null,
  now,
};

function inDays(n: number): Date {
  return new Date(now.getTime() + n * 86_400_000);
}

describe('digestEntryFor', () => {
  it('TRIAL a 3 dias → entra (trial_ending, daysLeft 3)', () => {
    const e = digestEntryFor({ ...base, isTrialActive: true, trialEndsAt: inDays(3) });
    expect(e).toEqual({ reason: 'trial_ending', daysLeft: 3 });
  });

  it('TRIAL a 5 dias → não entra', () => {
    expect(digestEntryFor({ ...base, isTrialActive: true, trialEndsAt: inDays(5) })).toBeNull();
  });

  it('TRIAL a 1 dia → entra', () => {
    expect(digestEntryFor({ ...base, isTrialActive: true, trialEndsAt: inDays(1) })?.reason).toBe('trial_ending');
  });

  it('org em carência (soft) → entra como grace_ending com dias restantes', () => {
    const e = digestEntryFor({ ...base, isTrialActive: false, trialEndsAt: inDays(-30), paywallGraceUntil: inDays(4) });
    expect(e).toEqual({ reason: 'grace_ending', daysLeft: 4 });
  });

  it('trial vencido sem carência (hard) → não entra (já bloqueado, não é ação de nutrição)', () => {
    expect(digestEntryFor({ ...base, isTrialActive: false, trialEndsAt: inDays(-30) })).toBeNull();
  });

  it('org paga (ACTIVE) → não entra', () => {
    expect(
      digestEntryFor({ ...base, stripeSubscriptionId: 'sub_1', subscriptionStatus: 'active', isTrialActive: false, trialEndsAt: inDays(-1) }),
    ).toBeNull();
  });
});
