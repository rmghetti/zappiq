/**
 * Template · trial-reminder (T-3 / T-2 / T-1 / T-0)
 *
 * Um único template parametrizado por `daysLeft` (3, 2, 1 ou 0). Substitui a
 * cadência antiga D+3/D+7 pela contagem regressiva pedida: lembretes a 3, 2 e 1
 * dia do fim e no dia do fim (T-0 = "seu teste terminou").
 *
 * Empurra o plano ANUAL (20% off) como padrão. Se recebido um plano recomendado
 * (motor de recomendação por uso), destaca-o. Tom honesto, sem dark patterns.
 *
 * Copy revisada pela skill voz-humana (sem travessão, tom natural, 1ª pessoa).
 */

export interface TrialReminderEmailInput {
  firstName: string;
  /** 3, 2, 1 (dias restantes) ou 0 (o teste terminou hoje). */
  daysLeft: 0 | 1 | 2 | 3;
  ctaUrl: string;
  /** Plano recomendado pelo uso (ex.: "Growth"). Opcional. */
  recommendedPlanLabel?: string;
  /** Mensalidade equivalente no anual do plano recomendado (R$). Opcional. */
  recommendedAnnualMonthlyBrl?: number;
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

interface Tone {
  badge: string;
  headline: string;
  grad: string;
  accent: string;
}

function toneFor(daysLeft: number): Tone {
  if (daysLeft <= 0) {
    return {
      badge: 'Seu teste terminou',
      headline: 'Escolha um plano para continuar',
      grad: 'linear-gradient(135deg,#dc2626,#991b1b)',
      accent: '#dc2626',
    };
  }
  if (daysLeft === 1) {
    return {
      badge: 'Falta 1 dia',
      headline: 'Seu teste termina amanhã',
      grad: 'linear-gradient(135deg,#ea580c,#c2410c)',
      accent: '#ea580c',
    };
  }
  if (daysLeft === 2) {
    return {
      badge: 'Faltam 2 dias',
      headline: 'Seu teste está acabando',
      grad: 'linear-gradient(135deg,#d97706,#b45309)',
      accent: '#d97706',
    };
  }
  return {
    badge: 'Faltam 3 dias',
    headline: 'Seu teste termina em 3 dias',
    grad: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
    accent: '#2563eb',
  };
}

export function renderTrialReminderEmail(input: TrialReminderEmailInput): RenderedEmail {
  const { firstName, daysLeft, ctaUrl, recommendedPlanLabel, recommendedAnnualMonthlyBrl } = input;
  const t = toneFor(daysLeft);
  const ended = daysLeft <= 0;

  const subject = ended
    ? 'Seu teste terminou. Escolha um plano para continuar na ZappIQ'
    : daysLeft === 1
      ? 'Falta 1 dia de teste. Garanta seu plano com 20% no anual'
      : `Faltam ${daysLeft} dias de teste. Veja o plano ideal pra você`;

  const recoBlock =
    recommendedPlanLabel && typeof recommendedAnnualMonthlyBrl === 'number'
      ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0f9ff;border:2px solid #e0f2fe;border-radius:12px;margin:24px 0;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0;font-size:12px;font-weight:700;color:#075985;text-transform:uppercase;letter-spacing:.08em;">Recomendado pra você</p>
          <p style="margin:6px 0 2px;font-size:20px;font-weight:800;color:#0c4a6e;">${escapeHtml(recommendedPlanLabel)}</p>
          <p style="margin:0;font-size:14px;color:#0369a1;">${brl(recommendedAnnualMonthlyBrl)}/mês no anual, com 20% de desconto. Escolhi esse plano pelo seu uso no teste.</p>
        </td></tr>
      </table>`
      : '';

  const bodyIntro = ended
    ? 'Seus 14 dias de teste acabaram. O acesso fica pausado até você escolher um plano. Fica tranquilo: tudo que você montou continua salvo. Os documentos, os processos, o jeito que a sua IA fala. É só voltar.'
    : `Faltam ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'} para o fim do seu teste de 14 dias. Depois disso, o acesso fica pausado até você escolher um plano. Leva dois minutos pra garantir.`;

  const html = `<!doctype html>
<html lang="pt-br">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:32px;background:${t.grad};color:#ffffff;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">${escapeHtml(t.badge)}</p>
              <p style="margin:8px 0 0;font-size:22px;font-weight:800;line-height:1.3;">${escapeHtml(t.headline)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">Oi, ${escapeHtml(firstName)}.</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#374151;">${bodyIntro}</p>
              ${recoBlock}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ecfdf5;border:2px solid #d1fae5;border-radius:12px;margin:24px 0;">
                <tr><td align="center" style="padding:20px 24px;">
                  <p style="margin:0;font-size:15px;font-weight:800;color:#065f46;">No plano anual você economiza 20%</p>
                  <p style="margin:6px 0 0;font-size:13px;color:#047857;">Mesmo produto, dois meses de graça no ano. É a opção que mais vale a pena.</p>
                </td></tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:32px 0;">
                <tr><td align="center">
                  <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:18px 36px;background:${t.accent};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:800;font-size:16px;">${ended ? 'Escolher meu plano' : 'Garantir meu plano'}</a>
                </td></tr>
              </table>
              <p style="margin:0 0 16px;font-size:12px;line-height:1.6;color:#6b7280;">Sem contratação automática. Sem surpresa no boleto. Cancela quando quiser.</p>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#6b7280;">Qualquer dúvida sobre plano, integração ou preço, responda este e-mail. Eu leio.</p>
              <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#111827;">Abraço,<br/><strong>Equipe ZappIQ</strong></p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    subject,
    '',
    `Oi, ${firstName}.`,
    '',
    bodyIntro,
    '',
    recommendedPlanLabel && typeof recommendedAnnualMonthlyBrl === 'number'
      ? `Recomendado pra você: ${recommendedPlanLabel}, ${brl(recommendedAnnualMonthlyBrl)}/mês no anual com 20% de desconto. Escolhi pelo seu uso no teste.`
      : '',
    'No plano anual você economiza 20%, dois meses de graça no ano.',
    '',
    `${ended ? 'Escolher meu plano' : 'Garantir meu plano'}: ${ctaUrl}`,
    '',
    'Sem contratação automática. Cancela quando quiser.',
    '',
    'Abraço,',
    'Equipe ZappIQ',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
