/**
 * POST /api/internal/notify-quota
 * --------------------------------------------------------------
 * Slack alert quando org passa threshold de quota.
 * Chamado fire-and-forget pelo /api/cron/check-quotas.
 *
 * Env var: SLACK_QUOTA_WEBHOOK_URL (incoming webhook do Slack)
 *   - Se não setado: log only (no-op gracioso)
 *
 * audit_only mode: alertas tem mensagem informativa
 *   ("Org X atingiu 80% — sem ação automática, audit_only=true")
 *
 * Threshold 100% prefixa "🚨 *CRÍTICO*" — sinaliza pra comercial
 * abordar cliente proativamente (oferta de upgrade ou Voice add-on).
 */

import { NextResponse } from 'next/server';

interface NotifyBody {
  org_id: string;
  org_name: string;
  plan: string;
  threshold_pct: number;
  current_usage: number;
  quota_limit: number;
  period: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as NotifyBody;

    if (!body.org_id || !body.threshold_pct) {
      return NextResponse.json({ ok: true, skipped: 'missing_fields' });
    }

    const webhookUrl = process.env.SLACK_QUOTA_WEBHOOK_URL;
    if (!webhookUrl) {
      console.log('[notify-quota] No webhook configured. Logged only:', {
        org: body.org_name,
        plan: body.plan,
        threshold: body.threshold_pct,
        usage: body.current_usage,
        limit: body.quota_limit,
      });
      return NextResponse.json({ ok: true, skipped: 'no_webhook' });
    }

    const isCritical = body.threshold_pct >= 100;
    const isWarning = body.threshold_pct >= 80;
    const prefix = isCritical
      ? '🚨 *CRÍTICO* — '
      : isWarning
      ? '⚠️ *Atenção* — '
      : 'ℹ️ ';
    const pct = ((body.current_usage / body.quota_limit) * 100).toFixed(1);

    const blocks: Array<Record<string, unknown>> = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${prefix}Quota alert · *${body.org_name}* atingiu *${body.threshold_pct}%*`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Org:*\n${body.org_name}` },
          { type: 'mrkdwn', text: `*Plan:*\n${body.plan}` },
          { type: 'mrkdwn', text: `*Uso atual:*\n${body.current_usage.toLocaleString('pt-BR')} msgs` },
          { type: 'mrkdwn', text: `*Limite:*\n${body.quota_limit.toLocaleString('pt-BR')} msgs` },
          { type: 'mrkdwn', text: `*Atual:*\n${pct}%` },
          { type: 'mrkdwn', text: `*Período:*\n${body.period}` },
        ],
      },
    ];

    if (isCritical) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '⏱️ *Ação recomendada:* Comercial abordar cliente em <2h pra ofertar upgrade. Audit_only=true (sem bloqueio automático).',
        },
      });
    } else if (isWarning) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '💡 Cliente em ramp-up. Considere reach-out proativo do CSM.',
        },
      });
    }

    const slackPayload = {
      text: `${prefix}${body.org_name} atingiu ${body.threshold_pct}% (${pct}% real)`,
      blocks,
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    if (!res.ok) {
      console.error('[notify-quota] Slack webhook failed:', res.status);
      return NextResponse.json({ ok: true, warning: 'slack_failed' });
    }

    return NextResponse.json({ ok: true, threshold: body.threshold_pct, critical: isCritical });
  } catch (err) {
    console.error('[notify-quota] Unexpected error:', err);
    return NextResponse.json({ ok: true, warning: 'caught_error' });
  }
}
