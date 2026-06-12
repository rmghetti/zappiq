/**
 * Quota Alerts Service (#147 — Onda 1.B).
 *
 * Multi-canal: dispara alerta por email + WhatsApp pro telefone DE CADASTRO
 * do usuario admin (NAO pelo numero operacional do agente — esse atende cliente
 * final). Decisao explicita do CEO: "alertas pelo WA de cadastro de contato e
 * NAO pelo WA de operacao de seu agente".
 *
 * Thresholds: 70 / 80 / 90 / 95 / 100% (5 niveis pra dar visibilidade
 * progressiva ao cliente, conforme /goal).
 *
 * Idempotencia delegada ao caller (usageReconciliationService ja tem hash
 * Redis pra nao notificar mesmo threshold 2x no mes).
 */

import { prisma } from '@zappiq/database';
import { sendText } from './whatsappService.js';
import { sendEmail } from './email/emailProvider.js';
import { logger } from '../utils/logger.js';

export type QuotaAlertThreshold = 70 | 80 | 90 | 95 | 100;

export interface QuotaAlertPayload {
  orgId: string;
  orgName: string;
  threshold: QuotaAlertThreshold;
  current: number;
  limit: number;
  usagePercent: number;
  planId: string;
  /** Acao prevista no momento — passa pro copy do alerta */
  reconcilAction: string;
  /** R$ excedente estimado (centavos) — opcional, so faz sentido em 100% */
  overageBrlCents?: number;
}

export interface AlertDispatchResult {
  emailSent: boolean;
  whatsappSent: boolean;
  emailError?: string;
  whatsappError?: string;
}

/**
 * Subject + body do email por threshold. Tom progressivo:
 *   70% — informativo
 *   80% — atencao
 *   90% — urgente
 *   95% — decisao iminente
 *   100% — acao tomada
 */
function buildEmailContent(p: QuotaAlertPayload): { subject: string; html: string } {
  const tone: Record<QuotaAlertThreshold, { emoji: string; label: string; cta: string }> = {
    70:  { emoji: '📊', label: 'Aviso preventivo',   cta: 'Acompanhar uso' },
    80:  { emoji: '📈', label: 'Atencao ao consumo', cta: 'Revisar plano' },
    90:  { emoji: '⚠️',  label: 'Limite proximo',     cta: 'Decidir comportamento' },
    95:  { emoji: '🚨', label: 'Decisao iminente',   cta: 'Configurar agora' },
    100: { emoji: '🔴', label: 'Limite atingido',    cta: 'Ver acoes' },
  };
  const t = tone[p.threshold];
  const subject = `${t.emoji} ZappIQ — ${t.label}: ${p.orgName} em ${p.usagePercent.toFixed(0)}% da cota`;

  const overageNote = p.overageBrlCents
    ? `<p style="margin:14px 0;color:#374151;font-size:14px"><strong>Estimativa excedente:</strong> R$ ${(p.overageBrlCents / 100).toFixed(2)}</p>`
    : '';

  const html = `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <div style="font-size:24px;margin-bottom:8px">${t.emoji} ${t.label}</div>
    <h1 style="margin:0 0 16px;font-size:22px;color:#111827;line-height:1.3">
      ${p.orgName} usou ${p.usagePercent.toFixed(0)}% da cota mensal
    </h1>
    <p style="color:#4b5563;font-size:15px;line-height:1.5;margin:0 0 16px">
      Consumo atual: <strong>${p.current.toLocaleString('pt-BR')} de ${p.limit.toLocaleString('pt-BR')} mensagens IA</strong> no plano <strong>${p.planId}</strong>.
    </p>
    ${overageNote}
    <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0">
      <p style="margin:0;color:#374151;font-size:13px;line-height:1.5">
        <strong>Acao prevista no fim do mes:</strong> ${p.reconcilAction}
      </p>
    </div>
    <a href="https://zappiq.com.br/settings#billing" style="display:inline-block;background:linear-gradient(90deg,#7c3aed,#2563eb);color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">${t.cta} →</a>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;line-height:1.5">
      Voce esta recebendo isso porque administra a conta ${p.orgName} na ZappIQ.
      Pra ajustar limites ou ativar cobranca de excedente: <a href="https://zappiq.com.br/settings#billing" style="color:#7c3aed">acessar configuracoes</a>.
    </p>
  </div>
</body></html>`;

  return { subject, html };
}

/**
 * Mensagem WhatsApp curta pro celular de CADASTRO do admin.
 * Mantida concisa pra nao virar spam.
 */
function buildWaText(p: QuotaAlertPayload): string {
  const tone: Record<QuotaAlertThreshold, string> = {
    70: 'Aviso preventivo',
    80: 'Atencao ao consumo',
    90: 'Limite proximo',
    95: 'Decisao iminente',
    100: 'Limite atingido',
  };
  const overageLine = p.overageBrlCents
    ? `\nExcedente estimado: R$ ${(p.overageBrlCents / 100).toFixed(2)}`
    : '';
  return `*ZappIQ — ${tone[p.threshold]}*

${p.orgName} usou *${p.usagePercent.toFixed(0)}%* da cota mensal (${p.current.toLocaleString('pt-BR')}/${p.limit.toLocaleString('pt-BR')} msgs IA no plano ${p.planId}).${overageLine}

Acao prevista: ${p.reconcilAction}

Ajustar: https://zappiq.com.br/settings#billing`;
}

/**
 * Despacha alerta de quota em multi-canal (email + WhatsApp).
 *
 * Resolve destinatario:
 *   - email: user.email do admin/superadmin mais recente da org
 *   - whatsapp: user.phone do mesmo admin (precisa ter sido coletado no signup)
 *
 * Falha de UM canal NAO bloqueia o outro. Loga estruturado pra Grafana.
 */
export async function dispatchMultiChannelQuotaAlert(
  payload: QuotaAlertPayload,
): Promise<AlertDispatchResult> {
  const result: AlertDispatchResult = { emailSent: false, whatsappSent: false };

  // Resolve admin destinatario — ADMIN ou SUPERADMIN mais antigo da org
  let admin: { email: string; phone: string | null } | null = null;
  try {
    const u = (await prisma.user.findFirst({
      where: {
        organizationId: payload.orgId,
        role: { in: ['ADMIN', 'SUPERADMIN'] },
      },
      orderBy: { createdAt: 'asc' },
      // User nao tem campo `phone` no schema — telefone de cadastro ainda
      // nao e coletado no signup. phone=null => canal WA e pulado (fail-soft).
      select: { email: true },
    })) as any;
    admin = u ? { email: u.email, phone: null } : null;
  } catch (err: any) {
    logger.warn(`[quotaAlerts] falhou ao buscar admin org=${payload.orgId}: ${err?.message}`);
  }

  if (!admin) {
    logger.warn(`[quotaAlerts] sem admin pra org=${payload.orgId}, skip`);
    return result;
  }

  // EMAIL
  try {
    const { subject, html } = buildEmailContent(payload);
    // SendEmailInput exige `text` — versao plain-text reusa o copy do WhatsApp
    // (mesmo conteudo, sem markup) como fallback pra clientes sem HTML.
    const text = buildWaText(payload).replace(/\*/g, '');
    const r = await sendEmail({ to: admin.email, subject, html, text });
    result.emailSent = Boolean((r as any)?.success ?? r);
  } catch (err: any) {
    result.emailError = err?.message ?? 'unknown';
    logger.warn(`[quotaAlerts] email fail org=${payload.orgId}: ${result.emailError}`);
  }

  // WHATSAPP — pelo numero ZappIQ global (creds default), NAO pelo agente do cliente
  if (admin.phone) {
    try {
      const text = buildWaText(payload);
      // Sem creds passadas = whatsappService usa env global (numero ZappIQ)
      await sendText(admin.phone, text);
      result.whatsappSent = true;
    } catch (err: any) {
      result.whatsappError = err?.message ?? 'unknown';
      logger.warn(`[quotaAlerts] WA fail org=${payload.orgId}: ${result.whatsappError}`);
    }
  } else {
    logger.debug(`[quotaAlerts] admin sem phone — skip WA`);
  }

  logger.info(`[quotaAlerts] dispatched org=${payload.orgId} threshold=${payload.threshold}% email=${result.emailSent} wa=${result.whatsappSent}`);

  return result;
}
