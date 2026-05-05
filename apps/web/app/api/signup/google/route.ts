/**
 * POST /api/signup/google
 * --------------------------------------------------------------
 * Inicia OAuth Google via Supabase Auth.
 * Retorna URL de redirect pra começar fluxo OAuth.
 * Plano selecionado é passado via state param.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { PlanId } from '@zappiq/shared';

const VALID_PLANS: PlanId[] = ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS'];

export async function POST(req: Request) {
  try {
    const { plan } = (await req.json()) as { plan: PlanId };

    if (!VALID_PLANS.includes(plan)) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Configuração indisponível' }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, anonKey);

    const baseUrl =
      process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://zappiq.com.br');

    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${baseUrl}/auth/callback?next=/cadastro?verified=1&plan=${plan}`,
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
