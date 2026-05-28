/**
 * POST /api/leads — Early Access lead capture (V5.3 pre-launch)
 * --------------------------------------------------------------
 * Endpoint público pra captura de leads do form Fundadores na pagina de
 * pre-lancamento da ZappIQ.
 *
 * Fluxo:
 *   1. Valida payload (email obrigatorio).
 *   2. Insere row na public.early_access_leads via Supabase REST (service_role).
 *   3. Dispara email pra rodrigo.ghetti@zappiq.com.br via Resend (fire-and-forget).
 *   4. Retorna { ok: true } ou { ok: false, error }.
 *
 * Tabela: criada via SQL no Supabase Dashboard (early_access_leads.sql).
 *
 * Anti-spam mínimo: rate limit em memória por IP (5 req/min). Pra produção
 * de verdade trocar pra Upstash/Redis. Suficiente pro periodo de 8 dias.
 *
 * Env vars esperadas:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY                 (opcional — log warn se ausente)
 *   LEADS_FROM_EMAIL               (default: marketing@zappiq.com.br)
 *   LEADS_NOTIFY_EMAIL             (default: rodrigo.ghetti@zappiq.com.br)
 */
import { NextRequest, NextResponse } from 'next/server';

interface LeadPayload {
  email: string;
  source?: string;
  ts?: string;
  name?: string;
  company?: string;
  volume?: string;
}

// ─── Rate limiter em memória (best-effort) ──────────────────────────────
const RATE_BUCKET = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): { ok: boolean; remaining: number } {
  const now = Date.now();
  const bucket = RATE_BUCKET.get(ip);
  if (!bucket || bucket.reset < now) {
    RATE_BUCKET.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    return { ok: true, remaining: RATE_LIMIT - 1 };
  }
  if (bucket.count >= RATE_LIMIT) {
    return { ok: false, remaining: 0 };
  }
  bucket.count += 1;
  return { ok: true, remaining: RATE_LIMIT - bucket.count };
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

// ─── Validação ──────────────────────────────────────────────────────────
function validate(body: unknown): { ok: true; data: LeadPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Payload inválido' };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.email !== 'string' || !b.email.trim()) {
    return { ok: false, error: 'E-mail obrigatório' };
  }
  const email = b.email.trim().toLowerCase();
  if (!/.+@.+\..+/.test(email)) {
    return { ok: false, error: 'E-mail inválido' };
  }
  if (email.length > 200) {
    return { ok: false, error: 'E-mail muito longo' };
  }
  return {
    ok: true,
    data: {
      email,
      source: typeof b.source === 'string' ? b.source.slice(0, 64) : 'prelaunch_v53',
      ts: typeof b.ts === 'string' ? b.ts : new Date().toISOString(),
      name: typeof b.name === 'string' ? b.name.trim().slice(0, 200) : undefined,
      company: typeof b.company === 'string' ? b.company.trim().slice(0, 200) : undefined,
      volume: typeof b.volume === 'string' ? b.volume.trim().slice(0, 64) : undefined,
    },
  };
}

// ─── Supabase insert ────────────────────────────────────────────────────
async function insertLead(payload: LeadPayload, meta: { ip: string; ua: string }): Promise<{ ok: boolean; error?: string; duplicate?: boolean }> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('[leads] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes');
    return { ok: false, error: 'Backend indisponível' };
  }

  const record = {
    email: payload.email,
    name: payload.name ?? null,
    company: payload.company ?? null,
    volume: payload.volume ?? null,
    source: payload.source ?? 'prelaunch_v53',
    ip: meta.ip,
    user_agent: meta.ua.slice(0, 500),
  };

  try {
    const res = await fetch(`${url}/rest/v1/early_access_leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify(record),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // 23505 = unique_violation (email já cadastrado)
      if (res.status === 409 || text.includes('23505')) {
        return { ok: true, duplicate: true };
      }
      console.error('[leads] Supabase insert falhou', res.status, text);
      return { ok: false, error: 'Falha ao registrar' };
    }

    return { ok: true };
  } catch (err) {
    console.error('[leads] Supabase insert exception', err);
    return { ok: false, error: 'Falha de rede' };
  }
}

// ─── Resend email (fire-and-forget) ─────────────────────────────────────
async function notifyByEmail(payload: LeadPayload, meta: { ip: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.LEADS_FROM_EMAIL || 'marketing@zappiq.com.br';
  const to = process.env.LEADS_NOTIFY_EMAIL || 'rodrigo.ghetti@zappiq.com.br';

  if (!key) {
    console.warn('[leads] RESEND_API_KEY ausente — pulando notificação por email');
    return;
  }

  const html = `
    <h2>Novo lead Early Access (Fundadores)</h2>
    <ul>
      <li><strong>E-mail:</strong> ${escapeHtml(payload.email)}</li>
      ${payload.name ? `<li><strong>Nome:</strong> ${escapeHtml(payload.name)}</li>` : ''}
      ${payload.company ? `<li><strong>Empresa:</strong> ${escapeHtml(payload.company)}</li>` : ''}
      ${payload.volume ? `<li><strong>Volume estimado:</strong> ${escapeHtml(payload.volume)}</li>` : ''}
      <li><strong>Origem:</strong> ${escapeHtml(payload.source ?? 'prelaunch_v53')}</li>
      <li><strong>Timestamp:</strong> ${escapeHtml(payload.ts ?? new Date().toISOString())}</li>
      <li><strong>IP:</strong> ${escapeHtml(meta.ip)}</li>
    </ul>
    <p style="font-size:12px;color:#666;margin-top:16px;">
      Capturado em <strong>zappiq.com.br</strong> (página de pré-lançamento V5.3).
    </p>
  `;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: `ZappIQ Early Access <${from}>`,
        to: [to],
        subject: `[Early Access] ${payload.email}`,
        html,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
  } catch (err) {
    console.warn('[leads] Resend send exception (non-blocking)', err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || 'unknown';

  // Rate limit
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: 'Muitas tentativas. Tente em alguns segundos.' }, { status: 429 });
  }

  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  // Validate
  const v = validate(body);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
  }

  // Insert
  const result = await insertLead(v.data, { ip, ua });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error || 'Falha interna' }, { status: 500 });
  }

  // Notify (fire-and-forget — não bloqueia resposta ao usuário)
  if (!result.duplicate) {
    notifyByEmail(v.data, { ip }).catch(() => {});
  }

  return NextResponse.json({ ok: true, duplicate: result.duplicate ?? false });
}

// CORS pré-flight (apenas same-origin previsto, mas retornamos 204 por seg)
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
