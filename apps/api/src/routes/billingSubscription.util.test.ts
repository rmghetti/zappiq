/**
 * billingSubscription.util.test.ts — FEATURE 5b.1
 * ============================================================================
 * Cobre buildSubscriptionState + helpers: estado REAL da assinatura vindo das
 * colunas da Organization + stripe_invoices, com estados honestos quando NAO
 * ha Stripe (o caso comum hoje). Garante que a tela nao invente assinatura.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  buildSubscriptionState,
  deriveStatus,
  normalizeCycle,
  daysLeft,
  type OrgSubscriptionInput,
  type InvoiceInput,
} from './billingSubscription.util.js';

const NOW = new Date('2026-07-05T12:00:00Z');

function makeOrg(overrides: Partial<OrgSubscriptionInput> = {}): OrgSubscriptionInput {
  return {
    plan: 'IZA_LITE',
    subscriptionStatus: null,
    billingCycle: null,
    trialEndsAt: null,
    paidAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    ...overrides,
  };
}

describe('normalizeCycle', () => {
  it('aceita monthly/annual', () => {
    expect(normalizeCycle('monthly')).toBe('monthly');
    expect(normalizeCycle('annual')).toBe('annual');
  });
  it('devolve null pra lixo/nulo (nunca inventa)', () => {
    expect(normalizeCycle(null)).toBeNull();
    expect(normalizeCycle(undefined)).toBeNull();
    expect(normalizeCycle('weekly')).toBeNull();
    expect(normalizeCycle('')).toBeNull();
  });
});

describe('daysLeft', () => {
  it('arredonda pra cima e tem piso 0', () => {
    expect(daysLeft(new Date('2026-07-19T12:00:00Z'), NOW)).toBe(14);
    // 13d e meio -> 14 (ceil)
    expect(daysLeft(new Date('2026-07-19T00:00:00Z'), NOW)).toBe(14);
    // passado -> 0, nunca negativo
    expect(daysLeft(new Date('2026-07-01T00:00:00Z'), NOW)).toBe(0);
  });
  it('null quando sem data', () => {
    expect(daysLeft(null, NOW)).toBeNull();
    expect(daysLeft(undefined, NOW)).toBeNull();
  });
});

describe('deriveStatus', () => {
  it('espelha subscriptionStatus explicito', () => {
    expect(deriveStatus(makeOrg({ subscriptionStatus: 'active' }), NOW)).toBe('active');
    expect(deriveStatus(makeOrg({ subscriptionStatus: 'past_due' }), NOW)).toBe('past_due');
    expect(deriveStatus(makeOrg({ subscriptionStatus: 'canceled' }), NOW)).toBe('canceled');
    expect(deriveStatus(makeOrg({ subscriptionStatus: 'trialing' }), NOW)).toBe('trialing');
  });

  it('deriva trialing quando ha trialEndsAt no futuro e sem status (org pre-Stripe)', () => {
    expect(
      deriveStatus(makeOrg({ trialEndsAt: new Date('2026-07-19T12:00:00Z') }), NOW),
    ).toBe('trialing');
  });

  it('no_subscription quando sem status e trial expirado/ausente', () => {
    expect(deriveStatus(makeOrg(), NOW)).toBe('no_subscription');
    expect(
      deriveStatus(makeOrg({ trialEndsAt: new Date('2026-07-01T00:00:00Z') }), NOW),
    ).toBe('no_subscription');
  });
});

describe('buildSubscriptionState', () => {
  it('org sem Stripe e sem trial -> no_subscription honesto', () => {
    const s = buildSubscriptionState({ org: makeOrg(), lastInvoice: null, now: NOW });
    expect(s.status).toBe('no_subscription');
    expect(s.hasStripeSubscription).toBe(false);
    expect(s.cycle).toBeNull();
    expect(s.plan).toBe('IZA_LITE');
    expect(s.trialEndsAt).toBeNull();
    expect(s.trialDaysLeft).toBeNull();
    expect(s.nextInvoice).toBeUndefined();
    expect(s.lastInvoice).toBeUndefined();
  });

  it('org em trial (sem Stripe) -> countdown + nextInvoice = fim do trial', () => {
    const trialEnd = new Date('2026-07-19T12:00:00Z');
    const s = buildSubscriptionState({
      org: makeOrg({ trialEndsAt: trialEnd }),
      lastInvoice: null,
      now: NOW,
    });
    expect(s.status).toBe('trialing');
    expect(s.trialDaysLeft).toBe(14);
    expect(s.trialEndsAt).toBe(trialEnd.toISOString());
    expect(s.nextInvoice).toEqual({ dueAt: trialEnd.toISOString() });
    expect(s.hasStripeSubscription).toBe(false);
  });

  it('assinatura ativa com Stripe + ciclo anual + ultima fatura', () => {
    const inv: InvoiceInput = {
      amountBrlCents: 19992,
      status: 'paid',
      periodStart: new Date('2026-06-05T00:00:00Z'),
      periodEnd: new Date('2026-07-05T00:00:00Z'),
      paidAt: new Date('2026-06-05T10:00:00Z'),
    };
    const s = buildSubscriptionState({
      org: makeOrg({
        subscriptionStatus: 'active',
        billingCycle: 'annual',
        stripeCustomerId: 'cus_x',
        stripeSubscriptionId: 'sub_x',
        paidAt: new Date('2026-06-05T10:00:00Z'),
      }),
      lastInvoice: inv,
      now: NOW,
    });
    expect(s.status).toBe('active');
    expect(s.hasStripeSubscription).toBe(true);
    expect(s.cycle).toBe('annual');
    expect(s.trialDaysLeft).toBeNull();
    expect(s.trialEndsAt).toBeNull();
    // active nao deriva nextInvoice aqui (sem valor futuro real do Stripe)
    expect(s.nextInvoice).toBeUndefined();
    expect(s.lastInvoice).toEqual({
      amountBrlCents: 19992,
      status: 'paid',
      periodStart: '2026-06-05T00:00:00.000Z',
      periodEnd: '2026-07-05T00:00:00.000Z',
      paidAt: '2026-06-05T10:00:00.000Z',
    });
  });

  it('past_due ainda expoe ultima fatura, sem inventar trial', () => {
    const s = buildSubscriptionState({
      org: makeOrg({
        subscriptionStatus: 'past_due',
        billingCycle: 'monthly',
        stripeSubscriptionId: 'sub_y',
      }),
      lastInvoice: {
        amountBrlCents: 24990,
        status: 'paid',
        periodStart: null,
        periodEnd: null,
        paidAt: new Date('2026-06-05T10:00:00Z'),
      },
      now: NOW,
    });
    expect(s.status).toBe('past_due');
    expect(s.trialDaysLeft).toBeNull();
    expect(s.nextInvoice).toBeUndefined();
    expect(s.lastInvoice?.amountBrlCents).toBe(24990);
    expect(s.lastInvoice?.periodStart).toBeNull();
  });

  it('fallback de plan pra IZA_LITE quando null', () => {
    const s = buildSubscriptionState({
      org: makeOrg({ plan: null }),
      lastInvoice: null,
      now: NOW,
    });
    expect(s.plan).toBe('IZA_LITE');
  });
});
