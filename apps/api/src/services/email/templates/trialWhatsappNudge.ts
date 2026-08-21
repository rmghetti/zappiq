/**
 * Template · trial-whatsapp-nudge (stage W7)
 *
 * Lembrete D+7 pós-signup para org que AINDA não conectou o WhatsApp
 * (whatsappPhoneNumberId NULL) e por isso nunca ativou o trial
 * (trialStartedAt NULL). Faz parte do desenho de trial por ativação
 * (decisão D-plano, 20/08/2026): o teste de 14 dias só começa a contar na
 * primeira mensagem real de cliente, então este e-mail pode dizer com
 * honestidade "você não perdeu nem um dia".
 *
 * Curto de propósito: um recado, dois caminhos (conectar o canal ou
 * experimentar a IA no navegador via playground /ai-training). Voz humana,
 * sem número inventado e sem travessão.
 *
 * Uso:
 *
 *   import { renderTrialWhatsappNudgeEmail } from './templates/trialWhatsappNudge';
 *   const { subject, html, text } = renderTrialWhatsappNudgeEmail({
 *     firstName: 'Maria',
 *     connectUrl: 'https://app.zappiq.com.br/settings#canais',
 *     demoUrl: 'https://app.zappiq.com.br/ai-training',
 *   });
 */

export interface TrialWhatsappNudgeEmailInput {
  firstName: string;
  /** Tela de conexão do canal (Configurações > Canais). */
  connectUrl: string;
  /** Playground "Testar minha IA" (/ai-training): demo no navegador. */
  demoUrl: string;
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

export function renderTrialWhatsappNudgeEmail(
  input: TrialWhatsappNudgeEmailInput,
): RenderedEmail {
  const { firstName, connectUrl, demoUrl } = input;

  const subject = 'Falta um passo: conectar seu WhatsApp';

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
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.8;">ZappIQ · Sua conta</p>
                <p style="margin:8px 0 0;font-size:20px;font-weight:800;line-height:1.3;">${escapeHtml(subject)}</p>
              </td>
            </tr>

            <!-- Corpo -->
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
                  Oi, ${escapeHtml(firstName)}. Faz uma semana que você criou sua conta
                  na ZappIQ e a gente reparou que o seu WhatsApp ainda não está conectado.
                  Sem ele, sua IA fica de mãos atadas: não tem cliente pra atender.
                </p>

                <!-- Reasseguro: o teste ainda não começou a contar -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8faf9;border-radius:12px;margin:20px 0;">
                  <tr>
                    <td style="padding:20px 24px;">
                      <p style="margin:0;font-size:14px;line-height:1.7;color:#374151;">
                        A boa notícia: seus <strong>14 dias grátis só começam a contar
                        quando a primeira mensagem de cliente chegar</strong> no seu
                        WhatsApp. Ou seja, você não perdeu nem um dia de teste.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- CTA principal -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;">
                  <tr>
                    <td align="center">
                      <a href="${escapeHtml(connectUrl)}" style="display:inline-block;padding:14px 28px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;box-shadow:0 4px 10px rgba(79,70,229,.35);">
                        Conectar meu WhatsApp →
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#374151;">
                  Prefere ver a IA funcionando antes de conectar? Converse com ela agora
                  no navegador, sem instalar nada:
                  <a href="${escapeHtml(demoUrl)}" style="color:#4f46e5;font-weight:600;text-decoration:none;">testar minha IA no navegador</a>.
                </p>

                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
                  Travou em algum passo da conexão? Responda este e-mail que a gente
                  te ajuda a ligar tudo.
                </p>

                <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#111827;">
                  Abraço,<br/>
                  <strong>Equipe ZappIQ</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px;background:#f8faf9;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                  Seu teste grátis de 14 dias começa na primeira conversa real.
                  Você recebeu este e-mail porque criou uma conta na ZappIQ.
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
    'Faz uma semana que você criou sua conta na ZappIQ e o seu WhatsApp ainda não está conectado. Sem ele, sua IA fica de mãos atadas: não tem cliente pra atender.',
    '',
    'A boa notícia: seus 14 dias grátis só começam a contar quando a primeira mensagem de cliente chegar no seu WhatsApp. Você não perdeu nem um dia de teste.',
    '',
    `Conectar meu WhatsApp: ${connectUrl}`,
    '',
    `Prefere ver a IA funcionando antes? Converse com ela no navegador: ${demoUrl}`,
    '',
    'Travou em algum passo? Responda este e-mail que a gente te ajuda.',
    '',
    'Abraço,',
    'Equipe ZappIQ',
  ].join('\n');

  return { subject, html, text };
}
