/**
 * POST /api/signup
 * --------------------------------------------------------------
 * Cria registro em `signups` table + envia magic link via Supabase Auth.
 * Trial 14 dias. Cartão exigido em D+14 (handler separado, cron job).
 *
 * Decisões aplicadas:
 *   - Magic Link Supabase Auth (não usa senha)
 *   - CNPJ opcional (NULL aceito)
 *   - Tabela signups separada de early_access_leads
 *   - Plano default Growth (validado server-side)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isSelfSignupPlan, type PlanId } from '@zappiq/shared';

interface SignupBody {
  name: string;
  email: string;
  plan: PlanId;
  cnpj?: string | null;
  company?: string | null;
  // UTM attribution first-touch (PR #94)
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SignupBody;

    // ─── Validação ──────────────────────────────────────────────
    if (!body.email || !body.name) {
      return NextResponse.json({ error: 'Nome e e-mail são obrigatórios' }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 });
    }
    if (body.name.trim().length < 2) {
      return NextResponse.json({ error: 'Nome muito curto' }, { status: 400 });
    }
    if (body.plan === 'ENTERPRISE') {
      return NextResponse.json(
        { error: 'Plano Enterprise é por contato comercial. Acesse /enterprise.' },
        { status: 400 }
      );
    }
    if (!isSelfSignupPlan(body.plan)) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 });
    }

    // ─── Supabase admin client (server-side) ────────────────────
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error('[signup] Missing Supabase env vars');
      return NextResponse.json({ error: 'Configuração indisponível' }, { status: 500 });
    }
    const sb = createClient(supabaseUrl, serviceKey);

    const email = body.email.trim().toLowerCase();
    const name = body.name.trim();

    // ─── Idempotência: verifica se já existe signup ativo ──────
    const { data: existing } = await sb
      .from('signups')
      .select('id, status, trial_ends_at')
      .eq('email', email)
      .maybeSingle();

    if (existing && existing.status === 'paid') {
      return NextResponse.json(
        { error: 'Este e-mail já tem conta ativa. Use /login.' },
        { status: 409 }
      );
    }

    // ─── Cria ou atualiza signup ───────────────────────────────
    const now = new Date();
    const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    if (existing) {
      // Atualiza signup pendente
      await sb
        .from('signups')
        .update({
          name,
          plan_chosen: body.plan,
          cnpj: body.cnpj || null,
          company: body.company || null,
          trial_starts_at: now.toISOString(),
          trial_ends_at: trialEnds.toISOString(),
          card_required_at: trialEnds.toISOString(),
          status: 'pending_email',
          updated_at: now.toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Cria signup novo
      const { error: insertErr } = await sb.from('signups').insert({
        email,
        name,
        plan_chosen: body.plan,
        cnpj: body.cnpj || null,
        company: body.company || null,
        trial_starts_at: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
        card_required_at: trialEnds.toISOString(),
        status: 'pending_email',
        // UTM first-touch (PR #94) — só persiste no INSERT, nunca sobrescreve
        utm_source: body.utm_source?.slice(0, 100) || null,
        utm_medium: body.utm_medium?.slice(0, 100) || null,
        utm_campaign: body.utm_campaign?.slice(0, 100) || null,
        meta: {
          source: 'web_signup',
          user_agent: req.headers.get('user-agent') || null,
        },
      });
      if (insertErr) {
        console.error('[signup] Insert error:', insertErr);
        return NextResponse.json({ error: 'Erro ao registrar cadastro' }, { status: 500 });
      }
    }

    // ─── Magic link via Supabase Auth ──────────────────────────
    // HOTFIX 2026-05-19 — VERCEL_URL retorna o hash do deployment preview
    // (ex: zappiq-2wu98gc9u-zappiq.vercel.app), o que faz o magic link
    // apontar pra preview com Deployment Protection -> cliente recebe
    // "Email link is invalid or has expired". Em prod SEMPRE custom domain.
    const baseUrl =
      process.env.VERCEL_ENV === 'production'
        ? 'https://zappiq.com.br'
        : (process.env.APP_URL || `${new URL(req.url).protocol}//${new URL(req.url).host}`);

    // emailRedirectTo aponta DIRETO pra /cadastro?verified=1 porque
    // Supabase Confirm Signup usa implicit flow com tokens no HASH
    // (#access_token=...&refresh_token=...), não PKCE com ?code=.
    // O componente Cadastro.tsx detecta o hash client-side e processa.
    const { error: otpErr } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${baseUrl}/cadastro?verified=1`,
        data: {
          name,
          plan_chosen: body.plan,
          source: 'cadastro_wizard',
        },
      },
    });

    if (otpErr) {
      console.error('[signup] Magic link error:', otpErr);
      // Não falha o signup — registro foi criado, lead pode reenviar
      return NextResponse.json({
        ok: true,
        warning: 'Cadastro registrado mas e-mail pode demorar. Verifique caixa em 1-2 min.',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[signup] Unexpected error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
