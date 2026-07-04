import { describe, it, expect } from 'vitest';
import {
  toUiStage,
  normalizeStage,
  computeHealthScore,
  healthColor,
  buildAccountRow,
  computeKpis,
  type AccountRawInput,
} from './adminClientes.util.js';

const NOW = new Date('2026-07-04T12:00:00Z');

describe('toUiStage / normalizeStage', () => {
  it('mapeia canônico EN para taxonomia UI', () => {
    expect(toUiStage('ACTIVE')).toBe('PAGO');
    expect(toUiStage('TRIAL')).toBe('EM_TRIAL');
    expect(toUiStage('TRIAL_EXPIRED')).toBe('TRIAL_EXPIRADO');
    expect(toUiStage('CHURNED')).toBe('CHURNED');
    expect(toUiStage('PAST_DUE')).toBe('PAST_DUE');
    expect(toUiStage('NOVO')).toBe('NOVO');
  });

  it('normaliza materializado (canônico ou UI) e trata ATIVO legado como PAGO', () => {
    expect(normalizeStage('ACTIVE')).toBe('PAGO');
    expect(normalizeStage('ATIVO')).toBe('PAGO');
    expect(normalizeStage('EM_TRIAL')).toBe('EM_TRIAL');
    expect(normalizeStage('trial_expired')).toBe('TRIAL_EXPIRADO');
    expect(normalizeStage(null)).toBe('NOVO');
    expect(normalizeStage('lixo')).toBe('NOVO');
  });
});

describe('computeHealthScore / healthColor', () => {
  it('combina adoção + uso + finanças ponderados', () => {
    const s = computeHealthScore({
      aiReadinessScore: 100,
      aiMessagesProcessed: 500,
      grossMarginPercent: 80,
      stage: 'PAGO',
    });
    expect(s).toBe(100);
  });

  it('aplica teto para estágios de risco (nunca verde)', () => {
    const churned = computeHealthScore({
      aiReadinessScore: 100,
      aiMessagesProcessed: 500,
      grossMarginPercent: 80,
      stage: 'CHURNED',
    });
    expect(churned).toBeLessThanOrEqual(10);

    const expired = computeHealthScore({
      aiReadinessScore: 100,
      aiMessagesProcessed: 500,
      grossMarginPercent: 80,
      stage: 'TRIAL_EXPIRADO',
    });
    expect(expired).toBeLessThanOrEqual(45);
  });

  it('semáforo por faixa', () => {
    expect(healthColor(90)).toBe('green');
    expect(healthColor(50)).toBe('amber');
    expect(healthColor(20)).toBe('red');
  });
});

describe('buildAccountRow', () => {
  it('usa estágio materializado quando presente', () => {
    const raw: AccountRawInput = {
      crmAccountId: 'a1', organizationId: 'o1', signupId: null,
      name: 'CMJ', email: 'x@cmj.com', company: 'CMJ', cnpj: '1', plan: 'SCALE',
      materializedStage: 'ACTIVE', mrrCents: 49700, createdAt: NOW,
    };
    const row = buildAccountRow(raw, NOW);
    expect(row.stage).toBe('PAGO');
    expect(row.mrrCents).toBe(49700);
  });

  it('recomputa o estágio quando não há materializado (trial ativo futuro)', () => {
    const raw: AccountRawInput = {
      crmAccountId: null, organizationId: 'o2', signupId: null,
      name: 'Lead', email: 'l@x.com', company: null, cnpj: null, plan: 'STARTER',
      isTrialActive: true,
      trialEndsAt: new Date('2026-07-10T12:00:00Z'),
      createdAt: NOW,
    };
    const row = buildAccountRow(raw, NOW);
    expect(row.stage).toBe('EM_TRIAL');
    expect(row.trialDaysLeft).toBe(6);
  });

  it('marca engaged quando há mensagens IA', () => {
    const raw: AccountRawInput = {
      crmAccountId: null, organizationId: 'o3', signupId: null,
      name: null, email: 'e@x.com', company: null, cnpj: null, plan: null,
      materializedStage: 'NOVO', aiMessagesProcessed: 12, createdAt: NOW,
    };
    expect(buildAccountRow(raw, NOW).engaged).toBe(true);
  });
});

describe('computeKpis', () => {
  const mk = (over: Partial<AccountRawInput>): AccountRawInput => ({
    crmAccountId: null, organizationId: null, signupId: null,
    name: null, email: `${Math.random()}@x.com`, company: null, cnpj: null,
    plan: null, createdAt: NOW, ...over,
  });

  it('MRR real só conta PAGO e ignora staging', () => {
    const rows = [
      buildAccountRow(mk({ materializedStage: 'PAGO', mrrCents: 49700 }), NOW),
      buildAccountRow(mk({ materializedStage: 'PAGO', mrrCents: 24700, isStaging: true }), NOW),
      buildAccountRow(mk({ materializedStage: 'EM_TRIAL', mrrCents: 99900 }), NOW),
    ];
    const k = computeKpis(rows, NOW);
    expect(k.mrrRealCents).toBe(49700); // staging + trial não entram
    expect(k.contasAtivas).toBe(1);
    expect(k.emTrial).toBe(1);
  });

  it('conta trial vencendo (<=3d) e novos leads 7d', () => {
    const rows = [
      buildAccountRow(
        mk({ materializedStage: 'EM_TRIAL', trialEndsAt: new Date('2026-07-06T12:00:00Z') }),
        NOW,
      ), // 2 dias
      buildAccountRow(
        mk({ materializedStage: 'EM_TRIAL', trialEndsAt: new Date('2026-07-20T12:00:00Z') }),
        NOW,
      ), // 16 dias
      buildAccountRow(
        mk({ materializedStage: 'NOVO', createdAt: new Date('2026-07-02T12:00:00Z') }),
        NOW,
      ),
      buildAccountRow(
        mk({ materializedStage: 'NOVO', createdAt: new Date('2026-06-01T12:00:00Z') }),
        NOW,
      ),
    ];
    const k = computeKpis(rows, NOW);
    expect(k.trialVencendo).toBe(1);
    expect(k.novosLeads7d).toBe(1);
  });

  it('contas em risco = trial expirado + past_due + health vermelho', () => {
    const rows = [
      buildAccountRow(mk({ materializedStage: 'TRIAL_EXPIRADO' }), NOW),
      buildAccountRow(mk({ materializedStage: 'PAST_DUE' }), NOW),
      buildAccountRow(mk({ materializedStage: 'PAGO', mrrCents: 100, grossMarginPercent: -50 }), NOW),
    ];
    const k = computeKpis(rows, NOW);
    expect(k.contasEmRisco).toBe(3);
  });
});
