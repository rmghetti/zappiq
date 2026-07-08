/**
 * impulsoChannels.test.ts — Impulso: saneamento de canais e resolução da copy.
 * ============================================================================
 * sanitizeChannels garante o requisito de negócio: Instagram só entra numa
 * campanha se o cliente tiver o Instagram conectado (hasInstagram). O gate é
 * server-side, o front não consegue burlar. resolveCampaignMessage escolhe o
 * texto que vai de fato ser disparado por canal (o editado pelo cliente vence).
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { sanitizeChannels, resolveCampaignMessage } from './impulsoChannels.js';

describe('sanitizeChannels — gate de Instagram por conexão', () => {
  it('mantém instagram quando o cliente TEM Instagram conectado', () => {
    expect(sanitizeChannels(['whatsapp', 'instagram'], { hasInstagram: true })).toEqual(['whatsapp', 'instagram']);
  });

  it('REMOVE instagram quando o cliente NÃO tem Instagram (respeita o requisito)', () => {
    expect(sanitizeChannels(['whatsapp', 'instagram'], { hasInstagram: false })).toEqual(['whatsapp']);
  });

  it('descarta canais desconhecidos', () => {
    expect(sanitizeChannels(['whatsapp', 'telegram', 'fax'], { hasInstagram: true })).toEqual(['whatsapp']);
  });

  it('normaliza caixa/espaços e deduplica', () => {
    expect(sanitizeChannels([' WhatsApp ', 'whatsapp', 'EMAIL'], { hasInstagram: true })).toEqual(['whatsapp', 'email']);
  });

  it('lista vazia ou não-array vira ["whatsapp"] (Impulso nunca dispara sem canal)', () => {
    expect(sanitizeChannels([], { hasInstagram: true })).toEqual(['whatsapp']);
    expect(sanitizeChannels(undefined, { hasInstagram: true })).toEqual(['whatsapp']);
    expect(sanitizeChannels('whatsapp', { hasInstagram: true })).toEqual(['whatsapp']);
  });

  it('instagram sozinho sem conexão não deixa a campanha sem canal (cai pra whatsapp)', () => {
    expect(sanitizeChannels(['instagram'], { hasInstagram: false })).toEqual(['whatsapp']);
  });

  it('instagram sozinho COM conexão é preservado', () => {
    expect(sanitizeChannels(['instagram'], { hasInstagram: true })).toEqual(['instagram']);
  });
});

describe('resolveCampaignMessage — texto que vai de fato ser disparado', () => {
  it('usa a mensagem do canal quando existe (texto salvo/editado pelo cliente)', () => {
    const c = { message: { whatsapp: 'Oi, tudo bem?', instagram: 'Oi no insta' }, template: { bodyText: 'template' } };
    expect(resolveCampaignMessage(c, 'whatsapp')).toBe('Oi, tudo bem?');
    expect(resolveCampaignMessage(c, 'instagram')).toBe('Oi no insta');
  });

  it('cai para o bodyText do template quando não há mensagem do canal', () => {
    const c = { message: { email: 'só email' }, template: { bodyText: 'texto do template' } };
    expect(resolveCampaignMessage(c, 'whatsapp')).toBe('texto do template');
  });

  it('mensagem vazia/espaços não conta (cai pro fallback)', () => {
    const c = { message: { whatsapp: '   ' }, template: { bodyText: 'fallback' } };
    expect(resolveCampaignMessage(c, 'whatsapp')).toBe('fallback');
  });

  it('sem mensagem nem template → string vazia (não quebra o disparo)', () => {
    expect(resolveCampaignMessage({ message: null, template: null }, 'whatsapp')).toBe('');
    expect(resolveCampaignMessage({}, 'whatsapp')).toBe('');
  });
});
