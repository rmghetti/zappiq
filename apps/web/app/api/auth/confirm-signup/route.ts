/**
 * POST /api/auth/confirm-signup
 * --------------------------------------------------------------
 * Recebe tokens do hash da URL (Supabase implicit flow) após user
 * clicar no magic link de confirm signup. Decodifica access_token JWT,
 * extrai user_id + email, e atualiza tabela signups.status='active'.
 *
 * Não valida token (Supabase já validou). Apenas atualiza signup state.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface Body {
  access_token: string;
  refresh_token?: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  user_metadata?: {
    plan_chosen?: string;
    name?: string;
  };
  exp?: number;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Base64URL decode (Node.js Buffer)
    const decoded = Buffer.from(
      payload.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
    return JSON.parse(decoded) as JwtPayload;
  } catch (err) {
    console.error('[confirm-signup] JWT decode error:', err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body.access_token) {
      return NextResponse.json({ error: 'access_token obrigatório' }, { status: 400 });
    }

    const payload = decodeJwtPayload(body.access_token);
    if (!payload || !payload.sub || !payload.email) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }

    // Sanity: token expirado
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return NextResponse.json({ error: 'Token expirado' }, { status: 401 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Configuração indisponível' }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // Atualiza signup status com user_id e confirmed_at
    const { error: updateErr } = await sb
      .from('signups')
      .update({
        status: 'active',
        supabase_user_id: payload.sub,
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('email', payload.email.toLowerCase());

    if (updateErr) {
      console.error('[confirm-signup] Update error:', updateErr);
      // Não bloqueia — user já está autenticado no Supabase
      return NextResponse.json({
        ok: true,
        warning: 'Sessão criada mas signup record não atualizado.',
      });
    }

    return NextResponse.json({
      ok: true,
      user_id: payload.sub,
      email: payload.email,
      plan_chosen: payload.user_metadata?.plan_chosen,
    });
  } catch (err) {
    console.error('[confirm-signup] Unexpected error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
