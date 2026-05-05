/**
 * POST /api/analytics
 * --------------------------------------------------------------
 * Endpoint pra inserir eventos em analytics_events.
 * Chamado client-side via lib/analytics.ts track().
 *
 * Não bloqueia (fire-and-forget). Se Supabase falhar, retorna ok
 * pra não atrapalhar UX.
 *
 * LGPD: NÃO armazenamos IP cru — só headers úteis (UA, referrer).
 *
 * Eventos esperados:
 *  - cadastro_view
 *  - signup_step_1_submit  (props: {plan, hasCnpj, hasCompany})
 *  - signup_email_link_sent  (props: {plan})
 *  - signup_email_confirmed  (props: {provider:'email'})
 *  - signup_oauth_started  (props: {provider:'google', plan})
 *  - signup_oauth_completed  (props: {provider:'google'})
 *  - signup_path_chosen  (props: {path:'assistido'|'self_service'})
 *  - landing_view
 *  - landing_cta_click  (props: {cta_id})
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface AnalyticsBody {
  event_name: string;
  props?: Record<string, unknown>;
  session_id?: string;
  user_email?: string;
  page_url?: string;
}

const VALID_EVENT_REGEX = /^[a-z][a-z0-9_]{2,63}$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalyticsBody;

    if (!body.event_name || !VALID_EVENT_REGEX.test(body.event_name)) {
      return NextResponse.json({ ok: true, skipped: 'invalid_event_name' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      // Não bloqueia — analytics é fire-and-forget
      return NextResponse.json({ ok: true, skipped: 'no_config' });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    const userAgent = req.headers.get('user-agent') || null;
    const referrer = req.headers.get('referer') || null;

    // Sanitiza props (max 50 keys, max 1KB string values)
    const safeProps: Record<string, unknown> = {};
    if (body.props && typeof body.props === 'object') {
      const entries = Object.entries(body.props).slice(0, 50);
      for (const [k, v] of entries) {
        if (typeof v === 'string') {
          safeProps[k] = v.slice(0, 1024);
        } else if (typeof v === 'number' || typeof v === 'boolean' || v === null) {
          safeProps[k] = v;
        }
      }
    }

    const { error } = await sb.from('analytics_events').insert({
      event_name: body.event_name,
      props: safeProps,
      session_id: body.session_id?.slice(0, 64) || null,
      user_email: body.user_email?.slice(0, 254) || null,
      user_agent: userAgent?.slice(0, 512),
      referrer: referrer?.slice(0, 1024),
      page_url: body.page_url?.slice(0, 1024) || null,
    });

    if (error) {
      console.error('[analytics] Insert error:', error);
      return NextResponse.json({ ok: true, warning: 'insert_failed' });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[analytics] Unexpected error:', err);
    return NextResponse.json({ ok: true, warning: 'caught_error' });
  }
}
