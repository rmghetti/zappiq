export interface OrgRaw {
  id: string; org_name: string; plan: string | null; isTrialActive: boolean | null;
  subscriptionStatus: string | null; owner_name: string | null; owner_email: string | null;
  conv_count: number | string; msg_count: number | string; createdAt: Date;
}
export interface SignupRaw {
  id: string; email: string; name: string | null; plan_chosen: string | null;
  status: string | null; company: string | null; cnpj: string | null;
  organization_id: string | null; utm_source: string | null; utm_medium: string | null;
  utm_campaign: string | null; created_at: Date; confirmed_at: Date | null;
}
export interface LeadRow {
  kind: 'organization' | 'signup'; id: string; name: string | null;
  ownerName: string | null; ownerEmail: string; plan: string | null;
  isTrialActive: boolean; subscriptionStatus: string | null;
  company: string | null; cnpj: string | null;
  utmSource: string | null; utmMedium: string | null; utmCampaign: string | null;
  conversationsCount: number; messagesCount: number;
  status: 'ativo' | 'cadastrado' | 'signup_only'; createdAt: string; confirmedAt: string | null;
}

const norm = (e: string | null | undefined) => (e ?? '').trim().toLowerCase();

export function combineLeadRows(orgsRaw: OrgRaw[], signups: SignupRaw[]) {
  // index de signup por email para enriquecer a org
  const signupByEmail = new Map<string, SignupRaw>();
  for (const s of signups) if (norm(s.email)) signupByEmail.set(norm(s.email), s);

  const orgEmails = new Set(orgsRaw.map((o) => norm(o.owner_email)).filter(Boolean));

  const orgRows: LeadRow[] = orgsRaw.map((o) => {
    const msgCount = Number(o.msg_count);
    const s = signupByEmail.get(norm(o.owner_email));
    return {
      kind: 'organization', id: o.id, name: o.org_name,
      ownerName: o.owner_name, ownerEmail: o.owner_email ?? '',
      plan: o.plan ?? s?.plan_chosen ?? null,
      isTrialActive: Boolean(o.isTrialActive), subscriptionStatus: o.subscriptionStatus,
      company: s?.company ?? null, cnpj: s?.cnpj ?? null,
      utmSource: s?.utm_source ?? null, utmMedium: s?.utm_medium ?? null, utmCampaign: s?.utm_campaign ?? null,
      conversationsCount: Number(o.conv_count), messagesCount: msgCount,
      status: msgCount > 0 ? 'ativo' : 'cadastrado',
      createdAt: o.createdAt.toISOString(), confirmedAt: o.createdAt.toISOString(),
    };
  });

  // signup só entra se NÃO casar com org (por email) e não tiver organization_id
  const signupRows: LeadRow[] = signups
    .filter((s) => !s.organization_id && !orgEmails.has(norm(s.email)))
    .map((s) => ({
      kind: 'signup', id: s.id, name: s.name, ownerName: s.name, ownerEmail: s.email,
      plan: s.plan_chosen, isTrialActive: false, subscriptionStatus: s.status,
      company: s.company, cnpj: s.cnpj,
      utmSource: s.utm_source, utmMedium: s.utm_medium, utmCampaign: s.utm_campaign,
      conversationsCount: 0, messagesCount: 0, status: 'signup_only',
      createdAt: s.created_at.toISOString(),
      confirmedAt: s.confirmed_at ? s.confirmed_at.toISOString() : null,
    }));

  const rows = [...orgRows, ...signupRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const summary = {
    totalLeads: rows.length,
    signupOnly: rows.filter((r) => r.status === 'signup_only').length,
    cadastrado: rows.filter((r) => r.status === 'cadastrado').length,
    ativo: rows.filter((r) => r.status === 'ativo').length,
  };
  return { rows, summary };
}
