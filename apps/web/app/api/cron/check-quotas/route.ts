/**
 * GET /api/cron/check-quotas
 * --------------------------------------------------------------
 * Vercel cron job — roda de hora em hora (vercel.json).
 *
 * Responsabilidade (audit_only mode pra D-Day):
 *   - Lista todas orgs ativas
 *   - Pra cada org: lê tenant_usage_monthly do período corrente (YYYY-MM)
 *   - Calcula % aiMessagesProcessed vs aiMessagesPerMonth do plan
 *   - Se passou threshold 50/80/100 e ainda não notificou:
 *       - INSERT em usage_audit_log (idempotente via unique constraint)
 *       - Dispatch /api/internal/notify-quota fire-and-forget
 *   - audit_only=true (default): NÃO bloqueia — só observa e avisa
 *
 * Segurança:
 *   - Vercel auto-injeta authorization header em cron requests
 *   - Validamos via x-vercel-cron header (presente em prod cron)
 *   - Em dev/manual: aceita CRON_SECRET no header authorization
 *
 * Onda 1 (pós-D-Day) vai adicionar:
 *   - Stripe overage automation (#147)
 *   - Hard ceiling com block real (#148)
 *   - Reconciliação diária (#149)
 *   - Self-service ceiling/autoOverage settings (#148)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Plan limits hardcoded aqui pra evitar dependência do dist do @zappiq/shared.
// Source-of-truth: packages/shared/src/planConfig.ts → PLAN_CONFIG[plan].limits.aiMessagesPerMonth
const PLAN_LIMITS_AI_MESSAGES: Record<string, number> = {
  STARTER: 1000,
  GROWTH: 5000,
  SCALE: 15000,
  BUSINESS: 50000,
  ENTERPRISE: -1, // ilimitado
};

const THRESHOLDS = [50, 80, 100] as const;

function getCurrentPeriodYearMonth(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export async function GET(req: Request) {
  // ─── Auth check ──────────────────────────────────────────────
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  const authorized =
    isVercelCron ||
    (cronSecret && authHeader === `Bearer ${cronSecret}`);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Configuração indisponível' }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, serviceKey);
  const period = getCurrentPeriodYearMonth();
  const baseUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://zappiq.com.br');

  // ─── Fetch orgs ativas ───────────────────────────────────────
  const { data: orgs, error: orgsErr } = await sb
    .from('organizations')
    .select('id, name, plan, "subscriptionStatus", settings')
    .or('subscriptionStatus.eq.active,subscriptionStatus.eq.trialing,subscriptionStatus.is.null');

  if (orgsErr) {
    console.error('[check-quotas] orgs fetch error:', orgsErr);
    return NextResponse.json({ error: 'Falha ao listar orgs' }, { status: 500 });
  }

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ ok: true, period, orgsChecked: 0, alertsTriggered: 0 });
  }

  // ─── Fetch usage do período corrente ─────────────────────────
  const orgIds = orgs.map((o) => o.id as string);
  const { data: usages } = await sb
    .from('tenant_usage_monthly')
    .select('"organizationId", "aiMessagesProcessed"')
    .eq('periodYearMonth', period)
    .in('organizationId', orgIds);

  const usageMap = new Map<string, number>();
  (usages || []).forEach((u: any) => {
    usageMap.set(u.organizationId, parseInt(u.aiMessagesProcessed || 0));
  });

  // ─── Check thresholds por org ────────────────────────────────
  let alertsTriggered = 0;
  const results: Array<Record<string, unknown>> = [];

  for (const org of orgs) {
    const plan = String(org.plan || 'STARTER');
    const limit = PLAN_LIMITS_AI_MESSAGES[plan];
    if (limit === undefined || limit === -1) continue; // unlimited or unknown

    const usage = usageMap.get(org.id as string) || 0;
    const pct = (usage / limit) * 100;

    for (const threshold of THRESHOLDS) {
      if (pct >= threshold) {
        // INSERT idempotente — unique constraint (org, period, threshold) bloqueia duplicado
        const { error: insertErr } = await sb.from('usage_audit_log').insert({
          organization_id: org.id,
          period_year_month: period,
          threshold_pct: threshold,
          current_usage: usage,
          quota_limit: limit,
          audit_only: true,
          action_taken: 'log_only',
          notified_slack: false,
          notified_email: false,
          props: {
            plan,
            org_name: org.name,
            pct_actual: parseFloat(pct.toFixed(2)),
            cron_run_at: new Date().toISOString(),
          },
        });

        if (insertErr) {
          // Unique violation = já notificou esse threshold neste período. Skip silently.
          if (!insertErr.message?.includes('duplicate') && !insertErr.code?.includes('23505')) {
            console.error('[check-quotas] insert error:', insertErr);
          }
          continue;
        }

        // Disparou nova entry — dispatch Slack notify fire-and-forget
        alertsTriggered++;
        results.push({
          org: org.name,
          plan,
          threshold,
          usage,
          limit,
          pct: parseFloat(pct.toFixed(2)),
        });

        fetch(`${baseUrl}/api/internal/notify-quota`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_id: org.id,
            org_name: org.name,
            plan,
            threshold_pct: threshold,
            current_usage: usage,
            quota_limit: limit,
            period,
          }),
        }).catch((err) => {
          console.error('[check-quotas] notify-quota fire failed:', err);
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    period,
    orgsChecked: orgs.length,
    alertsTriggered,
    results,
  });
}
