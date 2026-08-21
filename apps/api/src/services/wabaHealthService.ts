/**
 * Saúde do canal WABA (Resposta Meta out/2026, PR-D).
 *
 * O caso CMJ provou o buraco: a WABA do cliente ficou bloqueada por semanas e
 * ninguém soube, porque nada olhava o canal de forma proativa. Esta varredura
 * roda a cada 6 horas (fila cron `waba-health`), reaproveita o mesmo check
 * read-only do "Testar conexão" (channelCredentialCheck) e grava o resultado
 * em ChannelHealthCheck, o histórico que alimenta o card "seu canal NÃO está
 * no ar" do dash (GET /api/channel-health).
 *
 * Alerta APENAS na transição: canal saudável que passou a reprovar (ou cuja
 * qualidade caiu para RED/FLAGGED) dispara e-mail + WhatsApp pro admin da org,
 * no padrão do quotaAlertsService. Falha seguida de falha fica muda: o alerta
 * avisa a mudança de estado, o card do dash mostra o estado corrente. Sem
 * histórico anterior o baseline é "saudável": um canal que já nasce quebrado
 * alerta uma vez na primeira varredura (o caso CMJ de novo) e depois silencia.
 *
 * Sequencial de propósito, com pequena pausa entre orgs, para não estourar o
 * rate limit da Graph API. Falha em uma org não derruba a varredura.
 */
import { prisma, Prisma } from '@zappiq/database';

import { logger } from '../utils/logger.js';
import { checkWhatsappCredentials, type CredentialCheckResult } from './channelCredentialCheck.js';
import { sendEmail } from './email/emailProvider.js';
import { sendText } from './whatsappService.js';

/** Pausa entre orgs (ms): espaça as chamadas na Graph API. */
const SWEEP_DELAY_MS = 400;

/** Ratings da Meta que contam como canal degradado mesmo com o check ok. */
const DEGRADED_RATINGS = new Set(['RED', 'FLAGGED']);

export interface WabaHealthSweepResult {
  orgsChecked: number;
  alertsSent: number;
  orgsFailed: number;
  durationMs: number;
}

export interface WabaHealthAlertPayload {
  orgId: string;
  orgName: string;
  /** down: o check reprovou. quality: check ok, mas rating caiu pra RED/FLAGGED. */
  reason: 'down' | 'quality';
  qualityRating?: string;
  /** Mensagem crua da Graph + dica acionável, vindas do check. */
  error?: string;
  hint?: string;
}

export interface WabaAlertDispatchResult {
  emailSent: boolean;
  whatsappSent: boolean;
  emailError?: string;
  whatsappError?: string;
}

function isDegradedQuality(rating?: string | null): boolean {
  return Boolean(rating && DEGRADED_RATINGS.has(rating.toUpperCase()));
}

/** Canal saudável = check ok E qualidade fora de RED/FLAGGED. */
function isHealthy(ok: boolean, rating?: string | null): boolean {
  return ok && !isDegradedQuality(rating);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Escape mínimo pra interpolar texto vindo da Graph API dentro do HTML. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const SETTINGS_CHANNELS_URL = 'https://zappiq.com.br/settings#whatsapp';

/**
 * Subject + body do e-mail. Tom direto: o cliente precisa agir, não estudar.
 * A dica acionável do check (quando existe) vai no bloco "O que fazer".
 */
function buildEmailContent(p: WabaHealthAlertPayload): { subject: string; html: string } {
  const down = p.reason === 'down';
  const subject = down
    ? `🔴 ZappIQ: o canal WhatsApp de ${p.orgName} não está no ar`
    : `⚠️ ZappIQ: a qualidade do número WhatsApp de ${p.orgName} caiu (${p.qualityRating ?? 'RED'})`;

  const headline = down
    ? 'Seu canal WhatsApp parou de responder'
    : `A qualidade do seu número caiu para ${p.qualityRating ?? 'RED'}`;

  const explain = down
    ? 'Na verificação automática de saúde do canal, o número da sua conta não respondeu com as credenciais salvas. Enquanto isso não for corrigido, seus leads podem ficar sem resposta.'
    : 'A Meta rebaixou a qualidade do seu número de WhatsApp. Nesse estado, o alcance dos envios pode ser reduzido e o número pode sofrer restrições de volume.';

  const errorNote = p.error
    ? `<p style="margin:14px 0;color:#374151;font-size:13px"><strong>Erro reportado pela Meta:</strong> ${escapeHtml(p.error)}</p>`
    : '';

  const actionText =
    p.hint ??
    (down
      ? 'Abra as configurações de canais, confira as credenciais e use o Testar conexão. Se precisar, agende o onboarding assistido.'
      : 'Reduza o volume de disparos por alguns dias, revise modelos reprovados e responda rápido às conversas abertas. A qualidade se recupera com o uso saudável do número.');

  const html = `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <div style="font-size:24px;margin-bottom:8px">${down ? '🔴' : '⚠️'} Saúde do canal WhatsApp</div>
    <h1 style="margin:0 0 16px;font-size:22px;color:#111827;line-height:1.3">${headline}</h1>
    <p style="color:#4b5563;font-size:15px;line-height:1.5;margin:0 0 16px">${explain}</p>
    ${errorNote}
    <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0">
      <p style="margin:0;color:#374151;font-size:13px;line-height:1.5"><strong>O que fazer:</strong> ${escapeHtml(actionText)}</p>
    </div>
    <a href="${SETTINGS_CHANNELS_URL}" style="display:inline-block;background:linear-gradient(90deg,#7c3aed,#2563eb);color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Revisar canal →</a>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;line-height:1.5">
      Você está recebendo isso porque administra a conta ${p.orgName} na ZappIQ.
      O monitor verifica seu canal a cada 6 horas e só avisa quando o estado muda.
    </p>
  </div>
</body></html>`;

  return { subject, html };
}

/** Mensagem WhatsApp curta pro celular de CADASTRO do admin. */
function buildWaText(p: WabaHealthAlertPayload): string {
  const down = p.reason === 'down';
  const title = down
    ? 'Seu canal WhatsApp NÃO está no ar'
    : `Qualidade do número caiu para ${p.qualityRating ?? 'RED'}`;
  const action =
    p.hint ??
    (down
      ? 'Confira as credenciais em Configurações > Canais e use o Testar conexão.'
      : 'Reduza o volume de disparos e revise os modelos reprovados.');
  return `*ZappIQ: ${title}*

Conta: ${p.orgName}${p.error ? `\nErro: ${p.error}` : ''}

O que fazer: ${action}

Revisar: ${SETTINGS_CHANNELS_URL}`;
}

/**
 * Despacha o alerta de saúde em multi-canal (e-mail + WhatsApp), no padrão do
 * quotaAlertsService: resolve o admin mais antigo da org, falha de UM canal
 * não bloqueia o outro, e nada aqui lança (alerta é best-effort).
 */
export async function dispatchWabaHealthAlert(
  payload: WabaHealthAlertPayload,
): Promise<WabaAlertDispatchResult> {
  const result: WabaAlertDispatchResult = { emailSent: false, whatsappSent: false };

  // Resolve admin destinatário: ADMIN ou SUPERADMIN mais antigo da org.
  let admin: { email: string; phone: string | null } | null = null;
  try {
    const u = await prisma.user.findFirst({
      where: { organizationId: payload.orgId, role: { in: ['ADMIN', 'SUPERADMIN'] } },
      orderBy: { createdAt: 'asc' },
      // User não tem campo `phone` no schema (telefone de cadastro ainda não é
      // coletado no signup). phone=null => canal WA é pulado (fail-soft),
      // mesmo comportamento do quotaAlertsService.
      select: { email: true },
    });
    admin = u ? { email: u.email, phone: null } : null;
  } catch (err: any) {
    logger.warn(`[WabaHealth] falhou ao buscar admin org=${payload.orgId}: ${err?.message}`);
  }

  if (!admin) {
    logger.warn(`[WabaHealth] sem admin pra org=${payload.orgId}, skip alerta`);
    return result;
  }

  // EMAIL
  try {
    const { subject, html } = buildEmailContent(payload);
    // SendEmailInput exige `text`: versão plain-text reusa o copy do WhatsApp.
    const text = buildWaText(payload).replace(/\*/g, '');
    const r = await sendEmail({ to: admin.email, subject, html, text });
    result.emailSent = Boolean((r as any)?.success ?? r);
  } catch (err: any) {
    result.emailError = err?.message ?? 'unknown';
    logger.warn(`[WabaHealth] email fail org=${payload.orgId}: ${result.emailError}`);
  }

  // WHATSAPP: pelo número ZappIQ global (creds default), nunca pelo canal do
  // cliente (que é justamente o que está doente).
  if (admin.phone) {
    try {
      await sendText(admin.phone, buildWaText(payload));
      result.whatsappSent = true;
    } catch (err: any) {
      result.whatsappError = err?.message ?? 'unknown';
      logger.warn(`[WabaHealth] WA fail org=${payload.orgId}: ${result.whatsappError}`);
    }
  } else {
    logger.debug('[WabaHealth] admin sem phone, skip WA');
  }

  logger.info(
    `[WabaHealth] alerta despachado org=${payload.orgId} reason=${payload.reason} email=${result.emailSent} wa=${result.whatsappSent}`,
  );

  return result;
}

/** Resumo do payload do check pra coluna Json `detail` (nunca credenciais). */
function buildDetail(check: CredentialCheckResult): Prisma.InputJsonValue {
  if (check.ok) {
    return {
      displayPhoneNumber: check.displayPhoneNumber ?? null,
      verifiedName: check.verifiedName ?? null,
      qualityRating: check.qualityRating ?? null,
      messagingTier: check.messagingTier ?? null,
    };
  }
  return {
    error: (check.error ?? '').slice(0, 300),
    hint: check.hint ?? null,
  };
}

/**
 * Varredura de saúde do WABA. Para cada org com canal WhatsApp PRÓPRIO
 * (phone number id + token na org), roda o check read-only, grava uma linha
 * de histórico e alerta o admin quando o estado piora.
 *
 * `opts.delayMs` existe pros testes (0 = sem espera). Produção usa o default.
 */
export async function runWabaHealthSweep(opts?: {
  delayMs?: number;
}): Promise<WabaHealthSweepResult> {
  const started = Date.now();
  const delayMs = opts?.delayMs ?? SWEEP_DELAY_MS;

  // Só orgs com credencial própria: quem atende pela credencial global da
  // plataforma (dogfood Iza) fica de fora, igual ao roteamento do webhook.
  // Organization não tem coluna de soft delete (exclusão de org é hard delete
  // com cascade), então o recorte por credencial é o único filtro necessário:
  // org apagada some da tabela e sai sozinha da varredura.
  const orgs = await prisma.organization.findMany({
    where: {
      whatsappPhoneNumberId: { not: null },
      whatsappAccessToken: { not: null },
    },
    select: {
      id: true,
      name: true,
      whatsappPhoneNumberId: true,
      whatsappAccessToken: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let orgsChecked = 0;
  let alertsSent = 0;
  let orgsFailed = 0;
  let first = true;

  for (const org of orgs) {
    // Defensivo: o where já exige credencial, mas drift de dado (ex.: token
    // esvaziado entre o SELECT e o loop) não pode derrubar a varredura.
    if (!org.whatsappPhoneNumberId || !org.whatsappAccessToken) continue;

    // Sequencial com pausa entre orgs: rate limit da Graph API.
    if (!first) await sleep(delayMs);
    first = false;

    try {
      // Estado anterior ANTES de gravar o novo: é ele que define a transição.
      const previous = await prisma.channelHealthCheck.findFirst({
        where: { organizationId: org.id, channel: 'whatsapp' },
        orderBy: { checkedAt: 'desc' },
        select: { ok: true, qualityRating: true },
      });

      const check = await checkWhatsappCredentials(
        org.whatsappPhoneNumberId,
        org.whatsappAccessToken,
        { includeMessagingTier: true },
      );

      await prisma.channelHealthCheck.create({
        data: {
          organizationId: org.id,
          channel: 'whatsapp',
          ok: check.ok,
          qualityRating: check.qualityRating ?? null,
          messagingTier: check.messagingTier ?? null,
          errorCode: check.errorCode != null ? String(check.errorCode) : null,
          detail: buildDetail(check),
        },
      });
      orgsChecked++;

      // Transição: saudável -> degradado dispara; degradado -> degradado fica
      // mudo (sem spam a cada 6h). Sem histórico, baseline saudável: canal que
      // já chega quebrado alerta na primeira varredura e depois silencia.
      const wasHealthy = previous ? isHealthy(previous.ok, previous.qualityRating) : true;
      const nowHealthy = isHealthy(check.ok, check.qualityRating);

      if (wasHealthy && !nowHealthy) {
        await dispatchWabaHealthAlert({
          orgId: org.id,
          orgName: org.name,
          reason: check.ok ? 'quality' : 'down',
          qualityRating: check.qualityRating,
          error: check.error,
          hint: check.hint,
        });
        alertsSent++;
      }
    } catch (err: any) {
      orgsFailed++;
      logger.warn(`[WabaHealth] falha ao varrer org=${org.id}: ${err?.message ?? err}`);
    }
  }

  const durationMs = Date.now() - started;
  logger.info(
    `[WabaHealth] Varredura concluída: orgs=${orgsChecked}, alertas=${alertsSent}, falhas=${orgsFailed}, ${durationMs}ms`,
  );

  return { orgsChecked, alertsSent, orgsFailed, durationMs };
}
