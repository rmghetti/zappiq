/**
 * settings.channels.globalFallback.test.ts — saúde do canal enxerga o dogfood
 * ============================================================================
 * Pergunta do fundador (13/08): a org SUPERADMIN mostra WhatsApp "Desconectado",
 * mas a Iza está associada a ela e atendendo no WhatsApp normalmente. O cartão
 * só olhava credencial SALVA NA ORG; a Iza envia pela credencial GLOBAL da
 * plataforma (fallback de dogfood do whatsappService). Funciona, mas o cartão
 * dizia que não.
 *
 * Regra nova: para a org canônica da Iza, com credencial global disponível,
 * o WhatsApp aparece conectado com o marcador viaGlobal (a UI explica "via
 * credencial global da plataforma"). Org de CLIENTE sem token continua
 * Desconectado — o fallback global não é um estado saudável para cliente.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { deriveChannelHealth } from './settings.channels.js';

const ORG_SEM_TOKEN = {
  whatsappAccessToken: null,
  whatsappPhoneNumberId: '1134116473116268',
  instagramAccessToken: null,
  instagramAccountId: null,
  settings: {},
};

describe('deriveChannelHealth — fallback global (dogfood Iza)', () => {
  it('org da Iza sem token próprio + global disponível → WhatsApp conectado viaGlobal', () => {
    const h = deriveChannelHealth(ORG_SEM_TOKEN, {
      isIzaOrg: true,
      globalWhatsappAvailable: true,
    });
    expect(h.whatsapp.connected).toBe(true);
    expect(h.whatsapp.viaGlobal).toBe(true);
  });

  it('org de CLIENTE sem token continua Desconectado mesmo com global disponível', () => {
    const h = deriveChannelHealth(ORG_SEM_TOKEN, {
      isIzaOrg: false,
      globalWhatsappAvailable: true,
    });
    expect(h.whatsapp.connected).toBe(false);
    expect(h.whatsapp.viaGlobal).toBeUndefined();
  });

  it('org da Iza SEM global disponível segue Desconectado (não inventa saúde)', () => {
    const h = deriveChannelHealth(ORG_SEM_TOKEN, {
      isIzaOrg: true,
      globalWhatsappAvailable: false,
    });
    expect(h.whatsapp.connected).toBe(false);
  });

  it('org com credencial própria segue conectada SEM viaGlobal (nada muda pro cliente)', () => {
    const h = deriveChannelHealth(
      { ...ORG_SEM_TOKEN, whatsappAccessToken: 'EAA'.padEnd(40, 'x') },
      { isIzaOrg: false, globalWhatsappAvailable: true },
    );
    expect(h.whatsapp.connected).toBe(true);
    expect(h.whatsapp.viaGlobal).toBeUndefined();
  });

  it('sem opts (chamadas existentes) o comportamento antigo permanece', () => {
    const h = deriveChannelHealth(ORG_SEM_TOKEN);
    expect(h.whatsapp.connected).toBe(false);
    expect(h.instagram.connected).toBe(false);
  });
});
