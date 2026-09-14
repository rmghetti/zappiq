/**
 * Links dos e-mails: têm de apontar para uma rota que existe no domínio do app.
 *
 * Bug original (14/09/2026): os botões da régua de trial eram montados com
 * env.APP_URL, cujo padrão era https://app.zappiq.com.br, um host que nem
 * resolve HTTPS. O e-mail de conversão, enviado de verdade pelo webhook do
 * Stripe, tinha o link fixo https://app.zappiq.com.br/settings/billing: host
 * errado E rota que não existe nem no domínio certo (a fatura está em
 * /billing).
 *
 * Estes testes travam duas coisas: o padrão do APP_URL e a ausência do host
 * fantasma nos templates. A prova de que a rota responde 200 é feita por curl
 * contra o preview no PR, não aqui (teste não faz rede).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTrialConvertedEmail } from './trialConverted.js';

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Hosts que não servem o app e não podem aparecer em link de e-mail. */
const HOSTS_MORTOS = ['app.zappiq.com.br', 'zappiq-api.fly.dev'];

function arquivosDeTemplate(): string[] {
  return readdirSync(AQUI)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => join(AQUI, f));
}

describe('templates de e-mail não apontam para host que não serve o app', () => {
  for (const host of HOSTS_MORTOS) {
    it(`nenhum template cita ${host}`, () => {
      const achados: string[] = [];
      for (const caminho of arquivosDeTemplate()) {
        readFileSync(caminho, 'utf8')
          .split('\n')
          .forEach((linha, i) => {
            if (linha.includes(host)) {
              achados.push(`${caminho.split('/').pop()}:${i + 1}  ${linha.trim().slice(0, 140)}`);
            }
          });
      }
      expect(achados, achados.join('\n  ')).toEqual([]);
    });
  }
});

describe('trialConverted · link da fatura', () => {
  const entrada = {
    firstName: 'Pedro',
    orgName: 'Soluções Tech',
    tierLabel: 'Growth',
    monthlyBrl: 797,
  };

  it('manda para /billing no domínio do app, no HTML e no texto', () => {
    const { html, text } = renderTrialConvertedEmail(entrada);
    expect(html).toContain('https://zappiq.com.br/billing');
    expect(text).toContain('https://zappiq.com.br/billing');
  });

  it('não usa a rota /settings/billing, que não existe', () => {
    const { html, text } = renderTrialConvertedEmail(entrada);
    expect(html).not.toContain('/settings/billing');
    expect(text).not.toContain('/settings/billing');
  });
});
