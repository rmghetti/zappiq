/**
 * Template · dsr-completed
 *
 * E-mail ao titular quando uma requisição LGPD (Art. 18) é concluída pelo
 * operador na tela /dsr. Cobre os desfechos de EXCLUSÃO/ANONIMIZAÇÃO,
 * ACESSO/PORTABILIDADE (export anexado ou disponibilizado) e demais tipos.
 *
 * Uso típico:
 *
 *   import { renderDsrCompletedEmail } from './templates/dsrCompleted';
 *   const { subject, html, text } = renderDsrCompletedEmail({
 *     requesterName: 'Maria',
 *     protocol: 'DSR-1A2B3C4D',
 *     requestTypeLabel: 'Eliminação',
 *     outcome: 'deletion',
 *     orgName: 'Acme Inc',
 *   });
 */

export type DsrOutcome = 'deletion' | 'export' | 'generic';

export interface DsrCompletedEmailInput {
  requesterName: string | null;
  /** Protocolo curto exibido ao titular (ex.: DSR-1A2B3C4D). */
  protocol: string;
  /** Rótulo pt-BR do tipo (ex.: "Eliminação", "Acesso aos dados"). */
  requestTypeLabel: string;
  /** Desfecho para escolher o corpo. */
  outcome: DsrOutcome;
  /** Nome do controlador que atendeu (aparece no rodapé). */
  orgName: string;
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

function bodyFor(outcome: DsrOutcome): { headline: string; paragraph: string } {
  switch (outcome) {
    case 'deletion':
      return {
        headline: 'Seus dados foram eliminados',
        paragraph:
          'Concluímos sua solicitação. Os dados pessoais associados a você (nome, telefone, e-mail e histórico de conversas) foram anonimizados ou marcados para eliminação, conforme o Art. 18 da LGPD. Métricas agregadas e anonimizadas podem ser mantidas apenas para fins estatísticos, sem identificar você.',
      };
    case 'export':
      return {
        headline: 'Seus dados estão prontos',
        paragraph:
          'Concluímos sua solicitação de acesso/portabilidade. O relatório com os dados pessoais que tratamos sobre você segue anexo (ou foi disponibilizado por canal seguro). Se não encontrar o anexo, responda este e-mail que reenviamos.',
      };
    default:
      return {
        headline: 'Sua solicitação foi concluída',
        paragraph:
          'Concluímos o atendimento da sua solicitação relacionada aos seus dados pessoais, conforme o Art. 18 da LGPD.',
      };
  }
}

export function renderDsrCompletedEmail(input: DsrCompletedEmailInput): RenderedEmail {
  const { requesterName, protocol, requestTypeLabel, outcome, orgName } = input;
  const greetingName = requesterName?.trim() || 'Olá';
  const { headline, paragraph } = bodyFor(outcome);

  const subject = `Sua solicitação LGPD foi concluída — protocolo ${protocol}`;

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
            <tr>
              <td style="padding:32px;background:linear-gradient(135deg,#059669,#10b981);color:#ffffff;">
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.85;">LGPD · Art. 18</p>
                <p style="margin:8px 0 0;font-size:22px;font-weight:800;line-height:1.3;">${escapeHtml(headline)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
                  ${escapeHtml(greetingName)},
                </p>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#374151;">
                  ${escapeHtml(paragraph)}
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;">
                  <tr>
                    <td style="padding:16px;background:#f8faf9;border-radius:12px;">
                      <p style="margin:0;font-size:13px;color:#6b7280;">Protocolo</p>
                      <p style="margin:4px 0 12px;font-size:16px;font-weight:700;color:#111827;font-family:monospace;">${escapeHtml(protocol)}</p>
                      <p style="margin:0;font-size:13px;color:#6b7280;">Tipo de solicitação</p>
                      <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#111827;">${escapeHtml(requestTypeLabel)}</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-size:13px;line-height:1.7;color:#6b7280;">
                  Se você não reconhece esta solicitação ou tem alguma dúvida, responda este e-mail.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8faf9;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                  Este e-mail foi enviado por ${escapeHtml(orgName)} em atendimento à Lei Geral de Proteção de Dados (LGPD).
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
    `${greetingName},`,
    '',
    headline,
    '',
    paragraph,
    '',
    `Protocolo: ${protocol}`,
    `Tipo de solicitação: ${requestTypeLabel}`,
    '',
    'Se você não reconhece esta solicitação ou tem alguma dúvida, responda este e-mail.',
    '',
    `— ${orgName} (em atendimento à LGPD)`,
  ].join('\n');

  return { subject, html, text };
}
