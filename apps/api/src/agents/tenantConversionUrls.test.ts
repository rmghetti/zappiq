/**
 * tenantConversionUrls.test.ts
 * ============================================================================
 * Depois de tirar as URLs da ZappIQ do prompt de todo cliente, o agente ficaria
 * sem link nenhum pra mandar quando o lead aceita a oferta. Este módulo repõe
 * o link com o dado do PRÓPRIO cliente.
 *
 * A regra que não pode quebrar: ausência de dado NUNCA cai pra ZappIQ.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { extractConversionUrls, normalizeUrl } from './tenantConversionUrls.js';
import { findForeignBrandLeaks } from './tenantIsolationGuard.js';

describe('normalizeUrl', () => {
  it('completa o protocolo (o CMJ cadastrou "cmj.com.br" sem https)', () => {
    expect(normalizeUrl('cmj.com.br')).toBe('https://cmj.com.br');
  });

  it('preserva URL já completa e tira barra final', () => {
    expect(normalizeUrl('https://machia.tech/')).toBe('https://machia.tech');
    expect(normalizeUrl('https://ghettiitalianfood.com.br')).toBe('https://ghettiitalianfood.com.br');
  });

  it('não transforma texto livre em URL', () => {
    // O survey é texto livre: o cliente pode ter escrito qualquer coisa.
    expect(normalizeUrl('não temos site')).toBeNull();
    expect(normalizeUrl('ainda vou criar')).toBeNull();
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('   ')).toBeNull();
    expect(normalizeUrl(undefined)).toBeNull();
    expect(normalizeUrl(42)).toBeNull();
  });
});

describe('extractConversionUrls', () => {
  it('lê o site que o cliente cadastrou no Treinar IA', () => {
    const urls = extractConversionUrls({
      businessName: 'CMJ',
      surveyAnswers: { identidade_empresa: { ide_site_url: 'cmj.com.br' } },
    });
    expect(urls).toEqual({ site: 'https://cmj.com.br' });
  });

  it('inclui o link de agendamento do cliente quando existe', () => {
    const urls = extractConversionUrls(
      { surveyAnswers: { identidade_empresa: { ide_site_url: 'cmj.com.br' } } },
      { schedulingUrl: 'https://cal.com/cmj/reuniao' },
    );
    expect(urls).toEqual({
      site: 'https://cmj.com.br',
      scheduling: 'https://cal.com/cmj/reuniao',
    });
  });

  it('cliente que não cadastrou nada não ganha bloco de link', () => {
    // Felix móveis: 0 respostas de survey. Não pode herdar link de ninguém.
    expect(extractConversionUrls({ businessName: 'Felix moveis' })).toBeNull();
    expect(extractConversionUrls({})).toBeNull();
    expect(extractConversionUrls(null)).toBeNull();
    expect(extractConversionUrls({ surveyAnswers: { identidade_empresa: {} } })).toBeNull();
  });

  it('NUNCA devolve link da ZappIQ, nem quando não há dado', () => {
    for (const settings of [null, {}, { surveyAnswers: { identidade_empresa: { ide_site_url: '' } } }]) {
      const urls = extractConversionUrls(settings as any);
      expect(findForeignBrandLeaks(JSON.stringify(urls ?? {}))).toEqual([]);
    }
  });
});
