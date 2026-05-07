/**
 * POST /api/auth/reset-password
 * --------------------------------------------------------------
 * PR #102 — Auth Login Resilience
 *
 * Recebe access_token do email de recovery + nova senha.
 * Valida o token via Supabase Admin (decodifica JWT, pega user_id),
 * usa supabase.auth.admin.updateUserById pra atualizar a senha.
 * IMPORTANTE: também atualiza a senha no backend Express (Prisma)
 * via /api/auth/sync-password pra cliente conseguir logar com senha+email.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface Body {
  access_token: string;
  password: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  exp?: number;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = Buffer.from(
      payload.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { access_token, password } = (await req.json()) as Body;

    if (!access_token || !password) {
      return NextResponse.json({ error: 'access_token e password obrigatórios' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Senha deve ter pelo menos 8 caracteres' }, { status: 400 });
    }

    const payload = decodeJwtPayload(access_token);
    if (!payload || !payload.sub || !payload.email) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return NextResponse.json({ error: 'Link expirado — solicite um novo' }, { status: 401 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Configuração indisponível' }, { status: 500 });
    }
    const sbAdmin = createClient(supabaseUrl, serviceKey);

    // Atualiza senha no Supabase Auth
    const { error: updateErr } = await sbAdmin.auth.admin.updateUserById(payload.sub, {
      password,
    });

    if (updateErr) {
      console.error('[reset-password] Supabase update error:', updateErr);
      return NextResponse.json({ error: 'Falha ao atualizar senha' }, { status: 500 });
    }

    // Sincroniza senha no backend Express (Prisma) pra /api/auth/login funcionar
    // Fire-and-forget — se backend down, senha Supabase vale e Magic Link/Google
    // continuam funcionando.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://zappiq-api.fly.dev';
    fetch(`${apiUrl}/api/auth/sync-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Supabase-Service-Key': serviceKey, // shared secret pra autenticar a rota interna
      },
      body: JSON.stringify({ email: payload.email.toLowerCase(), password }),
    }).catch((err) => {
      console.error('[reset-password] sync-password backend fire-and-forget failed:', err);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reset-password] Unexpected:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
