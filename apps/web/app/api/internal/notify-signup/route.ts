/**
 * POST /api/internal/notify-signup
 * --------------------------------------------------------------
 * Dispara Slack webhook quando há novo signup confirmado.
 * Chamado fire-and-forget pelo /api/auth/confirm-signup.
 *
 * Env var: SLACK_SIGNUPS_WEBHOOK_URL (incoming webhook)
 *   - Se não setado: no-op (log only)
 *   - Se setado: POSTs payload Slack
 *
 * Mensagem default:
 *   🎉 Novo signup ZappIQ!
 *   • [Nome] · [email]
 *   • Plan: GROWTH · Source: linkedin_organic
 *   • Provider: Magic Link
 *   • Trial até: 19/05
 *
 * Plan=BUSINESS prefixa "🚨 VIP — " (signal urgência ao comercial).
 *
 * Conversion golden hour: comercial deve abordar signup BUSINESS em <5 min.
 */

import { NextResponse } from 'next/server';

interface NotifyBody {
  email: string;
  name?: string | null;
  plan: string;
  provider: 'email' | 'google' | string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  trial_ends_at?: string | null;
  source_meta?: string | null;
}

const VIP_PLANS = ['BUSINESS', 'ENTERPRISE'];

function fmtDateBR(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as NotifyBody;

    if (!body.email || !body.plan) {
      return NextResponse.json({ ok: true, skipped: 'missing_fields' });
    }

    const webhookUrl = process.env.SLACK_SIGNUPS_WEBHOOK_URL;
    if (!webhookUrl) {
      console.log('[notify-signup] No webhook configured. Logged only:', {
        email: body.email,
        plan: body.plan,
        provider: body.provider,
        utm_source: body.utm_source,
      });
      return NextResponse.json({ ok: true, skipped: 'no_webhook' });
    }

    const isVip = VIP_PLANS.includes(body.plan.toUpperCase());
    const prefix = isVip ? '🚨 *VIP* — ' : '🎉 ';
    const providerLabel = body.provider === 'google' ? 'Google OAuth' : 'Magic Link';
    const sourceLabel = body.utm_source || 'organic/direct';

    const blocks: Array<Record<string, unknown>> = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${prefix}*Novo signup ZappIQ!*`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Nome:*\n${body.name || '—'}` },
          { type: 'mrkdwn', text: `*Email:*\n${body.email}` },
          { type: 'mrkdwn', text: `*Plan:*\n${body.plan}` },
          { type: 'mrkdwn', text: `*Provider:*\n${providerLabel}` },
          { type: 'mrkdwn', text: `*Source:*\n${sourceLabel}` },
          { type: 'mrkdwn', text: `*Trial até:*\n${fmtDateBR(body.trial_ends_at)}` },
        ],
      },
    ];

    if (isVip) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '⏱️ *Golden hour:* Comercial responder em <5 min pra maximizar conversão.',
        },
      });
    }

    const slackPayload = {
      text: `${prefix}Novo signup ZappIQ — ${body.name || body.email} · ${body.plan}`,
      blocks,
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    if (!res.ok) {
      console.error('[notify-signup] Slack webhook failed:', res.status, await res.text());
      return NextResponse.json({ ok: true, warning: 'slack_failed' });
    }

    return NextResponse.json({ ok: true, vip: isVip });
  } catch (err) {
    console.error('[notify-signup] Unexpected error:', err);
    return NextResponse.json({ ok: true, warning: 'caught_error' });
  }
}
