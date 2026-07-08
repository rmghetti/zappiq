import { describe, it, expect } from 'vitest';
import { ADDONS_V4_STRIPE } from '@zappiq/shared';
import {
  listPurchasableAddons,
  resolveAddonLineItems,
  addonPriceIdFor,
} from './billingAddons.util.js';

describe('listPurchasableAddons', () => {
  it('só addons recorrentes mensais com price real (mensal)', () => {
    const list = listPurchasableAddons();
    expect(list.length).toBeGreaterThan(0);
    for (const a of list) {
      expect(a.priceId).toMatch(/^price_/);
      expect(a.amountBrl).toBeGreaterThan(0);
    }
    // AGENT_SEAT é um recorrente conhecido; packs one-shot não entram.
    expect(list.map((a) => a.key)).toContain('AGENT_SEAT');
    expect(list.map((a) => a.key)).not.toContain('AI_MSG_PACK_5K');
    expect(list.map((a) => a.key)).not.toContain('AI_MSG_OVERAGE');
  });

  it('lista anual traz os mesmos addons (todos têm price anual agora)', () => {
    const monthly = listPurchasableAddons('monthly').map((a) => a.key).sort();
    const annual = listPurchasableAddons('annual').map((a) => a.key).sort();
    expect(annual).toEqual(monthly);
  });
});

describe('addonPriceIdFor — casa o ciclo (nunca mistura intervalos)', () => {
  it('mensal e anual resolvem price IDs DIFERENTES', () => {
    const m = addonPriceIdFor('EXTRA_IG_DIRECT', 'monthly');
    const a = addonPriceIdFor('EXTRA_IG_DIRECT', 'annual');
    expect(m).toMatch(/^price_/);
    expect(a).toMatch(/^price_/);
    expect(a).not.toBe(m);
  });

  it('todo addon recorrente comprável tem price mensal E anual (senão o anual quebra)', () => {
    for (const a of listPurchasableAddons('monthly')) {
      expect(addonPriceIdFor(a.key, 'monthly'), `${a.key} monthly`).toMatch(/^price_/);
      expect(addonPriceIdFor(a.key, 'annual'), `${a.key} annual`).toMatch(/^price_/);
    }
  });

  it('key desconhecida → null', () => {
    expect(addonPriceIdFor('NAO_EXISTE', 'annual')).toBeNull();
  });
});

describe('resolveAddonLineItems (interval-aware)', () => {
  it('mensal resolve os price IDs mensais', () => {
    const items = resolveAddonLineItems(['AGENT_SEAT', 'CONTACTS_PACK_5K'], 'monthly');
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.price)).toContain(ADDONS_V4_STRIPE.AGENT_SEAT.priceIds.monthly);
  });

  it('anual resolve os price IDs ANUAIS (não os mensais) — evita o mix que o Stripe recusa', () => {
    const items = resolveAddonLineItems(['AGENT_SEAT', 'CONTACTS_PACK_5K'], 'annual');
    expect(items).toHaveLength(2);
    const prices = items.map((i) => i.price);
    expect(prices).toContain(ADDONS_V4_STRIPE.AGENT_SEAT.priceIds.annual);
    expect(prices).toContain(ADDONS_V4_STRIPE.CONTACTS_PACK_5K.priceIds.annual);
    // e NUNCA um price mensal junto
    expect(prices).not.toContain(ADDONS_V4_STRIPE.AGENT_SEAT.priceIds.monthly);
  });

  it('default (sem ciclo) = mensal', () => {
    const items = resolveAddonLineItems(['AGENT_SEAT']);
    expect(items[0].price).toBe(ADDONS_V4_STRIPE.AGENT_SEAT.priceIds.monthly);
  });

  it('ignora keys inválidas e não-recorrentes', () => {
    expect(resolveAddonLineItems(['NAO_EXISTE', 'AI_MSG_PACK_5K'], 'annual')).toHaveLength(0);
  });

  it('dedup de keys repetidas', () => {
    expect(resolveAddonLineItems(['AGENT_SEAT', 'AGENT_SEAT'], 'annual')).toHaveLength(1);
  });

  it('entrada não-array → vazio', () => {
    expect(resolveAddonLineItems('AGENT_SEAT', 'annual')).toHaveLength(0);
    expect(resolveAddonLineItems(undefined, 'monthly')).toHaveLength(0);
  });
});
