import { describe, it, expect } from 'vitest';
import { listPurchasableAddons, resolveAddonLineItems } from './billingAddons.util.js';

describe('listPurchasableAddons', () => {
  it('só addons recorrentes mensais com price real', () => {
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
});

describe('resolveAddonLineItems', () => {
  it('resolve keys válidas para line items com price', () => {
    const items = resolveAddonLineItems(['AGENT_SEAT', 'CONTACTS_PACK_5K']);
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.price.startsWith('price_') && i.quantity === 1)).toBe(true);
  });

  it('ignora keys inválidas e não-recorrentes', () => {
    expect(resolveAddonLineItems(['NAO_EXISTE', 'AI_MSG_PACK_5K'])).toHaveLength(0);
  });

  it('dedup de keys repetidas', () => {
    expect(resolveAddonLineItems(['AGENT_SEAT', 'AGENT_SEAT'])).toHaveLength(1);
  });

  it('entrada não-array → vazio', () => {
    expect(resolveAddonLineItems('AGENT_SEAT')).toHaveLength(0);
    expect(resolveAddonLineItems(undefined)).toHaveLength(0);
  });
});
