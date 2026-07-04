import { describe, it, expect } from 'vitest';
import { combineLeadRows } from './adminLeads.util.js';

const org = {
  id: 'org1', org_name: 'CMJ', plan: 'SCALE', isTrialActive: true,
  subscriptionStatus: null, owner_name: 'Gustavo', owner_email: 'Gustavo@CMJ.com.br',
  conv_count: 0, msg_count: 0, createdAt: new Date('2026-06-27T13:00:00Z'),
};
const signupMatched = {
  id: 's1', email: 'gustavo@cmj.com.br', name: 'Gustavo Succi', plan_chosen: 'SCALE',
  status: 'active', company: 'CMJ', cnpj: '123', organization_id: null,
  utm_source: 'google', utm_medium: null, utm_campaign: null,
  created_at: new Date('2026-06-27T12:59:00Z'), confirmed_at: new Date('2026-06-27T13:04:00Z'),
};
const signupOrphan = { ...signupMatched, id: 's2', email: 'novo@lead.com', company: 'Lead', cnpj: null };

describe('combineLeadRows', () => {
  it('não duplica: signup casado por email (case-insensitive) não vira linha separada', () => {
    const { rows } = combineLeadRows([org], [signupMatched, signupOrphan]);
    const emails = rows.map((r) => r.ownerEmail.toLowerCase());
    expect(rows).toHaveLength(2); // 1 org + 1 signup órfão
    expect(emails.filter((e) => e === 'gustavo@cmj.com.br')).toHaveLength(1);
  });

  it('enriquece a linha de org com company/cnpj/utm do signup casado', () => {
    const { rows } = combineLeadRows([org], [signupMatched]);
    const orgRow = rows.find((r) => r.kind === 'organization')!;
    expect(orgRow.company).toBe('CMJ');
    expect(orgRow.cnpj).toBe('123');
    expect(orgRow.utmSource).toBe('google');
  });

  it('signup órfão (sem org casada) permanece como lead novo', () => {
    const { rows, summary } = combineLeadRows([org], [signupOrphan]);
    const orphan = rows.find((r) => r.ownerEmail === 'novo@lead.com')!;
    expect(orphan.kind).toBe('signup');
    expect(summary.totalLeads).toBe(2);
  });
});
