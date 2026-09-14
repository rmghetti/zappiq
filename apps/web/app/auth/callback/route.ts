/**
 * GET /auth/callback
 * --------------------------------------------------------------
 * Callback handler para OAuth Google (PKCE flow).
 * Troca code por sessão Supabase, cria/atualiza signup row,
 * redireciona pro próximo passo (default: /cadastro?verified=1).
 *
 * UPSERT do signup row (PR #90 hotfix):
 * - Magic Link cria row em /api/signup ANTES do email; callback só atualiza
 * - Google OAuth NÃO cria row antes; callback precisa criar com defaults
 *
 * Por isso fazemos SELECT + INSERT/UPDATE em vez de UPDATE direto.
 *
 * A242 (14/09/2026) — aqui o callback só CONFIRMA.
 *   Quem grava o plano escolhido é /api/signup/google, antes do
 *   redirecionamento. Este handler nunca sobrescreve um plan_chosen que já
 *   existe: era assim que a escolha do Lite virava GROWTH.
 *   Quando não há linha nenhuma (lead que clicou no Google sem digitar
 *   e-mail), a escolha é recuperada do cookie e, só depois, do parâmetro da
 *   URL. O último recurso é o plano de ENTRADA, não um plano mais caro.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isSelfSignupPlan, type PlanId } from '@zappiq/shared';
import { COOKIE_PLANO_ESCOLHIDO } from '../../api/signup/google/route.js';

/** Plano do cookie HttpOnly gravado em /api/signup/google. */
export function planoDoCookie(req: Request): PlanId | null {
  const bruto = req.headers.get('cookie') || '';
  const par = bruto
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${COOKIE_PLANO_ESCOLHIDO}=`));
  if (!par) return null;
  const valor = decodeURIComponent(par.slice(COOKIE_PLANO_ESCOLHIDO.length + 1));
  return isSelfSignupPlan(valor) ? valor : null;
}

/**
 * Plano do lead que chega pelo Google sem linha em `signups`.
 * Ordem: cookie (gravado por nós) → parâmetro da URL → plano de entrada.
 */
export function resolverPlanoDoOAuth(
  doCookie: string | null,
  daUrl: string | null,
): PlanId {
  if (isSelfSignupPlan(doCookie)) return doCookie;
  if (isSelfSignupPlan(daUrl)) return daUrl;
  return 'IZA_LITE';
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  // PR #101 (Onda 2A), P0 #2 Signup duplicado: callback redirect direto
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
      // A linha já existe (Magic Link, ou o intent gravado em
      // /api/signup/google). Este handler SÓ confirma: plan_chosen não
      // entra no UPDATE de propósito, para nunca apagar a escolha do lead.
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
      // Google OAuth sem e-mail digitado no formulário: a linha não existe.
      // A escolha vem do cookie que nós gravamos; a URL é a terceira rede.
      const plan: PlanId = resolverPlanoDoOAuth(planoDoCookie(req), planParam);

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
    // Não bloqueia, usuário ainda está autenticado em auth.users
  }

  // PR #101.2: Pré-popular dados do user em /onboarding pra evitar
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

  const resposta = NextResponse.redirect(redirectUrl);
  // O cookie já cumpriu o papel dele. Deixá-lo vivo faria um cadastro
  // seguinte, na mesma máquina, herdar o plano de quem passou antes.
  resposta.cookies.set(COOKIE_PLANO_ESCOLHIDO, '', { path: '/', maxAge: 0 });
  return resposta;
}
