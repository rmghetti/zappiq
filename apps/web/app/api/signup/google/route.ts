/**
 * POST /api/signup/google
 * --------------------------------------------------------------
 * Inicia OAuth Google via Supabase Auth.
 * Retorna URL de redirect pra começar fluxo OAuth.
 * Plano selecionado é passado via state param.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isSelfSignupPlan, type PlanId } from '@zappiq/shared';

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

export async function POST(req: Request) {
  try {
    const { plan } = (await req.json()) as { plan: PlanId };

    if (!isSelfSignupPlan(plan)) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Configuração indisponível' }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, anonKey);

    // PR #105 — em prod SEMPRE zappiq.com.br (custom domain sem Vercel Auth).
    const baseUrl = getBaseUrl(req);

    // plan vai como query param TOP-LEVEL (não só dentro de next) pra
    // /auth/callback ler facilmente e usar no UPSERT do signups row.
    // (PR #90 hotfix Google OAuth signup creation)
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

    return NextResponse.json({ url: data.url });
  } catch (err) {
    console.error('[signup/google] Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
