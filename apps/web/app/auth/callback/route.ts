/**
 * GET /auth/callback
 * --------------------------------------------------------------
 * Callback handler para OAuth Google (PKCE flow).
 * Troca code por sessão Supabase, cria/atualiza signup row,
 * redireciona pro próximo passo (default: /cadastro?verified=1).
 *
 * UPSERT do signup row (PR #90 hotfix):
 * - Magic Link cria row em /api/signup ANTES do email — callback só atualiza
 * - Google OAuth NÃO cria row antes — callback precisa criar com defaults
 *
 * Por isso fazemos SELECT + INSERT/UPDATE em vez de UPDATE direto.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isSelfSignupPlan, type PlanId } from '@zappiq/shared';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  // PR #101 (Onda 2A) — P0 #2 Signup duplicado: callback redirect direto
  // pra /onboarding (não mais /cadastro?verified=1 que mandava pra /register).
  const next = url.searchParams.get('next') || '/onboarding?step=0&from=auth_callback';
  const planParam = url.searchParams.get('plan');

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

  if (error || !data.user || !data.user.email) {
    console.error('[auth/callback] Exchange error:', error);
    return NextResponse.redirect(new URL('/cadastro?error=auth_failed', url.origin));
  }

  // ─── UPSERT signup row ─────────────────────────────────────────
  try {
    const sbAdmin = createClient(supabaseUrl, serviceKey);
    const email = data.user.email.toLowerCase();
    const now = new Date();
    const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const { data: existing } = await sbAdmin
      .from('signups')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      // Magic Link path: row já existe, só atualiza confirmação
      await sbAdmin
        .from('signups')
        .update({
          status: 'active',
          supabase_user_id: data.user.id,
          confirmed_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Google OAuth path: row não existe, cria com defaults
      const plan: PlanId = isSelfSignupPlan(planParam) ? planParam : 'GROWTH';

      const meta = data.user.user_metadata || {};
      const name =
        (meta.full_name as string | undefined) ||
        (meta.name as string | undefined) ||
        email.split('@')[0];

      await sbAdmin.from('signups').insert({
        email,
        name,
        plan_chosen: plan,
        status: 'active',
        supabase_user_id: data.user.id,
        confirmed_at: now.toISOString(),
        trial_starts_at: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
        card_required_at: trialEnds.toISOString(),
        meta: {
          source: 'oauth_google',
          google_avatar_url: meta.avatar_url || null,
          google_provider_id: meta.provider_id || null,
        },
      });
    }
  } catch (err) {
    console.error('[auth/callback] Signup upsert error:', err);
    // Não bloqueia — usuário ainda está autenticado em auth.users
  }

  // PR #101.2 — Pré-popular dados do user em /onboarding pra evitar
  // pedir email/senha de novo (P0 #2 Signup Duplicado).
  // Email e name vão por query string (email não é segredo + name é público).
  const meta = data.user.user_metadata || {};
  const fullName =
    (meta.full_name as string | undefined) ||
    (meta.name as string | undefined) ||
    data.user.email.split('@')[0];

  const redirectUrl = new URL(next, url.origin);
  // Só anexa se a URL ainda não tiver email/name (preserva customizações)
  if (!redirectUrl.searchParams.has('email')) {
    redirectUrl.searchParams.set('email', data.user.email.toLowerCase());
  }
  if (!redirectUrl.searchParams.has('name')) {
    redirectUrl.searchParams.set('name', fullName);
  }

  return NextResponse.redirect(redirectUrl);
}
