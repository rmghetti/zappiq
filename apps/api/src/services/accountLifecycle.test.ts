import { describe, it, expect } from 'vitest';
import { deriveLifecycleStage } from './accountLifecycle.js';

// Relógio fixo para determinismo.
const NOW = new Date('2026-07-04T12:00:00Z');
const FUTURE = new Date('2026-07-20T12:00:00Z'); // trial ainda aberto
const PAST = new Date('2026-06-20T12:00:00Z');   // trial já expirado

describe('deriveLifecycleStage', () => {
  it('CHURNED vence tudo (churnedAt presente, mesmo com assinatura ativa)', () => {
    expect(
      deriveLifecycleStage({
        now: NOW,
        churnedAt: PAST,
        stripeSubscriptionId: 'sub_123',
        subscriptionStatus: 'active',
        isTrialActive: true,
        trialEndsAt: FUTURE,
      }),
    ).toBe('CHURNED');
  });

  it('PAST_DUE quando subscriptionStatus = past_due', () => {
    expect(
      deriveLifecycleStage({ now: NOW, subscriptionStatus: 'past_due', stripeSubscriptionId: 'sub_1' }),
    ).toBe('PAST_DUE');
  });

  it('PAST_DUE quando subscriptionStatus = unpaid', () => {
    expect(deriveLifecycleStage({ now: NOW, subscriptionStatus: 'unpaid' })).toBe('PAST_DUE');
  });

  it('ACTIVE exige stripeSubscriptionId real + status saudável', () => {
    expect(
      deriveLifecycleStage({ now: NOW, stripeSubscriptionId: 'sub_abc', subscriptionStatus: 'active' }),
    ).toBe('ACTIVE');
    expect(
      deriveLifecycleStage({ now: NOW, stripeSubscriptionId: 'sub_abc', subscriptionStatus: 'trialing' }),
    ).toBe('ACTIVE');
  });

  it('NUNCA promove a ACTIVE por trialConverted (falso-positivo de seed)', () => {
    // trialConverted=true mas SEM stripeSubscriptionId → não pode ser ACTIVE.
    const stage = deriveLifecycleStage({
      now: NOW,
      trialConverted: true,
      subscriptionStatus: 'active',
      stripeSubscriptionId: null,
      isTrialActive: false,
      trialEndsAt: PAST,
    });
    expect(stage).not.toBe('ACTIVE');
    expect(stage).toBe('TRIAL_EXPIRED');
  });

  it('não é ACTIVE se tem assinatura mas status não é saudável (ex: incomplete)', () => {
    expect(
      deriveLifecycleStage({ now: NOW, stripeSubscriptionId: 'sub_x', subscriptionStatus: 'incomplete' }),
    ).toBe('NOVO');
  });

  it('TRIAL quando janela aberta, isTrialActive e não convertido', () => {
    expect(
      deriveLifecycleStage({ now: NOW, isTrialActive: true, trialEndsAt: FUTURE, trialConverted: false }),
    ).toBe('TRIAL');
  });

  it('não é TRIAL se trialConverted=true', () => {
    expect(
      deriveLifecycleStage({ now: NOW, isTrialActive: true, trialEndsAt: FUTURE, trialConverted: true }),
    ).toBe('NOVO');
  });

  it('não é TRIAL se isTrialActive=false mesmo com janela aberta', () => {
    // janela aberta mas flag desligada e sem expirar → cai em NOVO (não TRIAL_EXPIRED).
    expect(
      deriveLifecycleStage({ now: NOW, isTrialActive: false, trialEndsAt: FUTURE }),
    ).toBe('NOVO');
  });

  it('TRIAL_EXPIRED quando passou do fim, sem paidAt e sem churn', () => {
    expect(
      deriveLifecycleStage({ now: NOW, trialEndsAt: PAST, paidAt: null, churnedAt: null }),
    ).toBe('TRIAL_EXPIRED');
  });

  it('trial expirado mas com paidAt não vira TRIAL_EXPIRED (cai em NOVO sem assinatura)', () => {
    // paidAt presente mas sem stripeSubscriptionId/status ativo → não é ACTIVE nem TRIAL_EXPIRED.
    expect(
      deriveLifecycleStage({ now: NOW, trialEndsAt: PAST, paidAt: PAST }),
    ).toBe('NOVO');
  });

  it('NOVO como fallback (signup confirmado sem org / sem sinais)', () => {
    expect(deriveLifecycleStage({ now: NOW })).toBe('NOVO');
    expect(deriveLifecycleStage({ now: NOW, email: undefined } as any)).toBe('NOVO');
  });

  it('aceita datas em string (ISO) além de Date', () => {
    expect(
      deriveLifecycleStage({
        now: NOW,
        isTrialActive: true,
        trialEndsAt: '2026-07-20T12:00:00Z',
        trialConverted: false,
      }),
    ).toBe('TRIAL');
    expect(deriveLifecycleStage({ now: NOW, churnedAt: '2026-06-01T00:00:00Z' })).toBe('CHURNED');
  });

  it('ignora trialEndsAt inválido sem quebrar (cai em NOVO)', () => {
    expect(deriveLifecycleStage({ now: NOW, trialEndsAt: 'not-a-date', isTrialActive: true })).toBe('NOVO');
  });

  it('precedência PAST_DUE > ACTIVE quando ambos poderiam casar', () => {
    // tem assinatura mas está past_due → PAST_DUE, não ACTIVE.
    expect(
      deriveLifecycleStage({ now: NOW, stripeSubscriptionId: 'sub_1', subscriptionStatus: 'past_due' }),
    ).toBe('PAST_DUE');
  });
});
