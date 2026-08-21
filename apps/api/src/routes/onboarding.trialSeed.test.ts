/**
 * Trial por ATIVAÇÃO (PR-K, decisão D-plano 20/08/2026): o cadastro NÃO liga
 * mais o relógio dos 14 dias. Este teste trava o seed de trial da criação da
 * org (orgTrialSeedAtSignup, usado no POST /api/onboarding/complete) para o
 * cadastro não voltar a setar trialStartedAt/trialEndsAt por acidente. Quem
 * seta as datas é a 1ª mensagem inbound de WhatsApp (routes/webhook.ts) ou a
 * ativação forçada D+30 (services/trialExpirationCron.ts).
 */
import { describe, it, expect } from 'vitest';
import { orgTrialSeedAtSignup } from './onboarding.js';

describe('orgTrialSeedAtSignup · cadastro não seta mais as datas de trial', () => {
  it('trialStartedAt e trialEndsAt nascem NULL (relógio parado até a ativação)', () => {
    const seed = orgTrialSeedAtSignup();
    expect(seed.trialStartedAt).toBeNull();
    expect(seed.trialEndsAt).toBeNull();
  });

  it('mantém o cap de custo e as flags de avaliação (conta nasce NOVO, não TRIAL)', () => {
    const seed = orgTrialSeedAtSignup();
    expect(seed.trialCostCapUsd).toBe(15.0);
    // isTrialActive segue true como "janela de avaliação aberta"; sem
    // trialEndsAt, deriveLifecycleStage cai em NOVO (paywall none), não TRIAL.
    expect(seed.isTrialActive).toBe(true);
    expect(seed.trialConverted).toBe(false);
    expect(seed.subscriptionStatus).toBe('trialing');
  });

  it('com as datas NULL, quem assinar antes de ativar ganha trial no Stripe (effectiveTrialDays)', async () => {
    // Prova cruzada com a regra REAL do checkout (arquivo intocado): o seed
    // novo deixa a org elegível ao trial do Stripe até a 1ª conversa ativar.
    const { effectiveTrialDays } = await import('./billingCheckout.util.js');
    const seed = orgTrialSeedAtSignup();
    const days = effectiveTrialDays(14, {
      trialStartedAt: seed.trialStartedAt,
      trialEndsAt: seed.trialEndsAt,
      paidAt: null,
      stripeSubscriptionId: null,
    });
    expect(days).toBe(14);
  });
});
