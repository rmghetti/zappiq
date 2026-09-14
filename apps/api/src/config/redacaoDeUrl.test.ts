/**
 * redacaoDeUrl.test.ts (A201)
 * ============================================================================
 * As auto-instrumentações gravavam a URL completa de cada chamada de saída num
 * atributo de span. Com credencial em query string, o atributo virava caminho
 * de vazamento para o serviço de observabilidade de terceiro.
 *
 * Este teste roda os ganchos de verdade, com o mesmo formato de objeto que as
 * instrumentações passam, e exige que nenhum atributo saia com a query.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  urlSemQuery,
  caminhoSemQuery,
  atributosSemQueryDoUndici,
  atributosSemQueryDoHttp,
  atributosSemQueryDaEntrada,
  instrumentacoesSemQueryNaUrl,
} from './redacaoDeUrl.js';

describe('urlSemQuery', () => {
  it('tira a query e o fragmento', () => {
    expect(urlSemQuery('https://exemplo.com/a/b?key=segredo#x')).toBe('https://exemplo.com/a/b');
  });

  it('deixa a URL sem query como está', () => {
    expect(urlSemQuery('https://exemplo.com/a/b')).toBe('https://exemplo.com/a/b');
  });

  it('não quebra com texto que não é URL', () => {
    expect(urlSemQuery('/v1/x?token=abc')).toBe('/v1/x');
    expect(urlSemQuery('')).toBe('');
  });
});

describe('caminhoSemQuery', () => {
  it('corta na interrogação', () => {
    expect(caminhoSemQuery('/v1beta/models/x:generateContent?key=abc')).toBe(
      '/v1beta/models/x:generateContent',
    );
  });
});

describe('gancho do undici (fetch)', () => {
  it('a chave do Gemini não sobrevive em nenhum atributo', () => {
    const attrs = atributosSemQueryDoUndici({
      origin: 'https://generativelanguage.googleapis.com',
      path: '/v1beta/models/gemini-2.5-flash:generateContent?key=CHAVE_SECRETA',
    });
    expect(JSON.stringify(attrs)).not.toContain('CHAVE_SECRETA');
    expect(attrs['url.full']).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
    expect(attrs['url.query']).toBe('');
  });

  it('a chave do TTS do Google também não sobrevive', () => {
    const attrs = atributosSemQueryDoUndici({
      origin: 'https://texttospeech.googleapis.com',
      path: '/v1/text:synthesize?key=OUTRA_CHAVE',
    });
    expect(JSON.stringify(attrs)).not.toContain('OUTRA_CHAVE');
  });
});

describe('gancho do http (axios)', () => {
  it('o par de app da Meta não sobrevive em nenhum atributo', () => {
    const attrs = atributosSemQueryDoHttp({
      protocol: 'https:',
      hostname: 'graph.facebook.com',
      path: '/v21.0/1234/subscribed_apps?access_token=APPID%7CAPPSECRET',
    });
    expect(JSON.stringify(attrs)).not.toContain('APPSECRET');
    expect(attrs['http.url']).toBe('https://graph.facebook.com/v21.0/1234/subscribed_apps');
    expect(attrs['http.target']).toBe('/v21.0/1234/subscribed_apps');
  });

  it('mantém a porta quando ela existe', () => {
    const attrs = atributosSemQueryDoHttp({
      protocol: 'http:',
      hostname: 'servico.interno',
      port: 8080,
      path: '/x?y=1',
    });
    expect(attrs['http.url']).toBe('http://servico.interno:8080/x');
  });
});

describe('configuração entregue às auto-instrumentações', () => {
  it('liga a redação no undici e no http, e mantém fs e dns desligados', () => {
    const cfg: any = instrumentacoesSemQueryNaUrl;
    expect(cfg['@opentelemetry/instrumentation-fs'].enabled).toBe(false);
    expect(cfg['@opentelemetry/instrumentation-dns'].enabled).toBe(false);

    const doUndici = cfg['@opentelemetry/instrumentation-undici'].startSpanHook({
      origin: 'https://generativelanguage.googleapis.com',
      path: '/v1beta/models/x:generateContent?key=CHAVE_SECRETA',
    });
    expect(JSON.stringify(doUndici)).not.toContain('CHAVE_SECRETA');

    const doHttp = cfg['@opentelemetry/instrumentation-http'].startOutgoingSpanHook({
      protocol: 'https:',
      hostname: 'graph.facebook.com',
      path: '/v21.0/x?access_token=APPID%7CAPPSECRET',
    });
    expect(JSON.stringify(doHttp)).not.toContain('APPSECRET');
  });

  it('gancho não quebra com objeto vazio', () => {
    const cfg: any = instrumentacoesSemQueryNaUrl;
    expect(() => cfg['@opentelemetry/instrumentation-undici'].startSpanHook(undefined)).not.toThrow();
    expect(() =>
      cfg['@opentelemetry/instrumentation-http'].startOutgoingSpanHook(undefined),
    ).not.toThrow();
  });
});

describe('gancho de ENTRADA do http (P6 da revisão do PR #369)', () => {
  it('o código do OAuth do Google não sobrevive em nenhum atributo', () => {
    const attrs = atributosSemQueryDaEntrada({
      url: '/api/auth/google/callback?code=CODIGO_DE_TROCA&scope=email',
      headers: { host: 'api.zappiq.com.br' },
    });
    expect(JSON.stringify(attrs)).not.toContain('CODIGO_DE_TROCA');
    expect(attrs['http.target']).toBe('/api/auth/google/callback');
    expect(attrs['url.path']).toBe('/api/auth/google/callback');
    expect(attrs['url.query']).toBe('');
    expect(attrs['http.url']).toBe('http://api.zappiq.com.br/api/auth/google/callback');
  });

  it('o verify token do webhook da Meta não sobrevive', () => {
    const attrs = atributosSemQueryDaEntrada({
      url: '/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=TOKEN_DO_WEBHOOK',
      headers: { host: 'api.zappiq.com.br' },
    });
    expect(JSON.stringify(attrs)).not.toContain('TOKEN_DO_WEBHOOK');
  });

  it('o session_id do Stripe não sobrevive', () => {
    const attrs = atributosSemQueryDaEntrada({
      url: '/api/billing/success?session_id=cs_live_SEGREDO',
      headers: { host: 'api.zappiq.com.br' },
      socket: { encrypted: true },
    });
    expect(JSON.stringify(attrs)).not.toContain('cs_live_SEGREDO');
    expect(attrs['http.url']).toBe('https://api.zappiq.com.br/api/billing/success');
  });

  it('não quebra sem host nem url', () => {
    expect(() => atributosSemQueryDaEntrada({})).not.toThrow();
    expect(atributosSemQueryDaEntrada({})['url.query']).toBe('');
  });
});

describe('gancho de entrada ligado na configuração (P6)', () => {
  it('a instrumentação http recebe startIncomingSpanHook', () => {
    const cfg: any = instrumentacoesSemQueryNaUrl;
    expect(typeof cfg['@opentelemetry/instrumentation-http'].startIncomingSpanHook).toBe(
      'function',
    );
    const attrs = cfg['@opentelemetry/instrumentation-http'].startIncomingSpanHook({
      url: '/api/auth/google/callback?code=CODIGO_DE_TROCA',
      headers: { host: 'api.zappiq.com.br' },
    });
    expect(JSON.stringify(attrs)).not.toContain('CODIGO_DE_TROCA');
    expect(() =>
      cfg['@opentelemetry/instrumentation-http'].startIncomingSpanHook(undefined),
    ).not.toThrow();
  });
});
