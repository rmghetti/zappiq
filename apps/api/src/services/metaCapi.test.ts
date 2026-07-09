/**
 * metaCapi.test.ts — Loop de Receita: envio de conversão de compra à Meta CAPI.
 * ============================================================================
 * Partes PURAS: hash SHA-256 dos dados do usuário (exigência da Meta), montagem
 * do evento Purchase de CTWA (action_source=business_messaging + ctwa_clid) e o
 * gate (só envia se houver ctwa_clid + config). Sem rede aqui.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { sha256Hex, buildCapiPurchaseEvent, capiReady } from './metaCapi.js';

describe('sha256Hex — normaliza e hasheia (padrão Meta)', () => {
  it('normaliza (trim + lowercase) antes de hashear', () => {
    expect(sha256Hex('  Foo@Bar.com ')).toBe(sha256Hex('foo@bar.com'));
    expect(sha256Hex('foo@bar.com')).toMatch(/^[a-f0-9]{64}$/);
  });
  it('vazio/indefinido → undefined (não hasheia lixo)', () => {
    expect(sha256Hex('')).toBeUndefined();
    expect(sha256Hex(undefined)).toBeUndefined();
  });
});

describe('buildCapiPurchaseEvent — evento Purchase de CTWA', () => {
  it('monta o evento com ctwa_clid, valor e dados hasheados', () => {
    const ev = buildCapiPurchaseEvent({
      ctwaClid: 'clid_123', value: 150.5, currency: 'BRL',
      phone: '+55 11 99999-0000', email: 'Cliente@X.com',
      eventId: 'deal_1', eventTimeSec: 1_700_000_000,
    });
    expect(ev.event_name).toBe('Purchase');
    expect(ev.action_source).toBe('business_messaging');
    expect(ev.event_time).toBe(1_700_000_000);
    expect(ev.event_id).toBe('deal_1');
    expect(ev.user_data.ctwa_clid).toBe('clid_123');
    expect(ev.user_data.ph?.[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(ev.user_data.em?.[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(ev.custom_data).toEqual({ value: 150.5, currency: 'BRL' });
  });
  it('sem phone/email não inclui ph/em (não manda campo vazio)', () => {
    const ev = buildCapiPurchaseEvent({ ctwaClid: 'c', value: 10, currency: 'BRL', eventId: 'd', eventTimeSec: 1 });
    expect(ev.user_data.ph).toBeUndefined();
    expect(ev.user_data.em).toBeUndefined();
    expect(ev.user_data.ctwa_clid).toBe('c');
  });
});

describe('capiReady — gate: só envia com config + ctwa_clid', () => {
  it('precisa de datasetId, token e ctwa_clid', () => {
    expect(capiReady({ datasetId: 'd', accessToken: 't' }, 'clid')).toBe(true);
    expect(capiReady({ datasetId: 'd', accessToken: 't' }, null)).toBe(false);
    expect(capiReady({ datasetId: '', accessToken: 't' }, 'clid')).toBe(false);
    expect(capiReady({ datasetId: 'd', accessToken: '' }, 'clid')).toBe(false);
    expect(capiReady(null, 'clid')).toBe(false);
  });
});
