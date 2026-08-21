import { describe, it, expect } from 'vitest';
import { payingRevenueBrlCents, isSeedOrg } from './tenantUsageService.js';
it('receita = 0 se não há assinatura ativa', () => {
  expect(payingRevenueBrlCents('SCALE', null)).toBe(0);
  expect(payingRevenueBrlCents('SCALE', 'trialing')).toBe(0);
});
it('receita = preço do plano só quando subscriptionStatus=active', () => {
  expect(payingRevenueBrlCents('SCALE', 'active')).toBeGreaterThan(0);
});

describe('isSeedOrg (PR-L 20/08/2026, MRR fantasma dos seeds)', () => {
  it('true só quando settings.seed === true', () => {
    expect(isSeedOrg({ seed: true })).toBe(true);
    expect(isSeedOrg({ seed: true, billing: { autoOverage: false } })).toBe(true);
  });
  it('false para settings sem a marca, nulos ou com valores tortos', () => {
    expect(isSeedOrg({})).toBe(false);
    expect(isSeedOrg(null)).toBe(false);
    expect(isSeedOrg(undefined)).toBe(false);
    expect(isSeedOrg({ seed: false })).toBe(false);
    expect(isSeedOrg({ seed: 'true' })).toBe(false);
    expect(isSeedOrg('seed')).toBe(false);
  });
});
