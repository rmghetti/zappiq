import { describe, it, expect } from 'vitest';
import { ADDONS_V4_STRIPE, STRIPE_V4_PRICES } from '@zappiq/shared';
import {
  packageAddonKeyFromPriceId,
  packageAddonsFromSubscriptionItems,
  mergePackageAddons,
} from './stripeWebhook.util.js';

const item = (priceId: string) => ({ price: { id: priceId } });

describe('packageAddonKeyFromPriceId', () => {
  it('resolve pelo price MENSAL e ANUAL', () => {
    expect(packageAddonKeyFromPriceId(ADDONS_V4_STRIPE.AGENT_SEAT.priceIds.monthly)).toBe('AGENT_SEAT');
    expect(packageAddonKeyFromPriceId(ADDONS_V4_STRIPE.AGENT_SEAT.priceIds.annual)).toBe('AGENT_SEAT');
    expect(packageAddonKeyFromPriceId(ADDONS_V4_STRIPE.CONTACTS_PACK_5K.priceIds.annual)).toBe(
      'CONTACTS_PACK_5K',
    );
  });
  it('preço de PLANO não é addon', () => {
    expect(packageAddonKeyFromPriceId(STRIPE_V4_PRICES.GROWTH.annual)).toBeNull();
  });
  it('preço do Impulso não é addon de pacote', () => {
    expect(packageAddonKeyFromPriceId(ADDONS_V4_STRIPE.IMPULSO_PRO.priceIds.monthly)).toBeNull();
  });
  it('desconhecido → null', () => {
    expect(packageAddonKeyFromPriceId('price_xxx')).toBeNull();
    expect(packageAddonKeyFromPriceId(null)).toBeNull();
  });
});

describe('packageAddonsFromSubscriptionItems', () => {
  it('extrai só os addons de pacote (ignora o plano)', () => {
    const items = [
      item(STRIPE_V4_PRICES.GROWTH.annual), // plano
      item(ADDONS_V4_STRIPE.EXTRA_IG_DIRECT.priceIds.annual),
      item(ADDONS_V4_STRIPE.CONTACTS_PACK_5K.priceIds.annual),
    ];
    expect(packageAddonsFromSubscriptionItems(items).sort()).toEqual(
      ['CONTACTS_PACK_5K', 'EXTRA_IG_DIRECT'].sort(),
    );
  });
  it('sem itens → vazio', () => {
    expect(packageAddonsFromSubscriptionItems(undefined)).toEqual([]);
    expect(packageAddonsFromSubscriptionItems([])).toEqual([]);
  });
});

describe('mergePackageAddons — preserva Impulso, troca só as keys de pacote', () => {
  it('adiciona addons detectados preservando Impulso', () => {
    const result = mergePackageAddons(['IMPULSO_PRO'], ['AGENT_SEAT', 'CONTACTS_PACK_5K']);
    expect(result).toContain('IMPULSO_PRO');
    expect(result).toContain('AGENT_SEAT');
    expect(result).toContain('CONTACTS_PACK_5K');
  });
  it('remove addon de pacote que sumiu da assinatura (downgrade)', () => {
    // antes tinha AGENT_SEAT; agora a assinatura não traz nenhum addon
    const result = mergePackageAddons(['IMPULSO_START', 'AGENT_SEAT'], []);
    expect(result).toEqual(['IMPULSO_START']);
  });
  it('dedup e ignora não-pacote no detected', () => {
    const result = mergePackageAddons([], ['AGENT_SEAT', 'AGENT_SEAT', 'IMPULSO_PRO']);
    expect(result).toEqual(['AGENT_SEAT']);
  });
  it('existing não-array → só os detectados', () => {
    expect(mergePackageAddons(undefined, ['FLOWS_PACK_5'])).toEqual(['FLOWS_PACK_5']);
  });
});
