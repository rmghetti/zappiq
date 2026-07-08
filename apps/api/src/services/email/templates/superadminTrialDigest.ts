/**
 * Template · digest diário ao superadmin (ação proativa de conversão).
 * Lista orgs a ≤3 dias do fim do trial + orgs com a carência acabando, para o
 * CEO agir antes de perder o cliente. E-mail interno (founders@), tom direto.
 */

export interface SuperadminDigestEntry {
  orgName: string;
  orgId: string;
  reason: 'trial_ending' | 'grace_ending';
  daysLeft: number;
  adminName: string | null;
  adminEmail: string | null;
  adminPhone: string | null;
  recommendedPlanLabel: string | null;
  recommendedAnnualMonthlyBrl: number | null;
  usageSummary: string | null; // ex.: "~1.2k msgs/mês, 340 contatos, 2 atendentes"
}

export interface SuperadminDigestInput {
  dateLabel: string; // ex.: "06/07/2026"
  entries: SuperadminDigestEntry[];
  dashboardUrl: string;
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

function reasonLabel(r: SuperadminDigestEntry['reason'], daysLeft: number): string {
  if (r === 'grace_ending') {
    return `Carência acabando (${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'})`;
  }
  return daysLeft <= 0 ? 'Vence hoje' : `Faltam ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}`;
}

export function renderSuperadminTrialDigestEmail(input: SuperadminDigestInput): RenderedEmail {
  const { dateLabel, entries, dashboardUrl } = input;
  const n = entries.length;
  const subject =
    n === 0
      ? `Digest trials ${dateLabel}: nenhuma org precisa de ação hoje`
      : `Digest trials ${dateLabel}: ${n} ${n === 1 ? 'org precisa' : 'orgs precisam'} de ação`;

  const rows = entries
    .map((e) => {
      const contato = [e.adminName, e.adminEmail, e.adminPhone].filter(Boolean).map((x) => escapeHtml(String(x))).join(' · ') || 'sem contato';
      const reco =
        e.recommendedPlanLabel && e.recommendedAnnualMonthlyBrl != null
          ? `${escapeHtml(e.recommendedPlanLabel)} (R$ ${e.recommendedAnnualMonthlyBrl.toLocaleString('pt-BR')}/mês anual)`
          : 'n/d';
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:700;">${escapeHtml(e.orgName)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;">${reasonLabel(e.reason, e.daysLeft)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;">${contato}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;">${escapeHtml(e.usageSummary ?? 'n/d')}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;">${reco}</td>
        </tr>`;
    })
    .join('');

  const html = `<!doctype html>
<html lang="pt-br"><head><meta charset="utf-8" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
  <div style="max-width:760px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="padding:20px 24px;background:#111827;color:#fff;">
      <p style="margin:0;font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.8;">Digest de trials · ${escapeHtml(dateLabel)}</p>
      <p style="margin:6px 0 0;font-size:20px;font-weight:800;">${n} ${n === 1 ? 'org precisa' : 'orgs precisam'} de ação proativa</p>
    </div>
    <div style="padding:20px 24px;">
      ${n === 0
        ? '<p style="font-size:15px;color:#374151;">Nenhuma org a ≤3 dias do fim do trial nem com carência acabando hoje. Nada a fazer.</p>'
        : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px;">
             <thead><tr style="text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;">
               <th style="padding:8px 12px;">Org</th><th style="padding:8px 12px;">Status</th><th style="padding:8px 12px;">Contato</th><th style="padding:8px 12px;">Uso</th><th style="padding:8px 12px;">Recomendado</th>
             </tr></thead>
             <tbody>${rows}</tbody>
           </table>`}
      <p style="margin:24px 0 0;"><a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:12px 20px;background:#6d28d9;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Abrir Clientes no dashboard</a></p>
    </div>
  </div>
</body></html>`;

  const textLines = [
    subject,
    '',
    ...entries.map(
      (e) =>
        `• ${e.orgName} — ${reasonLabel(e.reason, e.daysLeft)} — ${[e.adminName, e.adminEmail, e.adminPhone].filter(Boolean).join(' · ') || 'sem contato'}` +
        (e.recommendedPlanLabel ? ` — recomendado: ${e.recommendedPlanLabel}` : ''),
    ),
    '',
    `Dashboard: ${dashboardUrl}`,
  ];

  return { subject, html, text: textLines.join('\n') };
}
