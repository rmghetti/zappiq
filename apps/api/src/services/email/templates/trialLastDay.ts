/**
 * Template · trial-last-day
 *
 * E-mail de urgência · último dia de trial (D+14).
 * Subject com valor de economia, CTA com cupom LASTDAY14 hardcoded.
 * Tom honesto — sem countdown fake, sem dark patterns.
 *
 * Uso:
 *
 *   import { renderTrialLastDayEmail } from './templates/trialLastDay';
 *   const { subject, html, text } = renderTrialLastDayEmail({
 *     firstName: 'Ana',
 *     aiReadinessScore: 68,
 *     savings: 21500,
 *     ctaUrl: 'https://app.zappiq.com.br/billing?coupon=LASTDAY14',
 *   });
 */

export interface TrialLastDayEmailInput {
  firstName: string;
  aiReadinessScore: number;
  savings: number;
  ctaUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(raw: string): string {
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function brl(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR')}`;
}

export function renderTrialLastDayEmail(input: TrialLastDayEmailInput): RenderedEmail {
  const { firstName, aiReadinessScore, savings, ctaUrl } = input;

  const subject = `Último dia de trial · trave ${brl(savings)} de economia agora`;

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
            <!-- Header urgente -->
            <tr>
              <td style="padding:32px 32px;background:linear-gradient(135deg,#dc2626,#991b1b);color:#ffffff;">
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">⏰ Último dia</p>
                <p style="margin:8px 0 0;font-size:22px;font-weight:800;line-height:1.3;">Seu trial expira hoje</p>
              </td>
            </tr>

            <!-- Corpo -->
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151;">
                  Oi, ${escapeHtml(firstName)}.
                </p>

                <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#374151;">
                  Este é seu último dia de acesso grátis à ZappIQ. Depois de hoje,
                  sua IA vai parar de funcionar — a menos que você converta.
                </p>

                <!-- O número grande -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fef2f2;border:2px solid #fee2e2;border-radius:12px;padding:24px;margin:24px 0;">
                  <tr>
                    <td align="center">
                      <p style="margin:0;font-size:13px;font-weight:700;color:#7f1d1d;text-transform:uppercase;letter-spacing:.08em;">Sua economia no 1º ano</p>
                      <p style="margin:8px 0;font-size:36px;font-weight:900;color:#dc2626;line-height:1;">${brl(savings)}</p>
                      <p style="margin:0;font-size:13px;color:#991b1b;">
                        Convertendo hoje com cupom <code style="background:#f0f0f0;padding:3px 8px;border-radius:4px;font-family:monospace;">LASTDAY14</code>
                      </p>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#374151;">
                  Você treinou sua IA por 14 dias. Ela aprendeu seus documentos,
                  seus processos, seu tom de voz. Tudo que você construiu não desaparece.
                </p>

                <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#6b7280;">
                  <strong>Sem setup fee. Sem mensalidade mínima.</strong>
                  Você paga apenas ${brl(247)}/mês no Starter, ou quanto usar.
                  Cupom LASTDAY14 = 14% off no primeiro ano (já incluso no número acima).
                </p>

                <!-- CTA grande -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:32px 0;">
                  <tr>
                    <td align="center">
                      <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:18px 36px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:800;font-size:16px;box-shadow:0 6px 12px rgba(220,38,38,.4);">
                        Converter e travar cupom agora
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Sem dark patterns -->
                <p style="margin:0 0 16px;font-size:12px;line-height:1.6;color:#6b7280;">
                  ✓ Sem contratação automática · ✓ Sem surpresas no boleto
                  <br/>✓ Cancela quando quiser · ✓ Sem perguntas incômodas
                </p>

                <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#6b7280;">
                  Dúvida sobre integração? Funcionalidades? Pricing? Responda este e-mail.
                  Eu (<strong>Rodrigo</strong>) leio tudo. Se for urgente e estivermos fora,
                  aviso quando volto.
                </p>

                <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#111827;">
                  Abraço,<br/>
                  <strong>Rodrigo Ghetti — Founder, ZappIQ</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px;background:#f8faf9;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                  Seu trial vence em 23:59 de hoje (hora de Brasília).
                  Depois, sua IA para de funcionar. Cupom LASTDAY14 = 14% off no 1º ano.
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
    subject,
    '',
    `Oi, ${firstName}.`,
    '',
    'Este é seu último dia de trial. Depois de hoje, sua IA para de funcionar.',
    '',
    `Sua economia no 1º ano: ${brl(savings)}`,
    `Cupom LASTDAY14 = 14% off (já incluso).`,
    '',
    'Você treinou sua IA por 14 dias. Tudo que você construiu continua acessível — basta converter.',
    '',
    'Sem setup fee. Sem mensalidade mínima.',
    `Você paga apenas ${brl(247)}/mês no Starter.`,
    '',
    `Converter: ${ctaUrl}`,
    '',
    'Sem contratação automática. Sem surpresas. Cancela quando quiser.',
    '',
    'Dúvida? Responda este e-mail.',
    '',
    'Abraço,',
    'Rodrigo Ghetti — Founder, ZappIQ',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
