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
  subscriptionGuard,
  guardResponse,
  buildDowngradeSchedulePhases,
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

  describe('subscriptionGuard (guardrail)', () => {
    it('Stripe não configurado → stripe_unconfigured', () => {
      expect(subscriptionGuard({ stripeConfigured: false, stripeSubscriptionId: 'sub_1' })).toBe(
        'stripe_unconfigured',
      );
    });
    it('sem stripeSubscriptionId → no_active_subscription (manda pro checkout)', () => {
      expect(subscriptionGuard({ stripeConfigured: true, stripeSubscriptionId: null })).toBe(
        'no_active_subscription',
      );
      expect(subscriptionGuard({ stripeConfigured: true, stripeSubscriptionId: undefined })).toBe(
        'no_active_subscription',
      );
    });
    it('pré-fetch (status/item undefined) com sub id → ok', () => {
      expect(subscriptionGuard({ stripeConfigured: true, stripeSubscriptionId: 'sub_1' })).toBe('ok');
    });
    it('status ativo/trial/past_due → ok; cancelado → no_active_subscription', () => {
      for (const s of ['active', 'trialing', 'past_due']) {
        expect(
          subscriptionGuard({ stripeConfigured: true, stripeSubscriptionId: 'sub_1', subStatus: s, hasPlanItem: true }),
        ).toBe('ok');
      }
      for (const s of ['canceled', 'incomplete_expired', 'unpaid']) {
        expect(
          subscriptionGuard({ stripeConfigured: true, stripeSubscriptionId: 'sub_1', subStatus: s, hasPlanItem: true }),
        ).toBe('no_active_subscription');
      }
    });
    it('sem item de plano → no_item', () => {
      expect(
        subscriptionGuard({ stripeConfigured: true, stripeSubscriptionId: 'sub_1', subStatus: 'active', hasPlanItem: false }),
      ).toBe('no_item');
    });
  });

  describe('guardResponse', () => {
    it('mapeia códigos → HTTP', () => {
      expect(guardResponse('no_active_subscription')).toEqual({
        status: 409,
        body: { error: 'no_active_subscription', action: 'checkout' },
      });
      expect(guardResponse('stripe_unconfigured').status).toBe(503);
      expect(guardResponse('no_item').status).toBe(422);
      expect(guardResponse('ok').status).toBe(200);
    });
  });

  describe('buildDowngradeSchedulePhases (preserva add-ons)', () => {
    const CUR = STRIPE_V4_PRICES.SCALE.monthly;
    const NEW = STRIPE_V4_PRICES.GROWTH.monthly;
    const ADDON = 'price_addon_voice';

    it('troca só o item do plano e PRESERVA o add-on nas duas fases', () => {
      const phases = buildDowngradeSchedulePhases({
        phase0Items: [
          { price: CUR, quantity: 1 },
          { price: ADDON, quantity: 2 },
        ],
        currentPlanPriceId: CUR,
        newPriceId: NEW,
        startDate: 100,
        boundary: 200,
      });
      // fase 0 = itens atuais intactos
      expect(phases[0].items).toEqual([
        { price: CUR, quantity: 1 },
        { price: ADDON, quantity: 2 },
      ]);
      expect(phases[0].start_date).toBe(100);
      expect(phases[0].end_date).toBe(200);
      // fase 1 = plano trocado, add-on preservado (mesma quantidade)
      expect(phases[1].items).toEqual([
        { price: NEW, quantity: 1 },
        { price: ADDON, quantity: 2 },
      ]);
      expect(phases[1].start_date).toBe(200);
    });

    it('aceita price como objeto {id} (shape do Stripe)', () => {
      const phases = buildDowngradeSchedulePhases({
        phase0Items: [{ price: { id: CUR }, quantity: 1 }],
        currentPlanPriceId: CUR,
        newPriceId: NEW,
        boundary: 200,
      });
      expect(phases[1].items).toEqual([{ price: NEW, quantity: 1 }]);
    });

    it('fallback: sem itens conhecidos usa só o item do plano', () => {
      const phases = buildDowngradeSchedulePhases({
        phase0Items: [],
        currentPlanPriceId: CUR,
        newPriceId: NEW,
      });
      expect(phases[0].items).toEqual([{ price: CUR, quantity: 1 }]);
      expect(phases[1].items).toEqual([{ price: NEW, quantity: 1 }]);
    });

    it('edge: nenhum item bate o plano atual → garante o novo preço presente', () => {
      const phases = buildDowngradeSchedulePhases({
        phase0Items: [{ price: ADDON, quantity: 1 }],
        currentPlanPriceId: CUR, // não existe nos itens
        newPriceId: NEW,
        boundary: 200,
      });
      expect(phases[1].items.some((i) => i.price === NEW)).toBe(true);
      expect(phases[1].items.some((i) => i.price === ADDON)).toBe(true);
    });

    it('sem boundary/startDate → não emite as datas', () => {
      const phases = buildDowngradeSchedulePhases({
        phase0Items: [{ price: CUR, quantity: 1 }],
        currentPlanPriceId: CUR,
        newPriceId: NEW,
      });
      expect(phases[0].start_date).toBeUndefined();
      expect(phases[0].end_date).toBeUndefined();
      expect(phases[1].start_date).toBeUndefined();
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
