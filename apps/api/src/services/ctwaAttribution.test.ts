/**
 * ctwaAttribution.test.ts — captura do ctwa_clid (Click-to-WhatsApp) que fecha
 * o Loop de Receita: o clique no anúncio → conversa → (venda) → CAPI usa este id.
 * Parte pura: extrair o referral da mensagem do WhatsApp. Sem rede/DB aqui.
 */
import { describe, it, expect } from 'vitest';
import { parseCtwaReferral } from './ctwaAttribution.js';

describe('parseCtwaReferral — referral do CTWA na mensagem do WhatsApp', () => {
  it('extrai ctwa_clid, ad id e tipo quando a mensagem veio de anúncio', () => {
    const referral = {
      source_url: 'https://fb.me/x', source_id: 'ad_123', source_type: 'ad',
      headline: 'Oferta', body: 'Clique', ctwa_clid: 'CLID_ABC',
    };
    expect(parseCtwaReferral(referral)).toEqual({ ctwaClid: 'CLID_ABC', adId: 'ad_123', sourceType: 'ad' });
  });

  it('sem ctwa_clid retorna null (mensagem orgânica)', () => {
    expect(parseCtwaReferral({ source_type: 'ad', source_id: 'ad_1' })).toBeNull();
    expect(parseCtwaReferral(null)).toBeNull();
    expect(parseCtwaReferral(undefined)).toBeNull();
    expect(parseCtwaReferral('x')).toBeNull();
    expect(parseCtwaReferral({ ctwa_clid: '' })).toBeNull();
  });

  it('campos ausentes viram null (não quebra)', () => {
    expect(parseCtwaReferral({ ctwa_clid: 'C' })).toEqual({ ctwaClid: 'C', adId: null, sourceType: null });
  });
});
