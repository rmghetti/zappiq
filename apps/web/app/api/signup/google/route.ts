/**
 * POST /api/signup/google
 * --------------------------------------------------------------
 * Inicia OAuth Google via Supabase Auth e devolve a URL de redirect.
 *
 * A242 (14/09/2026): o plano escolhido é GRAVADO ANTES do redirecionamento.
 *
 * O desenho anterior confiava no parâmetro `plan` da URL de callback. Medido
 * em produção: oito eventos signup_oauth_started com plan=IZA_LITE (23/07,
 * 11/08, 20/08 e 02/09) e todas as linhas correspondentes em `signups`
 * gravadas como GROWTH. O lead escolhia o plano de entrada e a conta nascia
 * num plano que ele não pediu.
 *
 * Agora são três redes, nesta ordem:
 *   1. a linha em `signups` já sai daqui com plan_chosen certo (quando o
 *      lead digitou o e-mail no formulário, que é o caso comum);
 *   2. um cookie HttpOnly SameSite=Lax com a escolha, que sobrevive ao
 *      round-trip do Google e serve para quem clicou sem digitar e-mail;
 *   3. o parâmetro da URL, que continua existindo como última tentativa.
 *
 * O /auth/callback passa a só CONFIRMAR: ele nunca sobrescreve um
 * plan_chosen que já está gravado.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isSelfSignupPlan, type PlanId } from '@zappiq/shared';
import {
  COOKIE_PLANO_ESCOLHIDO,
  COOKIE_MAX_AGE_SEGUNDOS,
} from '../../../../lib/signupPlanCookie';

// PR #105 — Helper pra resolver baseUrl do redirectTo.
// Em prod: hardcoded zappiq.com.br (custom domain, sem Vercel Auth).
// Em preview: deriva do host do request.
function getBaseUrl(req: Request): string {
  if (process.env.VERCEL_ENV === 'production') {
    return 'https://zappiq.com.br';
  }
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

// Não exportado de propósito: o Next só aceita os handlers HTTP e a
// configuração de rota como exports de um route.ts.
/** E-mail em minúsculas, ou null quando não é e-mail. Não lança. */
function normalizarEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { plan: PlanId; email?: string; name?: string };
    const plan = body.plan;

    if (!isSelfSignupPlan(plan)) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Configuração indisponível' }, { status: 500 });
    }

    // ── 1. Grava a escolha do plano ANTES de sair do nosso domínio ──
    // Best-effort de propósito: se o banco estiver fora, o lead ainda
    // consegue entrar pelo Google (o cookie leva a escolha adiante).
    const email = normalizarEmail(body.email);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (email && serviceKey) {
      try {
        const sbAdmin = createClient(supabaseUrl, serviceKey);
        const { data: existing } = await sbAdmin
          .from('signups')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        const agora = new Date().toISOString();
        if (existing?.id) {
          await sbAdmin
            .from('signups')
            .update({ plan_chosen: plan, updated_at: agora })
            .eq('id', existing.id);
        } else {
          const nome = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
          await sbAdmin.from('signups').insert({
            email,
            name: nome || email.split('@')[0],
            plan_chosen: plan,
            // Estado próprio: o lead escolheu o plano e foi para o Google,
            // mas ainda não voltou. O callback é quem confirma.
            status: 'pending_oauth',
            meta: { source: 'oauth_google_intent' },
          });
        }
      } catch (err) {
        console.error('[signup/google] grava plano antes do redirect falhou:', err);
      }
    }

    const sb = createClient(supabaseUrl, anonKey);

    // PR #105 — em prod SEMPRE zappiq.com.br (custom domain sem Vercel Auth).
    const baseUrl = getBaseUrl(req);

    // plan segue no query param como TERCEIRA rede. As duas primeiras (linha
    // em signups e cookie) é que carregam a escolha de verdade.
    const next = encodeURIComponent(`/cadastro?verified=1&plan=${plan}`);
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${baseUrl}/auth/callback?next=${next}&plan=${plan}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error || !data.url) {
      return NextResponse.json({ error: error?.message || 'Falha OAuth' }, { status: 500 });
    }

    const res = NextResponse.json({ url: data.url });
    // ── 2. Cookie: a escolha volta com o lead mesmo sem e-mail digitado ──
    // SameSite=Lax é obrigatório aqui: o retorno do Google é uma navegação
    // de topo vinda de outro site, e 'Strict' não mandaria o cookie.
    res.cookies.set(COOKIE_PLANO_ESCOLHIDO, plan, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE_SEGUNDOS,
    });
    return res;
  } catch (err) {
    console.error('[signup/google] Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
