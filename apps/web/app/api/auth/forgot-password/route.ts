/**
 * POST /api/auth/forgot-password
 * --------------------------------------------------------------
 * PR #102 — Auth Login Resilience
 *
 * Envia link de redefinição/criação de senha via Supabase.
 * Funciona pra "esqueci minha senha" E pra "nunca defini senha"
 * (clientes que entraram via Magic Link / Google).
 *
 * Resposta sempre 200 (genérica) pra evitar enumeração de usuários.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface Body {
  email: string;
}

export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as Body;

    if (!email) {
      return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      console.error('[forgot-password] Missing Supabase env');
      return NextResponse.json({ error: 'Configuração indisponível' }, { status: 500 });
    }
    const sb = createClient(supabaseUrl, anonKey);

    const baseUrl =
      process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://zappiq.com.br');

    const normalizedEmail = email.trim().toLowerCase();

    // Supabase envia link com #access_token=...&type=recovery no hash
    // que /redefinir-senha detecta client-side.
    const { error } = await sb.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${baseUrl}/redefinir-senha`,
    });

    if (error) {
      // Não vazar info de existência. Log pra interno, retorno genérico.
      console.warn('[forgot-password] resetPasswordForEmail error:', error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[forgot-password] Unexpected:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
