import { describe, it, expect } from 'vitest';
import { STRIPE_V4_PRICES } from '@zappiq/shared';
import {
  isPricedTier,
  isPlanTier,
  isBillingCycle,
  priceIdForSelection,
  orgEnumToTier,
  resolveCurrentSelection,
  currentPeriodEndMs,
  findPlanItem,
} from './billingChange.util.js';

describe('billingChange.util', () => {
  describe('guards', () => {
    it('isPricedTier só p/ Lite/Growth/Scale', () => {
      expect(isPricedTier('GROWTH')).toBe(true);
      expect(isPricedTier('ENTERPRISE')).toBe(false);
      expect(isPricedTier('LOL')).toBe(false);
    });
    it('isPlanTier inclui ENTERPRISE', () => {
      expect(isPlanTier('ENTERPRISE')).toBe(true);
      expect(isPlanTier('STARTER')).toBe(false);
    });
    it('isBillingCycle', () => {
      expect(isBillingCycle('monthly')).toBe(true);
      expect(isBillingCycle('annual')).toBe(true);
      expect(isBillingCycle('weekly')).toBe(false);
    });
  });

  describe('priceIdForSelection', () => {
    it('resolve o price real do shared', () => {
      expect(priceIdForSelection('GROWTH', 'monthly')).toBe(STRIPE_V4_PRICES.GROWTH.monthly);
      expect(priceIdForSelection('SCALE', 'annual')).toBe(STRIPE_V4_PRICES.SCALE.annual);
    });
    it('ENTERPRISE não tem price', () => {
      expect(priceIdForSelection('ENTERPRISE', 'monthly')).toBeNull();
    });
  });

  describe('orgEnumToTier', () => {
    it('STARTER e desconhecido → IZA_LITE', () => {
      expect(orgEnumToTier('STARTER')).toBe('IZA_LITE');
      expect(orgEnumToTier(null)).toBe('IZA_LITE');
      expect(orgEnumToTier('???')).toBe('IZA_LITE');
    });
    it('BUSINESS legado → SCALE', () => {
      expect(orgEnumToTier('BUSINESS')).toBe('SCALE');
    });
    it('GROWTH/SCALE/ENTERPRISE batem', () => {
      expect(orgEnumToTier('GROWTH')).toBe('GROWTH');
      expect(orgEnumToTier('SCALE')).toBe('SCALE');
      expect(orgEnumToTier('ENTERPRISE')).toBe('ENTERPRISE');
    });
  });

  describe('resolveCurrentSelection', () => {
    it('prioriza o price real da subscription', () => {
      expect(
        resolveCurrentSelection({
          subscriptionPriceId: STRIPE_V4_PRICES.GROWTH.annual,
          orgPlanEnum: 'STARTER', // enum desatualizado — ignorado em favor do price
          orgBillingCycle: 'monthly',
        })
      ).toEqual({ plan: 'GROWTH', cycle: 'annual' });
    });
    it('cai no enum+ciclo da org quando o price é desconhecido', () => {
      expect(
        resolveCurrentSelection({
          subscriptionPriceId: 'price_legacy_desconhecido',
          orgPlanEnum: 'SCALE',
          orgBillingCycle: 'annual',
        })
      ).toEqual({ plan: 'SCALE', cycle: 'annual' });
    });
    it('sem price nenhum → enum + mensal por padrão', () => {
      expect(resolveCurrentSelection({ orgPlanEnum: 'GROWTH' })).toEqual({
        plan: 'GROWTH',
        cycle: 'monthly',
      });
    });
  });

  describe('findPlanItem', () => {
    it('acha o item de plano ignorando add-ons', () => {
      const items = [
        { id: 'si_addon', price: { id: 'price_addon_qualquer' } },
        { id: 'si_plan', price: { id: STRIPE_V4_PRICES.GROWTH.monthly } },
      ];
      expect(findPlanItem(items)?.id).toBe('si_plan');
    });
    it('fallback pro primeiro item quando nenhum é plano conhecido', () => {
      const items = [{ id: 'si_x', price: { id: 'price_desconhecido' } }];
      expect(findPlanItem(items)?.id).toBe('si_x');
    });
    it('null quando não há itens', () => {
      expect(findPlanItem([])).toBeNull();
      expect(findPlanItem(undefined)).toBeNull();
    });
  });

  describe('currentPeriodEndMs', () => {
    it('lê do item (API Basil) em ms', () => {
      expect(currentPeriodEndMs({ items: { data: [{ current_period_end: 1000 }] } })).toBe(1_000_000);
    });
    it('fallback pro nível da subscription', () => {
      expect(currentPeriodEndMs({ current_period_end: 2000, items: { data: [{}] } })).toBe(2_000_000);
    });
    it('null quando não há período', () => {
      expect(currentPeriodEndMs({})).toBeNull();
    });
  });
});
