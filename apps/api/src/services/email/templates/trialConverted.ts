/**
 * Template · trial-converted
 *
 * E-mail de parabéns disparado no webhook do Stripe quando trial → plano pago.
 * Agradecimento + 3 próximos passos pós-conversão + link para billing.
 *
 * Uso:
 *
 *   import { renderTrialConvertedEmail } from './templates/trialConverted';
 *   const { subject, html, text } = renderTrialConvertedEmail({
 *     firstName: 'Pedro',
 *     orgName: 'Soluções Tech',
 *     tierLabel: 'Growth',
 *     monthlyBrl: 797,
 *   });
 */

export interface TrialConvertedEmailInput {
  firstName: string;
  orgName: string;
  tierLabel: string;
  monthlyBrl: number;
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

export function renderTrialConvertedEmail(input: TrialConvertedEmailInput): RenderedEmail {
  const { firstName, orgName, tierLabel, monthlyBrl } = input;

  const subject = 'Parabéns — você acaba de virar cliente ZappIQ';

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
            <!-- Header comemorativo -->
            <tr>
              <td style="padding:32px 32px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#ffffff;">
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">🎉 Bem-vindo(a)</p>
                <p style="margin:8px 0 0;font-size:24px;font-weight:800;line-height:1.3;">Parabéns, ${escapeHtml(firstName)}!</p>
              </td>
            </tr>

            <!-- Corpo -->
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
                  Sua conta foi ativada. <strong>${escapeHtml(orgName)}</strong> agora é uma
                  cliente oficial da ZappIQ e sua IA está 100% operacional.
                </p>

                <!-- Resumo do plano -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8faf9;border-radius:12px;padding:20px 24px;margin:24px 0;">
                  <tr>
                    <td width="50%">
                      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;">Seu plano</p>
                      <p style="margin:0;font-size:18px;font-weight:800;color:#111827;">${escapeHtml(tierLabel)}</p>
                    </td>
                    <td width="50%">
                      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;">Primeiro pagamento</p>
                      <p style="margin:0;font-size:18px;font-weight:800;color:#111827;">${brl(monthlyBrl)}</p>
                      <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">ao mês</p>
                    </td>
                  </tr>
                </table>

                <!-- Próximos passos -->
                <div style="margin:24px 0;">
                  <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:.06em;">3 próximos passos</p>

                  <div style="padding:16px;background:#f8faf9;border-radius:8px;margin-bottom:12px;">
                    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#4f46e5;">1. Revisar suas integrações</p>
                    <p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:#374151;">
                      Verifique se WhatsApp, e-mail e APIs estão conectadas corretamente
                      em Settings > Integrations.
                    </p>
                  </div>

                  <div style="padding:16px;background:#f8faf9;border-radius:8px;margin-bottom:12px;">
                    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#4f46e5;">2. Ativar notificações para sua equipe</p>
                    <p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:#374151;">
                      Invite seus colegas em Settings > Team. Notificações em tempo real
                      ajudam a pegar gaps de resposta rápido.
                    </p>
                  </div>

                  <div style="padding:16px;background:#f8faf9;border-radius:8px;">
                    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#4f46e5;">3. Agendar onboarding (opcional)</p>
                    <p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:#374151;">
                      Se quiser suporte especializado para custom behaviors ou volume alto,
                      posso agendar uma sessão. Responda este e-mail.
                    </p>
                  </div>
                </div>

                <!-- CTA para billing -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:32px;">
                  <tr>
                    <td align="center">
                      <a href="https://app.zappiq.com.br/settings/billing" style="display:inline-block;padding:14px 28px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;box-shadow:0 4px 10px rgba(79,70,229,.35);">
                        Ver fatura e adicionar pagamento →
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:28px 0 0;font-size:13px;line-height:1.7;color:#6b7280;">
                  <strong>Obrigado por escolher ZappIQ.</strong>
                  Você acabou de entrar num grupo que economiza em média ${brl(18000)}/ano
                  em operações — sem abrir mão de qualidade. Vamos crescer junto.
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
                  ${escapeHtml(tierLabel)} · ${brl(monthlyBrl)}/mês · Cancelamento sem multa.
                  Obrigado por ser cliente ZappIQ.
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
    `Parabéns, ${firstName}!`,
    '',
    `${orgName} agora é cliente oficial da ZappIQ.`,
    '',
    `Seu plano: ${tierLabel}`,
    `Primeiro pagamento: ${brl(monthlyBrl)}/mês`,
    '',
    'Próximos passos:',
    '',
    '1. Revisar suas integrações',
    'Verifique WhatsApp, e-mail e APIs em Settings > Integrations.',
    '',
    '2. Ativar notificações para sua equipe',
    'Invite colegas em Settings > Team.',
    '',
    '3. Agendar onboarding (opcional)',
    'Se quiser suporte especializado, responda este e-mail.',
    '',
    'Fatura: https://app.zappiq.com.br/settings/billing',
    '',
    'Obrigado por escolher ZappIQ. Vamos crescer junto.',
    '',
    'Abraço,',
    'Rodrigo Ghetti — Founder, ZappIQ',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
