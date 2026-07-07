import { describe, it, expect } from 'vitest';
import {
  computeConfirmUpdate,
  isCheckoutSettled,
  priceIdFromSubscription,
  type ConfirmBeforeState,
} from './billingCheckoutConfirm.util.js';

function fakeSub(overrides: Record<string, any> = {}): any {
  return {
    id: 'sub_TEST123',
    status: 'active',
    customer: 'cus_TEST123',
    items: { data: [{ price: { id: 'price_UNKNOWN' } }] },
    ...overrides,
  };
}

const baseBefore: ConfirmBeforeState = {
  settings: { niche: 'tecnologia', agentName: 'Bia' },
  paidAt: null,
  isTrialActive: true,
  trialConverted: false,
};

describe('billingCheckoutConfirm.util', () => {
  it('priceIdFromSubscription lê o 1º item (ou null)', () => {
    expect(priceIdFromSubscription(fakeSub())).toBe('price_UNKNOWN');
    expect(priceIdFromSubscription(fakeSub({ items: { data: [] } }))).toBeNull();
  });

  it('isCheckoutSettled cobre concluído / pago / sem cobrança', () => {
    expect(isCheckoutSettled({ status: 'complete', payment_status: 'unpaid' } as any)).toBe(true);
    expect(isCheckoutSettled({ status: 'open', payment_status: 'paid' } as any)).toBe(true);
    expect(isCheckoutSettled({ status: 'open', payment_status: 'no_payment_required' } as any)).toBe(true);
    expect(isCheckoutSettled({ status: 'open', payment_status: 'unpaid' } as any)).toBe(false);
  });

  it('active + sem paidAt → marca 1º pagamento e converte trial', () => {
    const now = new Date('2026-07-06T22:00:00Z');
    const { data, becameActive, status } = computeConfirmUpdate(fakeSub(), baseBefore, now);
    expect(becameActive).toBe(true);
    expect(status).toBe('active');
    expect(data.subscriptionStatus).toBe('active');
    expect(data.stripeSubscriptionId).toBe('sub_TEST123');
    expect(data.stripeCustomerId).toBe('cus_TEST123');
    expect(data.paidAt).toEqual(now);
    expect(data.isTrialActive).toBe(false);
    expect(data.trialConverted).toBe(true);
    // merge NÃO-destrutivo do settings (preserva niche/agentName, adiciona IDs)
    expect((data.settings as any).niche).toBe('tecnologia');
    expect((data.settings as any).agentName).toBe('Bia');
    expect((data.settings as any).stripeSubscriptionId).toBe('sub_TEST123');
  });

  it('active mas já pago → não sobrescreve paidAt (idempotente)', () => {
    const before = { ...baseBefore, paidAt: new Date('2026-01-01T00:00:00Z') };
    const { data, becameActive } = computeConfirmUpdate(fakeSub(), before);
    expect(becameActive).toBe(false);
    expect(data.paidAt).toBeUndefined();
    expect(data.stripeSubscriptionId).toBe('sub_TEST123');
  });

  it('trialing → NÃO marca paidAt (espelha o webhook), mas grava a assinatura', () => {
    const { data, becameActive } = computeConfirmUpdate(fakeSub({ status: 'trialing' }), baseBefore);
    expect(becameActive).toBe(false);
    expect(data.paidAt).toBeUndefined();
    expect(data.subscriptionStatus).toBe('trialing');
    expect(data.stripeSubscriptionId).toBe('sub_TEST123');
  });

  it('customer como objeto expandido → extrai o id', () => {
    const { data } = computeConfirmUpdate(fakeSub({ customer: { id: 'cus_OBJ' } }), baseBefore);
    expect(data.stripeCustomerId).toBe('cus_OBJ');
  });
});
