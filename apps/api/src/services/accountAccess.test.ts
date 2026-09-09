import { describe, it, expect } from 'vitest';
import { computeAccessState } from './accountAccess.js';

const base = {
  churnedAt: null,
  subscriptionStatus: null,
  stripeSubscriptionId: null,
  trialEndsAt: null,
  isTrialActive: false,
  trialConverted: false,
  paidAt: null,
  paywallGraceUntil: null,
} as const;

const now = new Date('2026-07-06T12:00:00Z');
const past = new Date('2026-06-01T12:00:00Z');
const future = new Date('2026-07-20T12:00:00Z');

describe('computeAccessState', () => {
  it('ACTIVE pagante → paywall none', () => {
    expect(
      computeAccessState({ ...base, stripeSubscriptionId: 'sub_1', subscriptionStatus: 'active', now }).paywall,
    ).toBe('none');
  });

  it('TRIAL em janela → none', () => {
    expect(
      computeAccessState({ ...base, isTrialActive: true, trialEndsAt: future, now }).paywall,
    ).toBe('none');
  });

  it('NOVO (onboarding, sem trialEndsAt) → none (não quebra signup)', () => {
    expect(computeAccessState({ ...base, now }).paywall).toBe('none');
  });

  it('TRIAL_EXPIRED sem carência → hard', () => {
    const s = computeAccessState({ ...base, trialEndsAt: past, now });
    expect(s.stage).toBe('TRIAL_EXPIRED');
    expect(s.paywall).toBe('hard');
  });

  // ── SUPERADMIN (operador da plataforma) ──────────────────────────────
  // A conta interna da ZappIQ não assina o próprio produto. Antes disso o
  // /api/auth/me devolvia paywall 'hard' e o AuthGuard chutava o superadmin
  // pra /billing, mesmo com a API liberando (requireActivePlan já isentava).
  it('SUPERADMIN com trial vencido → none (nunca cai no paywall)', () => {
    const s = computeAccessState({ ...base, trialEndsAt: past, role: 'SUPERADMIN', now });
    expect(s.paywall).toBe('none');
    // O estágio real é preservado: liberar acesso não pode falsear billing/MRR.
    expect(s.stage).toBe('TRIAL_EXPIRED');
  });

  it('SUPERADMIN em org cancelada (CHURNED) → none', () => {
    const s = computeAccessState({ ...base, churnedAt: past, role: 'SUPERADMIN', now });
    expect(s.paywall).toBe('none');
    expect(s.stage).toBe('CHURNED');
  });

  it('papel de CLIENTE não escapa do paywall (só SUPERADMIN isenta)', () => {
    for (const role of ['ADMIN', 'OWNER', 'AGENT', 'USER', 'superadmin', '']) {
      expect(computeAccessState({ ...base, trialEndsAt: past, role, now }).paywall).toBe('hard');
    }
  });

  it('sem role (digest/Área Clientes olhando org de terceiro) → regra do cliente', () => {
    // Quem avalia a conta ALHEIA não passa role: o superadmin enxergando o
    // painel não pode mascarar o trial vencido do cliente.
    expect(computeAccessState({ ...base, trialEndsAt: past, now }).paywall).toBe('hard');
  });

  it('TRIAL_EXPIRED com carência ativa → soft', () => {
    expect(
      computeAccessState({ ...base, trialEndsAt: past, paywallGraceUntil: future, now }).paywall,
    ).toBe('soft');
  });

  it('TRIAL_EXPIRED com carência vencida → hard', () => {
    expect(
      computeAccessState({ ...base, trialEndsAt: past, paywallGraceUntil: past, now }).paywall,
    ).toBe('hard');
  });

  it('CHURNED → hard (ignora carência)', () => {
    expect(
      computeAccessState({ ...base, churnedAt: past, paywallGraceUntil: future, now }).paywall,
    ).toBe('hard');
  });

  it('PAST_DUE → past_due (não trava total)', () => {
    expect(
      computeAccessState({ ...base, subscriptionStatus: 'past_due', now }).paywall,
    ).toBe('past_due');
  });

  it('subscriptionStatus "trialing" podre sem sub real → hard (incidente Antonella)', () => {
    const s = computeAccessState({
      ...base,
      subscriptionStatus: 'trialing',
      stripeSubscriptionId: null,
      trialEndsAt: past,
      now,
    });
    expect(s.stage).toBe('TRIAL_EXPIRED');
    expect(s.paywall).toBe('hard');
  });
});
