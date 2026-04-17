/**
 * Template · trial-welcome
 *
 * E-mail de boas-vindas ao trial da ZappIQ. Disparado ao criar uma
 * organização em trial. Inclui os 3 próximos passos e CTA para IA Training.
 *
 * Uso típico:
 *
 *   import { renderTrialWelcomeEmail } from './templates/trialWelcome';
 *   const { subject, html, text } = renderTrialWelcomeEmail({
 *     firstName: 'Rodrigo',
 *     orgName: 'Acme Inc',
 *     ctaUrl: 'https://app.zappiq.com.br/ai-training',
 *     daysRemaining: 14,
 *   });
 */

export interface TrialWelcomeEmailInput {
  firstName: string;
  orgName: string;
  /** URL absoluta para /ai-training. */
  ctaUrl: string;
  /** Dias do trial (geralmente 14). */
  daysRemaining: number;
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

export function renderTrialWelcomeEmail(input: TrialWelcomeEmailInput): RenderedEmail {
  const { firstName, orgName, ctaUrl, daysRemaining } = input;

  const subject = 'Bem-vindo(a) à ZappIQ — sua IA começa a treinar em 2 minutos';

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
            <!-- Header com gradient -->
            <tr>
              <td style="padding:32px 32px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;">
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.8;">ZappIQ · 14 dias grátis</p>
                <p style="margin:8px 0 0;font-size:22px;font-weight:800;line-height:1.3;">Bem-vindo(a), ${escapeHtml(firstName)}!</p>
              </td>
            </tr>

            <!-- Corpo -->
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
                  Sua organização <strong>${escapeHtml(orgName)}</strong> está pronta para começar.
                  Você tem <strong>${daysRemaining} dias de trial grátis</strong> para treinar sua IA
                  conversacional e ver o quanto você economiza.
                </p>

                <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#374151;">
                  Nenhum cartão de crédito necessário. Sem contrato de consultor.
                  Você faz tudo sozinho — é por isso que somos 40% mais baratos.
                </p>

                <!-- 3 Próximos Passos -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                  <!-- Passo 1 -->
                  <tr>
                    <td style="padding:16px;background:#f8faf9;border-radius:12px;margin-bottom:12px;">
                      <p style="margin:0;font-size:13px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:.08em;">1. Conectar WhatsApp</p>
                      <p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#374151;">
                        Vá para Settings e copie seus detalhes do WhatsApp Business.
                        Você redireciona para nossa API — leva 30 segundos.
                      </p>
                    </td>
                  </tr>

                  <!-- Passo 2 -->
                  <tr>
                    <td style="padding:16px;background:#f8faf9;border-radius:12px;margin-bottom:12px;">
                      <p style="margin:0;font-size:13px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:.08em;">2. Subir 1 documento</p>
                      <p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#374151;">
                        Vá para Knowledge Base e faça upload de um PDF, planilha ou Google Doc.
                        Sua IA vai aprender tudo daí.
                      </p>
                    </td>
                  </tr>

                  <!-- Passo 3 -->
                  <tr>
                    <td style="padding:16px;background:#f8faf9;border-radius:12px;">
                      <p style="margin:0;font-size:13px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:.08em;">3. Envie uma pergunta teste</p>
                      <p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#374151;">
                        Responda nosso micro-formulário (2 minutos). Usamos para calibrar
                        o tom e contexto inicial da IA.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- CTA principal -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:32px;">
                  <tr>
                    <td align="center">
                      <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:16px 32px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px;box-shadow:0 4px 10px rgba(79,70,229,.35);">
                        Começar IA Training agora →
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:28px 0 0;font-size:13px;line-height:1.7;color:#6b7280;">
                  Qualquer dúvida? Responda esse e-mail — respondemos em 2h.
                  Fim de semana, segundas — a gente tá aqui. Somos uma dupla pequena,
                  mas muito dedicada à sua experiência.
                </p>

                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#111827;">
                  Abraço,<br/>
                  <strong>Rodrigo Ghetti — Founder, ZappIQ</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px;background:#f8faf9;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                  14 dias grátis · sem cartão de crédito · cap US$ 15 no trial.
                  Você recebeu este e-mail porque se inscreveu na ZappIQ.
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
    `Bem-vindo(a), ${firstName}!`,
    '',
    `Sua organização ${orgName} está pronta para começar.`,
    `Você tem ${daysRemaining} dias de trial grátis.`,
    '',
    'Próximos passos:',
    '',
    '1. Conectar WhatsApp',
    'Vá para Settings e copie seus detalhes do WhatsApp Business.',
    '',
    '2. Subir 1 documento',
    'Vá para Knowledge Base e faça upload de um PDF ou Google Doc.',
    '',
    '3. Enviar uma pergunta teste',
    'Responda nosso micro-formulário (2 minutos).',
    '',
    `Começar agora: ${ctaUrl}`,
    '',
    'Qualquer dúvida? Responda esse e-mail.',
    '',
    'Abraço,',
    'Rodrigo Ghetti — Founder, ZappIQ',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
