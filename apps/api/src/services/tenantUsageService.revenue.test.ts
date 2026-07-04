import { describe, it, expect } from 'vitest';
import { payingRevenueBrlCents } from './tenantUsageService.js';
it('receita = 0 se não há assinatura ativa', () => {
  expect(payingRevenueBrlCents('SCALE', null)).toBe(0);
  expect(payingRevenueBrlCents('SCALE', 'trialing')).toBe(0);
});
it('receita = preço do plano só quando subscriptionStatus=active', () => {
  expect(payingRevenueBrlCents('SCALE', 'active')).toBeGreaterThan(0);
});
