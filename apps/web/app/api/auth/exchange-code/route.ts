/**
 * POST /api/auth/exchange-code
 * --------------------------------------------------------------
 * PR #102 — auxiliar do /auth/login-callback
 *
 * Recebe o `code` PKCE do redirect Google OAuth e troca por sessão Supabase.
 * Retorna access_token + refresh_token pra o page client-side encaminhar
 * pro backend Express /api/auth/passwordless-exchange.
 *
 * NOTA: usado APENAS pelo fluxo de login (não signup). Pra signup, o
 * /auth/callback existente já faz exchange + UPSERT signups.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface Body {
  code: string;
}

export async function POST(req: Request) {
  try {
    const { code } = (await req.json()) as Body;
    if (!code) {
      return NextResponse.json({ error: 'code obrigatório' }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Configuração indisponível' }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, anonKey);
    const { data, error } = await sb.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      console.error('[exchange-code] Error:', error);
      return NextResponse.json({ error: error?.message || 'Falha exchange' }, { status: 400 });
    }

    return NextResponse.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (err) {
    console.error('[exchange-code] Unexpected:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
