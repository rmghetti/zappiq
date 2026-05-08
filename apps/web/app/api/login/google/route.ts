/**
 * POST /api/login/google
 * --------------------------------------------------------------
 * PR #102 — Auth Login Resilience
 *
 * Inicia OAuth Google via Supabase Auth pra LOGIN (cliente que JÁ tem conta).
 * Diferente de /api/signup/google: não passa plan, não cria signup row,
 * redireciona pra /auth/login-callback que faz exchange e gera JWT nosso.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// PR #105 — Helper pra resolver o baseUrl do redirect_to OAuth.
// Em prod: hardcoded zappiq.com.br (custom domain, sem Vercel Auth).
// Em preview: deriva do host do request (branch alias).
function getBaseUrl(req: Request): string {
  if (process.env.VERCEL_ENV === 'production') {
    return 'https://zappiq.com.br';
  }
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Configuração indisponível' }, { status: 500 });
    }

    // PR #103.6 — flowType: 'implicit' força Supabase a retornar tokens
    // direto no hash da URL (#access_token=...&refresh_token=...) em vez de
    // PKCE (?code=). PKCE server-side sem storage não propaga code_verifier
    // pro browser, quebra o exchange. Implicit funciona porque a page
    // /auth/login-callback ja tem codigo pra ler hash (igual Magic Link).
    const sb = createClient(supabaseUrl, anonKey, {
      auth: { flowType: 'implicit', persistSession: false },
    });

    // PR #105 — em prod SEMPRE zappiq.com.br (custom domain sem Vercel Auth).
    // VERCEL_URL aponta pra hash deployment URL que tem Deployment Protection
    // ligado, exigindo login Vercel — quebrava o callback OAuth.
    const baseUrl = getBaseUrl(req);

    // login-callback é page client-side que detecta tokens e troca por JWT nosso
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${baseUrl}/auth/login-callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account', // mostra account picker — útil pra cliente trocar conta
        },
      },
    });

    if (error || !data.url) {
      return NextResponse.json({ error: error?.message || 'Falha OAuth' }, { status: 500 });
    }

    return NextResponse.json({ url: data.url });
  } catch (err) {
    console.error('[login/google] Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
