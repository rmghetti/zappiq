/* ═══════════════════════════════════════════════════════════════════════
 * Template · trial-savings-followup
 * ---------------------------------------------------------------------
 * E-mail disparado em D+3 e D+10 do trial (ou sob demanda manual do
 * fundador). Usa a mesma lógica de cálculo do componente web compartilhado
 * (SavingsCalculator.computeSavings) para manter um único lugar de verdade
 * sobre o pitch de economia.
 *
 * O HTML gerado é inline-styled para máxima compatibilidade com clientes
 * de e-mail (Gmail, Outlook, Apple Mail). Sem CSS externo, sem JS.
 *
 * Uso típico:
 *
 *   import { renderTrialSavingsFollowupEmail } from './templates/trialSavingsFollowup';
 *   const { subject, html, text } = renderTrialSavingsFollowupEmail({
 *     firstName: 'Rodrigo',
 *     daysRemaining: 11,
 *     competitorSetupBrl: 8000,
 *     competitorMonthlyBrl: 1500,
 *     aiReadinessScore: 72,
 *     ctaUrl: 'https://app.zappiq.com.br/billing?coupon=TRIAL14',
 *   });
 *
 *   await emailProvider.send({ to, subject, html, text });
 * ═══════════════════════════════════════════════════════════════════════ */

export interface TrialSavingsEmailInput {
  firstName: string;
  /** Dias restantes de trial. Se ≤ 0 trata como expirado. */
  daysRemaining: number;
  /** Setup fee informado na cotação do concorrente (R$). */
  competitorSetupBrl: number;
  /** Mensalidade informada na cotação do concorrente (R$). */
  competitorMonthlyBrl: number;
  /** AI Readiness atual do tenant (0-100). Opcional — se omitido o bloco some. */
  aiReadinessScore?: number;
  /** Tier da ZappIQ que está sendo comparado. Default: Starter R$ 197. */
  zappiqTierLabel?: string;
  zappiqMonthlyBrl?: number;
  /** URL absoluta do CTA (com cupom, trackers etc). */
  ctaUrl: string;
  /** Nome do fundador que assina. Default: "Rodrigo Ghetti — Founder, ZappIQ". */
  signature?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/* ---------- duplicata deliberada da fórmula do front ---------------- */
export function computeSavings(
  competitorSetupBrl: number,
  competitorMonthlyBrl: number,
  zappiqMonthlyBrl: number,
) {
  const firstYearCompetitor =
    Math.max(0, competitorSetupBrl) + Math.max(0, competitorMonthlyBrl) * 12;
  const firstYearZappiq = Math.max(0, zappiqMonthlyBrl) * 12;
  const savings = Math.max(0, firstYearCompetitor - firstYearZappiq);
  const pctSavings =
    firstYearCompetitor > 0 ? Math.round((savings / firstYearCompetitor) * 100) : 0;
  return { firstYearCompetitor, firstYearZappiq, savings, pctSavings };
}

function brl(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR')}`;
}

function subjectLine(daysRemaining: number, savings: number): string {
  if (daysRemaining <= 0) {
    return `Seu trial acabou — mas R$ ${savings.toLocaleString('pt-BR')}/ano ainda estão na mesa`;
  }
  if (daysRemaining >= 10) {
    return `${daysRemaining > 13 ? 'Bem-vindo' : 'Primeira semana'} — veja quanto você já economizou sem setup fee`;
  }
  if (daysRemaining >= 4) {
    return `Faltam ${daysRemaining} dias de trial · economia calculada dentro`;
  }
  return `Reta final · ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} para travar ${brl(savings)} de economia`;
}

function readinessBlock(score?: number): string {
  if (score === undefined) return '';
  const level =
    score >= 85 ? 'Expert' : score >= 60 ? 'Pronta' : score >= 30 ? 'Aprendendo' : 'Inicial';
  const levelColor =
    score >= 60 ? '#22c55e' : score >= 30 ? '#f59e0b' : '#6b7280';
  return `
    <tr>
      <td style="padding:16px 24px;background:#f8faf9;border-radius:12px;margin:16px 0;" align="left">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;">AI Readiness Score</p>
        <p style="margin:0;font-size:16px;font-weight:700;color:#111827;">
          ${score}/100
          <span style="color:${levelColor};font-weight:600;font-size:13px;margin-left:8px;">${level}</span>
        </p>
      </td>
    </tr>`;
}

/* ---------- Render --------------------------------------------------- */
export function renderTrialSavingsFollowupEmail(
  input: TrialSavingsEmailInput,
): RenderedEmail {
  const {
    firstName,
    daysRemaining,
    competitorSetupBrl,
    competitorMonthlyBrl,
    aiReadinessScore,
    zappiqTierLabel = 'ZappIQ Starter',
    zappiqMonthlyBrl = 197,
    ctaUrl,
    signature = 'Rodrigo Ghetti — Founder, ZappIQ',
  } = input;

  const { firstYearCompetitor, firstYearZappiq, savings, pctSavings } = computeSavings(
    competitorSetupBrl,
    competitorMonthlyBrl,
    zappiqMonthlyBrl,
  );

  const subject = subjectLine(daysRemaining, savings);

  const urgencyLine =
    daysRemaining <= 0
      ? `O trial acabou, mas a conta continua simples: sem setup fee, você paga ${brl(zappiqMonthlyBrl)}/mês. Quer reativar?`
      : daysRemaining <= 3
      ? `Faltam ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}. Converta hoje e trave 14% off no primeiro ano (cupom automático no link).`
      : daysRemaining <= 7
      ? `${daysRemaining} dias para o fim do trial. Número abaixo é o que você economiza se converter agora.`
      : `${daysRemaining} dias de trial ainda. O cálculo abaixo é conservador — use os números reais da sua cotação.`;

  const html = `<!doctype html>
<html lang="pt-br">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <!-- Header -->
            <tr>
              <td style="padding:24px 32px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;">
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.8;">ZappIQ · Sem setup fee</p>
                <p style="margin:6px 0 0;font-size:20px;font-weight:800;">${escapeHtml(subject)}</p>
              </td>
            </tr>

            <!-- Corpo -->
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Olá, <strong>${escapeHtml(firstName)}</strong>.</p>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#374151;">
                  ${escapeHtml(urgencyLine)}
                </p>

                <!-- Comparativo -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;background:#fafaff;border:1px solid #e9e9ff;border-radius:12px;">
                  <tr>
                    <td style="padding:18px 20px;border-right:1px solid #e9e9ff;" width="50%">
                      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;">Concorrente (ano 1)</p>
                      <p style="margin:0;font-size:20px;font-weight:800;color:#111827;">${brl(firstYearCompetitor)}</p>
                      <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">
                        ${brl(competitorSetupBrl)} setup + ${brl(competitorMonthlyBrl)}/mês
                      </p>
                    </td>
                    <td style="padding:18px 20px;" width="50%">
                      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;">${escapeHtml(zappiqTierLabel)} (ano 1)</p>
                      <p style="margin:0;font-size:20px;font-weight:800;color:#111827;">${brl(firstYearZappiq)}</p>
                      <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">
                        R$ 0 setup + ${brl(zappiqMonthlyBrl)}/mês
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Resultado dominante -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;background:linear-gradient(90deg,#4f46e5,#7c3aed);border-radius:12px;">
                  <tr>
                    <td style="padding:20px 24px;color:#ffffff;" align="center">
                      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.85;">Sua economia no 1º ano</p>
                      <p style="margin:6px 0 2px;font-size:32px;font-weight:900;line-height:1;">${brl(savings)}</p>
                      <p style="margin:4px 0 0;font-size:13px;font-weight:600;opacity:.95;">${pctSavings}% menor que o concorrente</p>
                    </td>
                  </tr>
                </table>

                ${readinessBlock(aiReadinessScore)}

                <!-- CTA -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;">
                  <tr>
                    <td align="center">
                      <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 28px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;box-shadow:0 4px 10px rgba(79,70,229,.35);">
                        ${daysRemaining <= 0 ? 'Reativar minha conta' : 'Converter trial agora'} →
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:28px 0 0;font-size:13px;line-height:1.7;color:#6b7280;">
                  Sem consultor. Sem setup fee. Você treinou sua IA sozinho e já tem o que é seu.
                  Se preferir comparar tier Growth (R$ 497) ou Scale (R$ 997) para volumes maiores,
                  responda esse e-mail e eu mesmo entro no cálculo com você.
                </p>

                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#111827;">
                  Abraço,<br/>
                  <strong>${escapeHtml(signature)}</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px;background:#f8faf9;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                  Baseline conservador · ${escapeHtml(zappiqTierLabel)} · ${brl(zappiqMonthlyBrl)}/mês · R$ 0 setup · 14 dias grátis · cap US$ 15 no trial.
                  Você recebeu este e-mail porque está em trial da plataforma ZappIQ.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Olá, ${firstName}.`,
    '',
    urgencyLine,
    '',
    `Concorrente (ano 1): ${brl(firstYearCompetitor)}  (${brl(competitorSetupBrl)} setup + ${brl(competitorMonthlyBrl)}/mês)`,
    `${zappiqTierLabel} (ano 1): ${brl(firstYearZappiq)}  (R$ 0 setup + ${brl(zappiqMonthlyBrl)}/mês)`,
    '',
    `Sua economia: ${brl(savings)} (${pctSavings}% menor).`,
    aiReadinessScore !== undefined
      ? `AI Readiness Score atual: ${aiReadinessScore}/100.`
      : '',
    '',
    `CTA: ${ctaUrl}`,
    '',
    'Sem consultor. Sem setup fee. Você treinou sua IA sozinho.',
    '',
    signature,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

/* ---------- util privada -------------------------------------------- */
function escapeHtml(raw: string): string {
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
