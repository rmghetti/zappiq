/**
 * GET /auth/callback
 * --------------------------------------------------------------
 * Callback handler para Magic Link e OAuth Google.
 * Troca código de auth por sessão Supabase, atualiza signups.status='active',
 * redireciona pro próximo passo (default: /cadastro?verified=1).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/cadastro?verified=1';

  if (!code) {
    return NextResponse.redirect(new URL('/cadastro?error=missing_code', url.origin));
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return NextResponse.redirect(new URL('/cadastro?error=config', url.origin));
  }

  const sb = createClient(supabaseUrl, anonKey);
  const { data, error } = await sb.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error('[auth/callback] Exchange error:', error);
    return NextResponse.redirect(new URL('/cadastro?error=auth_failed', url.origin));
  }

  // Atualiza signup status com service role
  try {
    const sbAdmin = createClient(supabaseUrl, serviceKey);
    await sbAdmin
      .from('signups')
      .update({
        status: 'active',
        supabase_user_id: data.user.id,
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('email', data.user.email);
  } catch (err) {
    console.error('[auth/callback] Signup update error:', err);
    // Não bloqueia — usuário ainda está autenticado
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
