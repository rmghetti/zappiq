/* ══════════════════════════════════════════════════════════════════════
 * A242: o callback do Google só CONFIRMA o cadastro.
 *
 * Quem grava o plano é /api/signup/google, antes do redirecionamento. Aqui
 * o callback nunca pode sobrescrever a escolha do lead, e quando não há
 * linha nenhuma ele precisa recuperar a escolha do cookie antes de recorrer
 * ao parâmetro da URL (que é justamente o que se perdia).
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const escritas: Array<{ op: 'insert' | 'update'; payload: any }> = [];
let linhaExistente: { id: string } | null = null;

function fakeFrom() {
  const api: any = {
    select: () => api,
    eq: () => api,
    maybeSingle: async () => ({ data: linhaExistente, error: null }),
    insert: async (payload: any) => {
      escritas.push({ op: 'insert', payload });
      return { error: null };
    },
    update: (payload: any) => {
      escritas.push({ op: 'update', payload });
      return { eq: async () => ({ error: null }) };
    },
  };
  return api;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: fakeFrom,
    auth: {
      exchangeCodeForSession: async () => ({
        data: {
          user: {
            id: 'user-google-1',
            email: 'Lead@Exemplo.com.br',
            user_metadata: { full_name: 'Lead Exemplo' },
          },
        },
        error: null,
      }),
    },
  }),
}));

async function chamar(query: string, cookie?: string) {
  const { GET } = await import('./route.js');
  return GET(
    new Request(`https://zappiq.com.br/auth/callback${query}`, {
      headers: cookie ? { cookie } : {},
    }),
  );
}

beforeEach(() => {
  escritas.length = 0;
  linhaExistente = null;
  process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-de-teste';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-de-teste';
  vi.resetModules();
});

describe('GET /auth/callback: só confirma, nunca reescreve o plano', () => {
  it('com linha existente, confirma sem tocar em plan_chosen', async () => {
    linhaExistente = { id: 'sig-1' };
    await chamar('?code=abc&plan=GROWTH');

    expect(escritas).toHaveLength(1);
    expect(escritas[0].op).toBe('update');
    expect(escritas[0].payload.status).toBe('active');
    expect(escritas[0].payload.supabase_user_id).toBe('user-google-1');
    expect(escritas[0].payload.confirmed_at).toBeTruthy();
    expect(escritas[0].payload).not.toHaveProperty('plan_chosen');
  });

  it('sem linha, usa o plano do COOKIE e não o da URL', async () => {
    await chamar('?code=abc&plan=GROWTH', 'zq_plano_escolhido=IZA_LITE');

    expect(escritas[0].op).toBe('insert');
    expect(escritas[0].payload.plan_chosen).toBe('IZA_LITE');
  });

  it('sem linha e sem cookie, cai no parâmetro da URL', async () => {
    await chamar('?code=abc&plan=SCALE');
    expect(escritas[0].payload.plan_chosen).toBe('SCALE');
  });

  it('sem nada, usa o plano de ENTRADA e não um plano mais caro', async () => {
    // O defeito: o padrão era GROWTH, ou seja, a plataforma inventava um
    // plano três vezes mais caro que o pré-selecionado na tela.
    await chamar('?code=abc');
    expect(escritas[0].payload.plan_chosen).toBe('IZA_LITE');
  });

  it('cookie com valor fora do catálogo é ignorado', async () => {
    await chamar('?code=abc&plan=SCALE', 'zq_plano_escolhido=PLANO_FALSO');
    expect(escritas[0].payload.plan_chosen).toBe('SCALE');
  });

  it('apaga o cookie do plano depois de usá-lo', async () => {
    const res = await chamar('?code=abc', 'zq_plano_escolhido=IZA_LITE');
    const cookie = res.headers.get('set-cookie') || '';
    expect(cookie).toContain('zq_plano_escolhido=');
    expect(cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });

  it('sem code, volta para o cadastro com erro', async () => {
    const res = await chamar('');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('error=missing_code');
  });
});
