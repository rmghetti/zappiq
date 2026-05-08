/**
 * POST /api/login/magic
 * --------------------------------------------------------------
 * PR #102 — Auth Login Resilience
 *
 * Envia Magic Link de LOGIN pra cliente que JÁ tem conta.
 * Usa shouldCreateUser:false pra não criar conta nova se email não existir.
 *
 * Retorno genérico 200 mesmo se email não existe, pra evitar enumeração de
 * usuários (security best practice). Cliente sempre vê "verifique seu email".
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface Body {
  email: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body.email) {
      return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      console.error('[login/magic] Missing Supabase env');
      return NextResponse.json({ error: 'Configuração indisponível' }, { status: 500 });
    }
    const sb = createClient(supabaseUrl, anonKey);

    const baseUrl =
      process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://zappiq.com.br');

    const email = body.email.trim().toLowerCase();

    // signInWithOtp envia magic link. shouldCreateUser:false impede criação
    // de conta nova se email não existe (este é endpoint de LOGIN, não signup).
    const { error: otpErr } = await sb.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${baseUrl}/auth/login-callback`,
      },
    });

    // PR #102.1 hotfix: anti-enumeração robusta.
    // shouldCreateUser:false faz Supabase retornar erros variados pra emails
    // inexistentes ("Signups not allowed for this instance", "User not found",
    // "Invalid email", rate-limits, etc). Listar cada um vira jogo de gato e
    // rato. Solução: SEMPRE 200 OK pro cliente. Log do erro server-side.
    //
    // Tradeoff conhecido: se SMTP cair, cliente acha que enviou mas nada chega.
    // Aceitável pra MVP — segue padrão de Auth0, Clerk, Stytch.
    if (otpErr) {
      console.warn('[login/magic] OTP non-fatal error:', otpErr.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[login/magic] Unexpected error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
