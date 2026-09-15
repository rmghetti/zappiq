/* ══════════════════════════════════════════════════════════════════════
 * Origens do widget por settings.webChatAllowedOrigins (C1b, Passo 4, A241).
 * --------------------------------------------------------------------
 * A lista escrita no código segue valendo (reserva, o comportamento de
 * hoje). O que muda: a organização pode cadastrar as origens do site dela,
 * e SÓ as rotas públicas do widget dela passam a aceitá-las.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi } from 'vitest';
import {
  padroesDeOrigemFixos,
  origemCasaComPadroes,
  origemNormalizada,
  origensDaOrganizacao,
  origemPermitidaNoWidget,
  orgDaRotaDoWidget,
  criarDelegadoDeCors,
} from './origensPermitidas.js';

const FIXOS = padroesDeOrigemFixos('https://app.zappiq.com.br');

describe('lista fixa (a de sempre)', () => {
  it('mantém as origens de hoje, inclusive o CMJ e os previews', () => {
    for (const o of [
      'https://app.zappiq.com.br',
      'https://zappiq.com.br',
      'https://www.zappiq.com.br',
      'https://cmj.com.br',
      'https://www.cmj.com.br',
      'https://zappiq-git-feat-x-zappiq.vercel.app',
      'https://zappiq-abc123-zappiq.vercel.app',
      'http://localhost:3000',
    ]) {
      expect(origemCasaComPadroes(o, FIXOS), o).toBe(true);
    }
    expect(origemCasaComPadroes('https://clinica.com.br', FIXOS)).toBe(false);
  });
});

describe('origens cadastradas pela organização', () => {
  it('normaliza: minúsculas, sem barra, só esquema e host; lixo vira nada', () => {
    expect(origemNormalizada('https://Clinica.com.br/')).toBe('https://clinica.com.br');
    expect(origemNormalizada('https://clinica.com.br/contato?x=1')).toBe('https://clinica.com.br');
    expect(origemNormalizada('http://localhost:8080')).toBe('http://localhost:8080');
    for (const lixo of ['clinica.com.br', 'javascript:alert(1)', 'ftp://x.com', '', 42, null]) {
      expect(origemNormalizada(lixo as any)).toBeNull();
    }
  });

  it('lê settings.webChatAllowedOrigins, sem repetir; sem a chave, vazio', () => {
    expect(
      origensDaOrganizacao({ webChatAllowedOrigins: ['https://a.com.br', 'https://A.com.br/', 'lixo'] }),
    ).toEqual(['https://a.com.br']);
    expect(origensDaOrganizacao({})).toEqual([]);
    expect(origensDaOrganizacao({ webChatAllowedOrigins: 'https://a.com.br' })).toEqual([]);
    expect(origensDaOrganizacao(null)).toEqual([]);
  });

  it('o widget roda na lista fixa OU nas origens da organização; sem Origin, passa (como o CORS de hoje)', () => {
    const daOrg = ['https://clinica.com.br'];
    expect(origemPermitidaNoWidget({ origin: 'https://cmj.com.br', padroesFixos: FIXOS, origensDaOrganizacao: [] })).toBe(true);
    expect(origemPermitidaNoWidget({ origin: 'https://clinica.com.br', padroesFixos: FIXOS, origensDaOrganizacao: daOrg })).toBe(true);
    expect(origemPermitidaNoWidget({ origin: 'https://outro.com.br', padroesFixos: FIXOS, origensDaOrganizacao: daOrg })).toBe(false);
    expect(origemPermitidaNoWidget({ origin: undefined, padroesFixos: FIXOS, origensDaOrganizacao: [] })).toBe(true);
  });
});

describe('CORS: a exceção vale só para as rotas do widget da organização', () => {
  const checagemFixa = vi.fn();
  const origensDoWidget = vi.fn(async (org: string) => (org === 'org-clinica' ? ['https://clinica.com.br'] : []));
  const delegado = criarDelegadoDeCors({ padroesFixos: FIXOS, checagemFixa, origensDoWidget });

  function decidir(path: string, origin?: string): Promise<any> {
    return new Promise((resolve) => delegado({ path, headers: origin ? { origin } : {} }, (_e, o) => resolve(o)));
  }

  it('reconhece a organização na rota do widget', () => {
    expect(orgDaRotaDoWidget('/api/web-chat/org/org-clinica/message')).toBe('org-clinica');
    expect(orgDaRotaDoWidget('/api/web-chat/org/org-clinica/config')).toBe('org-clinica');
    expect(orgDaRotaDoWidget('/api/web-chat/iza-message')).toBeNull();
    expect(orgDaRotaDoWidget('/api/conversations/x/messages')).toBeNull();
  });

  it('origem cadastrada pela organização, na rota do widget dela: liberada', async () => {
    const o = await decidir('/api/web-chat/org/org-clinica/message', 'https://clinica.com.br');
    expect(o).toEqual({ origin: true, credentials: true });
  });

  it('a mesma origem na rota do widget de OUTRA organização: checagem fixa (recusada como hoje)', async () => {
    const o = await decidir('/api/web-chat/org/org-outra/message', 'https://clinica.com.br');
    expect(o.origin).toBe(checagemFixa);
  });

  it('a mesma origem em qualquer outra rota da API: checagem fixa, sem ler settings', async () => {
    origensDoWidget.mockClear();
    const o = await decidir('/api/conversations', 'https://clinica.com.br');
    expect(o.origin).toBe(checagemFixa);
    expect(origensDoWidget).not.toHaveBeenCalled();
  });

  it('origem da lista fixa ou sem Origin: checagem fixa, sem ler settings', async () => {
    origensDoWidget.mockClear();
    expect((await decidir('/api/web-chat/org/org-clinica/message', 'https://cmj.com.br')).origin).toBe(checagemFixa);
    expect((await decidir('/api/web-chat/org/org-clinica/message')).origin).toBe(checagemFixa);
    expect(origensDoWidget).not.toHaveBeenCalled();
  });

  it('banco fora ao ler as origens: checagem fixa (nada novo é liberado por erro)', async () => {
    const quebrado = criarDelegadoDeCors({
      padroesFixos: FIXOS,
      checagemFixa,
      origensDoWidget: async () => {
        throw new Error('db down');
      },
    });
    const o = await new Promise<any>((r) =>
      quebrado({ path: '/api/web-chat/org/org-clinica/message', headers: { origin: 'https://clinica.com.br' } }, (_e, x) => r(x)),
    );
    expect(o.origin).toBe(checagemFixa);
  });
});
