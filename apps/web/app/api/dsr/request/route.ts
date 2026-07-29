/**
 * POST /api/dsr/request
 * ---------------------
 * Endpoint público para Direitos do Titular LGPD (Art. 18).
 *
 * Fluxo (W2.6 — unificado com a fila do admin):
 *   1. Valida payload (sem zod — validação manual para não adicionar dependências).
 *   2. PRIMÁRIO: encaminha para a API Express (POST /api/dsr/public), que grava
 *      em data_subject_requests (MESMA fonte que o admin /dsr lê). É isso que
 *      garante que a solicitação do titular VIRE 1 LINHA na fila do admin.
 *   3. FALLBACK (só se a API estiver indisponível): grava em public.dsr_requests
 *      via Supabase REST com protocolo DSR-YYYYMMDD-XXXXXX, mantendo o
 *      comportamento antigo para não perder a solicitação.
 *   4. Dispara e-mail pro DPO e pro solicitante via Resend (fire-and-forget).
 *   5. Retorna { protocolo }.
 *
 * Contrato: definido em PRIVACY_V32_APROVADA_JURIDICO.md.
 * Tabela: criada via T1A_supabase_dsr_table.command.
 *
 * Fallback client-side: se este endpoint retornar 5xx ou estiver offline,
 * a página /legal/deletar-dados abre mailto:privacidade@zappiq.com.br com
 * os campos pré-preenchidos. Nunca quebra.
 *
 * Env vars esperadas:
 *   SUPABASE_URL                  — https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY     — chave de serviço (bypass RLS)
 *   RESEND_API_KEY                — key da Resend
 *   DPO_EMAIL                     — default dpo@zappiq.com.br
 *   DSR_FROM_EMAIL                — from verificado na Resend (ex: privacidade@zappiq.com.br)
 *   API_URL / NEXT_PUBLIC_API_URL — base da API Express (default http://localhost:3001)
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

// ============================================================================
// Tipos
// ============================================================================

type DsrTipo =
  | 'EXCLUSAO'
  | 'ACESSO'
  | 'CORRECAO'
  | 'ANONIMIZACAO'
  | 'PORTABILIDADE'
  | 'REVOGACAO_CONSENTIMENTO';

type DsrVinculo = 'CLIENTE' | 'EX_CLIENTE' | 'END_USER' | 'LEAD' | 'OUTRO';

interface DsrPayload {
  tipo: DsrTipo;
  nomeCompleto: string;
  email: string;
  documento: string;
  telefone?: string;
  vinculo: DsrVinculo;
  detalhes?: string;
  confirmaIdentidade: boolean;
}

const TIPOS_VALIDOS: DsrTipo[] = [
  'EXCLUSAO',
  'ACESSO',
  'CORRECAO',
  'ANONIMIZACAO',
  'PORTABILIDADE',
  'REVOGACAO_CONSENTIMENTO',
];

const VINCULOS_VALIDOS: DsrVinculo[] = [
  'CLIENTE',
  'EX_CLIENTE',
  'END_USER',
  'LEAD',
  'OUTRO',
];

const TIPO_LABEL: Record<DsrTipo, string> = {
  EXCLUSAO: 'Exclusão de dados',
  ACESSO: 'Acesso aos dados',
  CORRECAO: 'Correção de dados',
  ANONIMIZACAO: 'Anonimização',
  PORTABILIDADE: 'Portabilidade',
  REVOGACAO_CONSENTIMENTO: 'Revogação de consentimento',
};

// ============================================================================
// Validação manual
// ============================================================================

function validatePayload(body: any): { ok: true; data: DsrPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Payload inválido' };
  }

  if (!TIPOS_VALIDOS.includes(body.tipo)) {
    return { ok: false, error: 'Tipo de solicitação inválido' };
  }

  if (typeof body.nomeCompleto !== 'string' || body.nomeCompleto.trim().length < 3 || body.nomeCompleto.length > 200) {
    return { ok: false, error: 'Nome completo inválido' };
  }

  if (
    typeof body.email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ||
    body.email.length > 200
  ) {
    return { ok: false, error: 'E-mail inválido' };
  }

  if (typeof body.documento !== 'string' || body.documento.trim().length < 11 || body.documento.length > 20) {
    return { ok: false, error: 'Documento inválido (CPF ou CNPJ)' };
  }

  if (body.telefone !== undefined && (typeof body.telefone !== 'string' || body.telefone.length > 20)) {
    return { ok: false, error: 'Telefone inválido' };
  }

  if (!VINCULOS_VALIDOS.includes(body.vinculo)) {
    return { ok: false, error: 'Vínculo inválido' };
  }

  if (body.detalhes !== undefined && (typeof body.detalhes !== 'string' || body.detalhes.length > 2000)) {
    return { ok: false, error: 'Detalhes excedem 2000 caracteres' };
  }

  if (body.confirmaIdentidade !== true) {
    return { ok: false, error: 'É necessário confirmar a declaração de identidade' };
  }

  return {
    ok: true,
    data: {
      tipo: body.tipo,
      nomeCompleto: body.nomeCompleto.trim(),
      email: body.email.trim().toLowerCase(),
      documento: body.documento.replace(/\D/g, ''),
      telefone: body.telefone?.trim() || undefined,
      vinculo: body.vinculo,
      detalhes: body.detalhes?.trim() || undefined,
      confirmaIdentidade: true,
    },
  };
}

// ============================================================================
// Geração de protocolo
// ============================================================================

function generateProtocolo(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const suffix = randomBytes(3).toString('hex').toUpperCase(); // 6 chars hex
  return `DSR-${y}${m}${d}-${suffix}`;
}

// ============================================================================
// Supabase insert
// ============================================================================

async function insertDsrRequest(payload: DsrPayload, protocolo: string): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('[DSR] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes');
    return { ok: false, error: 'Backend indisponível' };
  }

  const record = {
    protocolo,
    tipo: payload.tipo,
    nome_completo: payload.nomeCompleto,
    email: payload.email,
    documento: payload.documento,
    telefone: payload.telefone ?? null,
    vinculo: payload.vinculo,
    detalhes: payload.detalhes ?? null,
    status: 'PENDENTE',
  };

  try {
    const res = await fetch(`${url}/rest/v1/dsr_requests`, {
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
      console.error('[DSR] Supabase insert falhou', res.status, text);
      return { ok: false, error: 'Falha ao registrar solicitação' };
    }

    return { ok: true };
  } catch (err) {
    console.error('[DSR] Supabase insert exception', err);
    return { ok: false, error: 'Falha de rede ao registrar solicitação' };
  }
}

// ============================================================================
// Encaminhamento primário para a API do admin (data_subject_requests)
// ============================================================================

/**
 * POST para a API Express /api/dsr/public, que grava na MESMA tabela que o
 * admin lê (data_subject_requests). Retorna o protocolo gerado pela API.
 * Se a API estiver indisponível/erro, retorna null e o handler cai no fallback
 * Supabase — a solicitação nunca se perde.
 */
async function postToAdminApi(payload: DsrPayload): Promise<{ protocolo: string } | null> {
  const base = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${base.replace(/\/$/, '')}/api/dsr/public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[DSR] API /api/dsr/public respondeu erro', res.status, text);
      return null;
    }

    const json = (await res.json().catch(() => null)) as { protocolo?: string } | null;
    if (!json?.protocolo) {
      console.error('[DSR] API /api/dsr/public não retornou protocolo');
      return null;
    }
    return { protocolo: json.protocolo };
  } catch (err) {
    console.error('[DSR] Falha ao encaminhar para a API do admin', err);
    return null;
  }
}

// ============================================================================
// E-mails (fire-and-forget via Resend)
// ============================================================================

async function sendResendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.DSR_FROM_EMAIL || 'privacidade@zappiq.com.br';

  if (!key) {
    console.warn('[DSR] RESEND_API_KEY ausente — pulando envio');
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
  } catch (err) {
    console.warn('[DSR] Resend send falhou (fire-and-forget):', err);
  }
}

function buildDpoEmailHtml(payload: DsrPayload, protocolo: string): string {
  return `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: auto;">
      <h2>Nova solicitação LGPD — ${TIPO_LABEL[payload.tipo]}</h2>
      <p><strong>Protocolo:</strong> ${protocolo}</p>
      <p><strong>Recebida em:</strong> ${new Date().toISOString()}</p>
      <hr>
      <p><strong>Nome:</strong> ${escapeHtml(payload.nomeCompleto)}</p>
      <p><strong>E-mail:</strong> ${escapeHtml(payload.email)}</p>
      <p><strong>Documento:</strong> ${escapeHtml(payload.documento)}</p>
      ${payload.telefone ? `<p><strong>Telefone:</strong> ${escapeHtml(payload.telefone)}</p>` : ''}
      <p><strong>Vínculo:</strong> ${payload.vinculo}</p>
      ${payload.detalhes ? `<p><strong>Detalhes:</strong><br>${escapeHtml(payload.detalhes).replace(/\n/g, '<br>')}</p>` : ''}
      <hr>
      <p style="color: #666; font-size: 12px;">
        Prazo de resposta: 15 dias úteis (LGPD Art. 19).
        Acesse o painel de DSRs no Supabase para atualizar status.
      </p>
    </div>
  `;
}

function buildSolicitanteEmailHtml(payload: DsrPayload, protocolo: string): string {
  return `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: auto;">
      <h2>Recebemos sua solicitação LGPD</h2>
      <p>Olá ${escapeHtml(payload.nomeCompleto.split(' ')[0])},</p>
      <p>Confirmamos o recebimento da sua solicitação de <strong>${TIPO_LABEL[payload.tipo]}</strong>.</p>
      <p><strong>Protocolo:</strong> <code style="background: #f5f5f5; padding: 4px 8px; border-radius: 4px;">${protocolo}</code></p>
      <p>Nosso DPO irá analisar e responder em até <strong>15 dias úteis</strong>, conforme o Art. 19 da LGPD.</p>
      <p>Se precisar complementar a solicitação, responda este e-mail citando o protocolo.</p>
      <hr>
      <p style="color: #666; font-size: 13px;">
        ZappIQ — Encarregado de Dados (DPO)<br>
        <a href="mailto:dpo@zappiq.com.br">dpo@zappiq.com.br</a>
      </p>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// Handler
// ============================================================================

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const validation = validatePayload(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const payload = validation.data;

  // PRIMÁRIO (W2.6): encaminha para a API do admin, que grava em
  // data_subject_requests — a MESMA fonte que a fila do admin /dsr lê.
  // É isso que faz a solicitação do titular aparecer para o operador.
  let protocolo: string;
  const adminResult = await postToAdminApi(payload);

  if (adminResult) {
    protocolo = adminResult.protocolo;
  } else {
    // FALLBACK: API indisponível — grava em public.dsr_requests (Supabase) para
    // não perder a solicitação. Comportamento antigo preservado.
    protocolo = generateProtocolo();
    const inserted = await insertDsrRequest(payload, protocolo);
    if (!inserted.ok) {
      return NextResponse.json(
        { error: inserted.error ?? 'Falha ao registrar' },
        { status: 500 }
      );
    }
  }

  // E-mails (fire-and-forget — não bloqueia a resposta)
  const dpoEmail = process.env.DPO_EMAIL || 'dpo@zappiq.com.br';
  sendResendEmail(
    dpoEmail,
    `[DSR ${protocolo}] ${TIPO_LABEL[payload.tipo]} — ${payload.nomeCompleto}`,
    buildDpoEmailHtml(payload, protocolo)
  );
  sendResendEmail(
    payload.email,
    `ZappIQ — Solicitação LGPD recebida (protocolo ${protocolo})`,
    buildSolicitanteEmailHtml(payload, protocolo)
  );

  return NextResponse.json({ protocolo }, { status: 200 });
}
