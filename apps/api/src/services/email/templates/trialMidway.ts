/**
 * Template · trial-midway
 *
 * E-mail de check-in no meio do trial (D+10, ~11 dias restantes).
 * Subject dinâmico conforme AI Readiness Score. Mostra próximas ações
 * e bloco de economia estimada.
 *
 * Uso:
 *
 *   import { renderTrialMidwayEmail } from './templates/trialMidway';
 *   const { subject, html, text } = renderTrialMidwayEmail({
 *     firstName: 'Maria',
 *     daysRemaining: 11,
 *     aiReadinessScore: 72,
 *     savings: 18000,
 *     ctaUrl: 'https://app.zappiq.com.br/billing?coupon=TRIAL14',
 *   });
 */

export interface TrialMidwayEmailInput {
  firstName: string;
  daysRemaining: number;
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

export function renderTrialMidwayEmail(input: TrialMidwayEmailInput): RenderedEmail {
  const { firstName, daysRemaining, aiReadinessScore, savings, ctaUrl } = input;

  // Subject dinâmico
  const subject = aiReadinessScore >= 60
    ? 'Sua IA já está pronta — hora de converter antes do cupom expirar'
    : `Faltam ${daysRemaining} dias — veja o que sua IA já aprendeu`;

  // Contexto do readiness score
  const readinessLevel = aiReadinessScore >= 85
    ? 'Expert'
    : aiReadinessScore >= 60
    ? 'Pronta'
    : aiReadinessScore >= 30
    ? 'Aprendendo'
    : 'Inicial';

  const readinessColor = aiReadinessScore >= 60 ? '#22c55e' : '#f59e0b';

  const nextStepsTitle = aiReadinessScore >= 60
    ? 'Próximos passos para converter'
    : 'Como acelerar o treinamento';

  const nextSteps = aiReadinessScore >= 60
    ? [
        'Revisar os templates de resposta (Settings > AI Behavior)',
        'Testar com dados reais (envie uma mensagem pelo seu número)',
        'Se tiver dúvidas de integrações, responda este e-mail',
      ]
    : [
        'Subir mais documentos de origem (não é só sobre quantidade)',
        'Responder as próximas perguntas do survey de contexto',
        'Revisar as sugestões automáticas (Settings > Suggestions)',
      ];

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
              <td style="padding:32px 32px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;">
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.8;">ZappIQ · Meio do trial</p>
                <p style="margin:8px 0 0;font-size:20px;font-weight:800;line-height:1.3;">${escapeHtml(subject)}</p>
              </td>
            </tr>

            <!-- Corpo -->
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
                  Oi, ${escapeHtml(firstName)}. Você está na metade do seu trial
                  (${daysRemaining} dias ainda) e sua IA já está ${aiReadinessScore >= 60 ? 'muito boa' : 'aprendendo bem'}.
                </p>

                <!-- AI Readiness Score -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8faf9;border-radius:12px;padding:20px 24px;margin:20px 0;">
                  <tr>
                    <td align="center">
                      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;">AI Readiness Score</p>
                      <p style="margin:0;font-size:32px;font-weight:900;color:#111827;">
                        ${aiReadinessScore}<span style="font-size:20px;opacity:.7;">/100</span>
                      </p>
                      <p style="margin:8px 0 0;font-size:13px;font-weight:600;color:${readinessColor};">● ${readinessLevel}</p>
                    </td>
                  </tr>
                </table>

                <!-- Economia estimada -->
                ${savings > 0 ? `
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(90deg,#4f46e5,#7c3aed);border-radius:12px;padding:20px 24px;margin:20px 0;color:#ffffff;">
                  <tr>
                    <td align="center">
                      <p style="margin:0 0 6px;font-size:11px;font-weight:700;opacity:.85;text-transform:uppercase;letter-spacing:.06em;">Economia projetada (1º ano)</p>
                      <p style="margin:0;font-size:28px;font-weight:900;">${brl(savings)}</p>
                    </td>
                  </tr>
                </table>
                ` : ''}

                <!-- Próximos passos -->
                <div style="margin:24px 0;">
                  <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:.06em;">${escapeHtml(nextStepsTitle)}</p>
                  ${nextSteps.map((step, i) => `
                    <p style="margin:8px 0;padding:12px 16px;background:#f8faf9;border-radius:8px;font-size:14px;line-height:1.6;color:#374151;">
                      <span style="font-weight:700;color:#4f46e5;">${i + 1}.</span> ${escapeHtml(step)}
                    </p>
                  `).join('')}
                </div>

                <!-- CTA -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:32px;">
                  <tr>
                    <td align="center">
                      <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 28px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;box-shadow:0 4px 10px rgba(79,70,229,.35);">
                        ${aiReadinessScore >= 60 ? 'Converter agora' : 'Ver dashboard'} →
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
                  Não esqueça: você tem 14% de desconto automático se converter até o fim do trial.
                  Cupom <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;">TRIAL14</code> já está pré-carregado.
                </p>

                <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#111827;">
                  Abraço,<br/>
                  <strong>Rodrigo Ghetti — Founder, ZappIQ</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px;background:#f8faf9;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                  ${daysRemaining} dias restantes · cupom TRIAL14 ativo.
                  Você recebeu este e-mail porque está em trial da ZappIQ.
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
    `Você tem ${daysRemaining} dias ainda de trial.`,
    '',
    `AI Readiness Score: ${aiReadinessScore}/100 (${readinessLevel})`,
    `Economia projetada (1º ano): ${brl(savings)}`,
    '',
    nextStepsTitle,
    ...nextSteps.map((s, i) => `${i + 1}. ${s}`),
    '',
    `CTA: ${ctaUrl}`,
    '',
    'Cupom TRIAL14 já está ativo. Você tem 14% de desconto até o fim do trial.',
    '',
    'Abraço,',
    'Rodrigo Ghetti — Founder, ZappIQ',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
