/**
 * POST /api/diagnostico — Diagnóstico de Perfil ZappIQ
 * --------------------------------------------------------------
 * Endpoint público do formulário de diagnóstico. Recebe os dados de contato
 * (gate para gerar o relatório) e as respostas das perguntas, roda o motor de
 * recomendação no servidor (fonte de verdade), persiste o lead e dispara os
 * dois e-mails (relatório para o cliente e lead para o comercial).
 *
 * Fluxo:
 *   1. Valida payload (empresa, contato, e-mail e consentimento obrigatórios).
 *   2. Roda recomendar(answers) no servidor -> Recommendation.
 *   3. Monta as respostas legíveis (pergunta -> label da opção) via QUESTIONS.
 *   4. Persiste o lead na public.diagnostico_leads via Supabase REST.
 *      Degrada gracioso: se faltar env ou a tabela não existir, loga warn e
 *      segue (o relatório continua sendo entregue).
 *   5. Dispara os dois e-mails via Resend (fire-and-forget, não bloqueia).
 *   6. Retorna { ok: true, recommendation } para o cliente renderizar o relatório.
 *
 * Anti-spam mínimo: rate limit em memória por IP (mesmo padrão de /api/leads).
 * Para produção de verdade, trocar por Upstash/Redis.
 *
 * Env vars esperadas:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY                 (opcional — log warn se ausente)
 *   LEADS_FROM_EMAIL               (default: marketing@zappiq.com.br)
 *   LEADS_NOTIFY_EMAIL             (default: vendas@zappiq.com.br)
 *
 * Tabela: criada via SQL (supabase/diagnostico_leads.sql).
 */
import { NextRequest, NextResponse } from 'next/server';
import { recomendar, type Answers, type Recommendation } from '../../../lib/diagnostico/engine';
import { QUESTIONS } from '../../../lib/diagnostico/data';
import {
  emailRelatorioCliente,
  emailLeadComercial,
  type DadosContato,
  type RespostaResumo,
} from '../../../lib/diagnostico/emailTemplates';

export const runtime = 'nodejs';

// ─── Rate limiter em memória (best-effort) ──────────────────────────────
const RATE_BUCKET = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): { ok: boolean } {
  const now = Date.now();
  const bucket = RATE_BUCKET.get(ip);
  if (!bucket || bucket.reset < now) {
    RATE_BUCKET.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    return { ok: true };
  }
  if (bucket.count >= RATE_LIMIT) {
    return { ok: false };
  }
  bucket.count += 1;
  return { ok: true };
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

// ─── Validação ──────────────────────────────────────────────────────────
interface DiagnosticoData {
  empresa: string;
  contato: string;
  email: string;
  telefone?: string;
  answers: Answers;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function validate(body: unknown): { ok: true; data: DiagnosticoData } | { ok: false; error: string } {
  if (!isPlainObject(body)) {
    return { ok: false, error: 'Payload inválido' };
  }
  const b = body;

  const empresa = typeof b.empresa === 'string' ? b.empresa.trim() : '';
  if (!empresa) return { ok: false, error: 'Nome da empresa obrigatório' };

  const contato = typeof b.contato === 'string' ? b.contato.trim() : '';
  if (!contato) return { ok: false, error: 'Nome do contato obrigatório' };

  const emailRaw = typeof b.email === 'string' ? b.email.trim() : '';
  if (!emailRaw) return { ok: false, error: 'E-mail obrigatório' };
  const email = emailRaw.toLowerCase();
  if (!/.+@.+\..+/.test(email)) return { ok: false, error: 'E-mail inválido' };
  if (email.length > 200) return { ok: false, error: 'E-mail muito longo' };

  if (b.consent !== true) return { ok: false, error: 'É necessário aceitar o consentimento' };

  const telefone =
    typeof b.telefone === 'string' && b.telefone.trim() ? b.telefone.trim().slice(0, 40) : undefined;

  const answers: Answers = isPlainObject(b.answers) ? (b.answers as Answers) : {};

  return {
    ok: true,
    data: {
      empresa: empresa.slice(0, 200),
      contato: contato.slice(0, 200),
      email,
      telefone,
      answers,
    },
  };
}

// ─── Respostas legíveis (value -> label das options) ────────────────────
function readableAnswer(answers: Answers, id: string): string {
  const q = QUESTIONS.find((x) => x.id === id);
  const raw = answers[id];
  if (!q || raw === undefined || raw === null) return '';
  if (q.openField) {
    const t = Array.isArray(raw) ? raw.join(' ') : String(raw);
    return t.trim();
  }
  const values = Array.isArray(raw) ? raw : [raw];
  return values
    .map((v) => q.options?.find((o) => o.value === v)?.label ?? String(v))
    .filter(Boolean)
    .join(', ');
}

function buildRespostas(answers: Answers): RespostaResumo[] {
  const out: RespostaResumo[] = [];
  for (const q of QUESTIONS) {
    const resposta = readableAnswer(answers, q.id);
    if (!resposta) continue;
    out.push({ pergunta: q.title, resposta });
  }
  return out;
}

// ─── Persistência (Supabase REST, degrada gracioso) ─────────────────────
async function persistLead(
  record: Record<string, unknown>,
): Promise<{ persisted: boolean }> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn('[diagnostico] SUPABASE_URL/KEY ausentes, pulando persistência (degradando gracioso)');
    return { persisted: false };
  }

  try {
    const res = await fetch(`${url}/rest/v1/diagnostico_leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(record),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // 404/PGRST205 = tabela inexistente. Não quebra: só registra e segue.
      console.warn('[diagnostico] persistência falhou (seguindo mesmo assim)', res.status, text.slice(0, 300));
      return { persisted: false };
    }

    return { persisted: true };
  } catch (err) {
    console.warn('[diagnostico] persistência exception (seguindo mesmo assim)', err);
    return { persisted: false };
  }
}

// ─── Resend (fire-and-forget) ───────────────────────────────────────────
async function sendResendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.LEADS_FROM_EMAIL || 'marketing@zappiq.com.br';

  if (!key) {
    console.warn('[diagnostico] RESEND_API_KEY ausente, pulando e-mail');
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: `ZappIQ <${from}>`,
        to: [to],
        subject,
        html,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[diagnostico] Resend retornou erro (non-blocking)', res.status, text.slice(0, 300));
    }
  } catch (err) {
    console.warn('[diagnostico] Resend exception (non-blocking)', err);
  }
}

// ─── Handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || 'unknown';

  // Rate limit
  if (!checkRateLimit(ip).ok) {
    return NextResponse.json(
      { ok: false, error: 'Muitas tentativas. Tente em alguns segundos.' },
      { status: 429 },
    );
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
  const { empresa, contato, email, telefone, answers } = v.data;

  // Recomendação no servidor (fonte de verdade) + respostas legíveis
  let recommendation: Recommendation;
  let respostas: RespostaResumo[];
  try {
    recommendation = recomendar(answers);
    respostas = buildRespostas(answers);
  } catch (err) {
    console.error('[diagnostico] falha ao gerar recomendação', err);
    return NextResponse.json({ ok: false, error: 'Não foi possível gerar o diagnóstico' }, { status: 500 });
  }

  const dados: DadosContato = { empresa, contato, email, telefone };

  // Persistência (não fatal: o relatório é entregue mesmo se o insert falhar)
  await persistLead({
    empresa,
    contato,
    email,
    telefone: telefone ?? null,
    segmento: recommendation.segLabel,
    objetivo: readableAnswer(answers, 'objetivo') || null,
    plano_sugerido: recommendation.plano,
    addons_sugeridos: recommendation.addons,
    respostas,
    source: 'diagnostico',
    ip,
    user_agent: ua.slice(0, 500),
  });

  // E-mails (fire-and-forget — não bloqueia a resposta ao cliente)
  const notify = process.env.LEADS_NOTIFY_EMAIL || 'vendas@zappiq.com.br';
  try {
    const relatorio = emailRelatorioCliente(dados, recommendation);
    sendResendEmail(email, relatorio.subject, relatorio.html).catch(() => {});

    const lead = emailLeadComercial(dados, recommendation, respostas);
    sendResendEmail(notify, lead.subject, lead.html).catch(() => {});
  } catch (err) {
    console.warn('[diagnostico] falha ao montar/despachar e-mails (non-blocking)', err);
  }

  return NextResponse.json({ ok: true, recommendation });
}

// CORS pré-flight (same-origin previsto; 204 por segurança)
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
