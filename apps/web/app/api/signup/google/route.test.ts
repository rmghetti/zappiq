/* ══════════════════════════════════════════════════════════════════════
 * A242: o plano escolhido tem de estar GRAVADO antes de o lead sair do
 * nosso domínio para o Google.
 *
 * Medido em produção: signup_oauth_started com plan=IZA_LITE oito vezes
 * (23/07, 11/08, 20/08, 02/09) e as linhas correspondentes em `signups`
 * gravadas como GROWTH. O parâmetro da URL não sobrevive ao round-trip do
 * OAuth de forma confiável, então quem grava é a rota que INICIA o fluxo.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── Dublê do Supabase ────────────────────────────────────────────── */
const escritas: Array<{ tabela: string; op: 'insert' | 'update'; payload: any }> = [];
let linhaExistente: { id: string; plan_chosen: string | null } | null = null;
let oauthUrl: string | null = 'https://accounts.google.com/o/oauth2/v2/auth?state=abc';
/**
 * Erro que o supabase-js DEVOLVE (não lança). Foi assim que a gravação com
 * `status: 'pending_oauth'` morreu calada por um mês: a constraint real
 * recusava a linha e ninguém olhava o `error` da resposta.
 */
let erroDoBanco: { message: string; code?: string } | null = null;

function fakeFrom(tabela: string) {
  const api: any = {
    select: () => api,
    eq: () => api,
    maybeSingle: async () => ({ data: linhaExistente, error: null }),
    insert: async (payload: any) => {
      escritas.push({ tabela, op: 'insert', payload });
      return { error: erroDoBanco };
    },
    update: (payload: any) => {
      escritas.push({ tabela, op: 'update', payload });
      return { eq: async () => ({ error: erroDoBanco }) };
    },
  };
  return api;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: fakeFrom,
    auth: {
      signInWithOAuth: async () => ({
        data: oauthUrl ? { url: oauthUrl } : { url: null },
        error: oauthUrl ? null : { message: 'Falha OAuth' },
      }),
    },
  }),
}));

async function chamar(body: Record<string, unknown>) {
  const { POST } = await import('./route.js');
  return POST(
    new Request('https://zappiq.com.br/api/signup/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  escritas.length = 0;
  linhaExistente = null;
  erroDoBanco = null;
  oauthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?state=abc';
  process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-de-teste';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-de-teste';
  delete process.env.VERCEL_ENV;
  vi.resetModules();
});

describe('POST /api/signup/google: plano gravado antes do redirecionamento', () => {
  it('com e-mail, cria o signup com o plano escolhido ANTES de devolver a URL', async () => {
    const res = await chamar({ plan: 'IZA_LITE', email: 'Lead@Exemplo.com.br', name: 'Lead' });
    expect(res.status).toBe(200);

    const gravacao = escritas.find((e) => e.tabela === 'signups');
    expect(gravacao, 'o signup precisa ser gravado antes do redirecionamento').toBeTruthy();
    expect(gravacao!.op).toBe('insert');
    expect(gravacao!.payload.plan_chosen).toBe('IZA_LITE');
    expect(gravacao!.payload.email).toBe('lead@exemplo.com.br');
  });

  it('com e-mail já cadastrado, ATUALIZA o plano escolhido em vez de duplicar', async () => {
    linhaExistente = { id: 'sig-1', plan_chosen: 'GROWTH' };
    await chamar({ plan: 'SCALE', email: 'lead@exemplo.com.br' });

    const gravacao = escritas.find((e) => e.tabela === 'signups');
    expect(gravacao!.op).toBe('update');
    expect(gravacao!.payload.plan_chosen).toBe('SCALE');
  });

  it('devolve a URL do Google e um cookie com o plano (rede para quem não digitou e-mail)', async () => {
    const res = await chamar({ plan: 'IZA_LITE' });
    const body = await res.json();
    expect(body.url).toContain('accounts.google.com');

    const cookie = res.headers.get('set-cookie') || '';
    expect(cookie).toContain('zq_plano_escolhido=IZA_LITE');
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
  });

  it('sem e-mail não grava linha nenhuma (não dá para inventar a chave)', async () => {
    await chamar({ plan: 'IZA_LITE' });
    expect(escritas.filter((e) => e.tabela === 'signups')).toHaveLength(0);
  });

  it('e-mail inválido não vira linha no banco', async () => {
    await chamar({ plan: 'IZA_LITE', email: 'nao-e-email' });
    expect(escritas.filter((e) => e.tabela === 'signups')).toHaveLength(0);
  });

  it('plano fora do catálogo de self-signup é recusado com 400', async () => {
    const res = await chamar({ plan: 'ENTERPRISE', email: 'lead@exemplo.com.br' });
    expect(res.status).toBe(400);
    expect(escritas).toHaveLength(0);
  });

  it('falha ao gravar o signup NÃO impede o lead de entrar pelo Google', async () => {
    // A gravação é best-effort: o cookie ainda carrega a escolha e o
    // callback tem o parâmetro da URL como terceira rede.
    linhaExistente = null;
    const original = escritas.push.bind(escritas);
    escritas.push = () => {
      throw new Error('banco fora');
    };
    try {
      const res = await chamar({ plan: 'IZA_LITE', email: 'lead@exemplo.com.br' });
      expect(res.status).toBe(200);
      expect((await res.json()).url).toContain('accounts.google.com');
    } finally {
      escritas.push = original;
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * C1 da revisão do PR #374.
 *
 * Dois defeitos no mesmo trecho:
 *
 *   1. a linha nascia com `status: 'pending_oauth'`, valor que a
 *      constraint `signups_status_check` de produção NÃO aceita. O INSERT
 *      seria recusado pelo banco e a rede número 1 nunca existiu de fato;
 *   2. nem o insert nem o update olhavam o `error` da resposta do
 *      supabase-js, que devolve o erro em vez de lançar. A falha saía
 *      calada, e o único sintoma era a conta nascer no plano errado.
 *
 * O status real é 'pending_email', que é o que a tabela aceita. A intenção
 * ("veio do OAuth, ainda não voltou") vive em `meta.source`, que é JSONB e
 * não tem constraint.
 * ══════════════════════════════════════════════════════════════════════ */
describe('POST /api/signup/google: o status gravado é um que o banco aceita', () => {
  it('grava pending_email, nunca pending_oauth', async () => {
    await chamar({ plan: 'IZA_LITE', email: 'lead@exemplo.com.br' });
    const gravacao = escritas.find((e) => e.tabela === 'signups');
    expect(gravacao!.payload.status).toBe('pending_email');
    expect(gravacao!.payload.status).not.toBe('pending_oauth');
  });

  it('a intenção do OAuth fica em meta, que não tem constraint', async () => {
    await chamar({ plan: 'IZA_LITE', email: 'lead@exemplo.com.br' });
    const gravacao = escritas.find((e) => e.tabela === 'signups');
    expect(gravacao!.payload.meta).toEqual({ source: 'oauth_google_intent' });
  });
});

describe('POST /api/signup/google: erro devolvido pelo banco não passa calado', () => {
  it('insert recusado pelo banco vira log de erro', async () => {
    const espiao = vi.spyOn(console, 'error').mockImplementation(() => {});
    erroDoBanco = { message: 'new row violates check constraint', code: '23514' };
    try {
      const res = await chamar({ plan: 'IZA_LITE', email: 'lead@exemplo.com.br' });
      expect(res.status).toBe(200); // o lead entra mesmo assim
      expect(espiao).toHaveBeenCalled();
      const texto = espiao.mock.calls.map((c) => JSON.stringify(c)).join(' ');
      expect(texto).toContain('check constraint');
    } finally {
      espiao.mockRestore();
    }
  });

  it('update recusado pelo banco vira log de erro', async () => {
    const espiao = vi.spyOn(console, 'error').mockImplementation(() => {});
    linhaExistente = { id: 'sig-1', plan_chosen: 'GROWTH' };
    erroDoBanco = { message: 'permission denied for table signups', code: '42501' };
    try {
      await chamar({ plan: 'SCALE', email: 'lead@exemplo.com.br' });
      expect(espiao).toHaveBeenCalled();
      const texto = espiao.mock.calls.map((c) => JSON.stringify(c)).join(' ');
      expect(texto).toContain('permission denied');
    } finally {
      espiao.mockRestore();
    }
  });

  it('o log NÃO carrega o e-mail do lead (o erro é de infra, não de pessoa)', async () => {
    const espiao = vi.spyOn(console, 'error').mockImplementation(() => {});
    erroDoBanco = { message: 'new row violates check constraint', code: '23514' };
    try {
      await chamar({ plan: 'IZA_LITE', email: 'lead@exemplo.com.br' });
      const texto = espiao.mock.calls.map((c) => JSON.stringify(c)).join(' ');
      expect(texto).not.toContain('lead@exemplo.com.br');
      expect(texto).not.toContain('exemplo.com.br');
    } finally {
      espiao.mockRestore();
    }
  });

  it('gravação sem erro não loga nada', async () => {
    const espiao = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await chamar({ plan: 'IZA_LITE', email: 'lead@exemplo.com.br' });
      expect(espiao).not.toHaveBeenCalled();
    } finally {
      espiao.mockRestore();
    }
  });
});
