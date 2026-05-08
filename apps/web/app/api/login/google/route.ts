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

export async function POST() {
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

    const baseUrl =
      process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://zappiq.com.br');

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
