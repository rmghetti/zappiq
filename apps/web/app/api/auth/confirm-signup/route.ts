/**
 * POST /api/auth/confirm-signup
 * --------------------------------------------------------------
 * Recebe tokens do hash da URL (Supabase implicit flow) após user
 * clicar no magic link de confirm signup OU completar OAuth Google.
 * Decodifica access_token JWT, extrai user_id + email + provider,
 * e faz UPSERT em signups:
 *   - Magic Link path: row já existe → atualiza status='active'
 *   - OAuth Google path: row não existe → INSERT com defaults
 *
 * Não valida token (Supabase já validou). Apenas atualiza signup state.
 *
 * PR #91: UPSERT path pra cobrir OAuth (Google sem signup row pré-criado).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { PlanId } from '@zappiq/shared';

const VALID_PLANS: PlanId[] = ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS'];

interface Body {
  access_token: string;
  refresh_token?: string;
  // Plan opcional — Cadastro.tsx pode passar pra OAuth (vem da query string)
  plan?: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  user_metadata?: {
    plan_chosen?: string;
    name?: string;
    full_name?: string;
    avatar_url?: string;
    provider_id?: string;
  };
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
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
    const email = payload.email.toLowerCase();
    const provider = payload.app_metadata?.provider || 'email';
    const isOAuth = provider !== 'email';

    // ─── UPSERT signup row (PR #91) ──────────────────────────────
    const { data: existing } = await sb
      .from('signups')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    const now = new Date();

    if (existing) {
      // Magic Link path: row já existe, só atualiza status
      const { error: updateErr } = await sb
        .from('signups')
        .update({
          status: 'active',
          supabase_user_id: payload.sub,
          confirmed_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', existing.id);

      if (updateErr) {
        console.error('[confirm-signup] Update error:', updateErr);
        return NextResponse.json({
          ok: true,
          warning: 'Sessão criada mas signup record não atualizado.',
        });
      }
    } else {
      // OAuth path (ou edge case Magic Link sem row): INSERT com defaults
      const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const meta = payload.user_metadata || {};
      const planFromBody = body.plan;
      const plan: PlanId =
        planFromBody && VALID_PLANS.includes(planFromBody as PlanId)
          ? (planFromBody as PlanId)
          : meta.plan_chosen && VALID_PLANS.includes(meta.plan_chosen as PlanId)
          ? (meta.plan_chosen as PlanId)
          : 'GROWTH';

      const name = meta.full_name || meta.name || email.split('@')[0];

      const { error: insertErr } = await sb.from('signups').insert({
        email,
        name,
        plan_chosen: plan,
        status: 'active',
        supabase_user_id: payload.sub,
        confirmed_at: now.toISOString(),
        trial_starts_at: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
        card_required_at: trialEnds.toISOString(),
        meta: {
          source: isOAuth ? `oauth_${provider}` : 'magiclink_implicit',
          provider,
          google_avatar_url: meta.avatar_url || null,
          google_provider_id: meta.provider_id || null,
        },
      });

      if (insertErr) {
        console.error('[confirm-signup] Insert error:', insertErr);
        return NextResponse.json({
          ok: true,
          warning: 'Sessão criada mas signup record não inserido.',
        });
      }
    }

    return NextResponse.json({
      ok: true,
      user_id: payload.sub,
      email: payload.email,
      provider,
      plan_chosen: payload.user_metadata?.plan_chosen,
    });
  } catch (err) {
    console.error('[confirm-signup] Unexpected error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
