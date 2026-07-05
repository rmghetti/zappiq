/**
 * FEATURE 5b.3 — desconectar canal + monitor de saúde.
 *
 * Testes de LÓGICA PURA (vitest, zero I/O) sobre os helpers de settings.channels.
 * O route handler POST /api/settings/channels/:channel/disconnect é um wrapper
 * fino em cima destes; o repo não tem harness supertest (server.ts puxa
 * Redis/OTel/BullMQ), então testamos o contrato exato do disconnect aqui —
 * mesmo padrão de settings.security.test.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  DISCONNECTABLE_CHANNELS,
  isDisconnectableChannel,
  CHANNEL_CREDENTIAL_FIELDS,
  buildDisconnectData,
  buildDisconnectSettings,
  deriveChannelHealth,
} from './settings.channels.js';

// ── validação de canal ──────────────────────────────────────────────────────
describe('isDisconnectableChannel', () => {
  it('aceita whatsapp e instagram', () => {
    expect(isDisconnectableChannel('whatsapp')).toBe(true);
    expect(isDisconnectableChannel('instagram')).toBe(true);
  });
  it('REJEITA canal desconhecido / vazio', () => {
    expect(isDisconnectableChannel('telegram')).toBe(false);
    expect(isDisconnectableChannel('')).toBe(false);
    expect(isDisconnectableChannel('WhatsApp')).toBe(false); // case-sensitive: route normaliza p/ lower antes
  });
});

// ── buildDisconnectData: zera SÓ as colunas do canal pedido ──────────────────
describe('buildDisconnectData', () => {
  it('WhatsApp: zera phoneNumberId + businessAccountId + accessToken (e nada mais)', () => {
    const data = buildDisconnectData('whatsapp');
    expect(data).toEqual({
      whatsappPhoneNumberId: null,
      whatsappBusinessAccountId: null,
      whatsappAccessToken: null,
    });
    // não toca em nenhuma coluna de instagram
    for (const k of Object.keys(data)) {
      expect(k.startsWith('instagram')).toBe(false);
    }
  });

  it('Instagram: zera accountId + pageId + accessToken (e nada mais)', () => {
    const data = buildDisconnectData('instagram');
    expect(data).toEqual({
      instagramAccountId: null,
      instagramPageId: null,
      instagramAccessToken: null,
    });
    for (const k of Object.keys(data)) {
      expect(k.startsWith('whatsapp')).toBe(false);
    }
  });

  it('cobre exatamente as colunas declaradas em CHANNEL_CREDENTIAL_FIELDS', () => {
    for (const channel of DISCONNECTABLE_CHANNELS) {
      const data = buildDisconnectData(channel);
      expect(Object.keys(data).sort()).toEqual([...CHANNEL_CREDENTIAL_FIELDS[channel]].sort());
      // todas viram null (revogação total, nunca undefined que o prisma ignoraria)
      for (const v of Object.values(data)) expect(v).toBeNull();
    }
  });
});

// ── buildDisconnectSettings: preserva o resto, marca disconnectedAt ───────────
describe('buildDisconnectSettings', () => {
  const NOW = '2026-07-05T10:00:00.000Z';

  it('derruba connectedAt e grava disconnectedAt no bloco do canal', () => {
    const out = buildDisconnectSettings(
      'whatsapp',
      { whatsapp: { pin: '123456', connectedAt: '2026-01-01T00:00:00.000Z', registered: true } },
      NOW,
    );
    expect(out.whatsapp.connectedAt).toBeNull();
    expect(out.whatsapp.disconnectedAt).toBe(NOW);
    // preserva metadados não-conexão (ex.: pin/registered)
    expect(out.whatsapp.pin).toBe('123456');
    expect(out.whatsapp.registered).toBe(true);
  });

  it('preserva o OUTRO canal e chaves de topo (channelActivation, etc.)', () => {
    const out = buildDisconnectSettings(
      'instagram',
      {
        channelActivation: 'both',
        whatsapp: { connectedAt: '2026-01-01T00:00:00.000Z' },
        instagram: { pageName: 'Minha Página', connectedAt: '2026-02-01T00:00:00.000Z' },
      },
      NOW,
    );
    expect(out.channelActivation).toBe('both');
    expect(out.whatsapp.connectedAt).toBe('2026-01-01T00:00:00.000Z'); // WA intacto
    expect(out.instagram.connectedAt).toBeNull();
    expect(out.instagram.disconnectedAt).toBe(NOW);
    expect(out.instagram.pageName).toBe('Minha Página'); // metadado preservado
  });

  it('é seguro com settings null/undefined', () => {
    const out = buildDisconnectSettings('whatsapp', null, NOW);
    expect(out.whatsapp.disconnectedAt).toBe(NOW);
    expect(out.whatsapp.connectedAt).toBeNull();
  });

  it('não muta o input', () => {
    const input = { whatsapp: { connectedAt: '2026-01-01T00:00:00.000Z' } };
    buildDisconnectSettings('whatsapp', input, NOW);
    expect(input.whatsapp.connectedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

// ── deriveChannelHealth: conectado/desconectado por presença de credencial ───
describe('deriveChannelHealth', () => {
  it('conectado quando token + id presentes', () => {
    const h = deriveChannelHealth({
      whatsappAccessToken: 'wa-token',
      whatsappPhoneNumberId: '123',
      instagramAccessToken: 'ig-token',
      instagramAccountId: '456',
      settings: {
        whatsapp: { connectedAt: '2026-01-01T00:00:00.000Z' },
        instagram: { connectedAt: '2026-02-01T00:00:00.000Z' },
      },
    });
    expect(h.whatsapp.connected).toBe(true);
    expect(h.instagram.connected).toBe(true);
    expect(h.whatsapp.connectedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('desconectado quando falta o token (id sozinho não conta)', () => {
    const h = deriveChannelHealth({
      whatsappPhoneNumberId: '123',
      whatsappAccessToken: null,
      instagramAccountId: '456',
      instagramAccessToken: undefined,
      settings: {},
    });
    expect(h.whatsapp.connected).toBe(false);
    expect(h.instagram.connected).toBe(false);
  });

  it('reflete disconnectedAt vindo de settings (pós-disconnect)', () => {
    const h = deriveChannelHealth({
      whatsappAccessToken: null,
      whatsappPhoneNumberId: null,
      settings: { whatsapp: { connectedAt: null, disconnectedAt: '2026-07-05T10:00:00.000Z' } },
    });
    expect(h.whatsapp.connected).toBe(false);
    expect(h.whatsapp.disconnectedAt).toBe('2026-07-05T10:00:00.000Z');
  });

  it('qualityRating começa null (enriquecido só ao vivo pelo route handler)', () => {
    const h = deriveChannelHealth({ whatsappAccessToken: 'x', whatsappPhoneNumberId: 'y', settings: {} });
    expect(h.whatsapp.qualityRating).toBeNull();
    expect(h.whatsapp.numberStatus).toBeNull();
  });
});
