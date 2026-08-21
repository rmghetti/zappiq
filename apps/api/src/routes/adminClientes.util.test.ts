import { describe, it, expect } from 'vitest';
import {
  toUiStage,
  normalizeStage,
  computeHealthScore,
  healthColor,
  buildAccountRow,
  computeKpis,
  computeHealthBreakdown,
  computeHealthAggregate,
  isRiskRow,
  filterRowsBySpecial,
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

describe('computeHealthBreakdown', () => {
  it('conta VERDE: todas as dimensões no topo, sem playbook nem targetToGreen', () => {
    const b = computeHealthBreakdown(
      { aiReadinessScore: 100, aiMessagesProcessed: 500, grossMarginPercent: 80, stage: 'PAGO' },
      'org-green',
    );
    expect(b.total).toBe(100);
    expect(b.color).toBe('green');
    expect(b.ceilingApplied).toBeNull();
    // dimensões: adoção 0.40, uso 0.35, financeiro 0.25 — todas 100.
    expect(b.dimensions.map((d) => d.key)).toEqual(['adocao', 'uso', 'financeiro']);
    expect(b.dimensions.find((d) => d.key === 'adocao')!.weight).toBe(0.4);
    expect(b.dimensions.find((d) => d.key === 'uso')!.weight).toBe(0.35);
    expect(b.dimensions.find((d) => d.key === 'financeiro')!.weight).toBe(0.25);
    expect(b.dimensions.every((d) => d.score === 100 && d.gapPoints === 0)).toBe(true);
    expect(b.playbook).toEqual([]);
    expect(b.nextAction).toBeNull();
    expect(b.targetToGreen).toBeNull();
  });

  it('conta AMARELA: nextAction e targetToGreen apontam a dimensão de maior gap ponderado', () => {
    // adocao=60, uso=50 (250 msgs), financeiro=50 (margem 40) → total 54.
    const b = computeHealthBreakdown(
      { aiReadinessScore: 60, aiMessagesProcessed: 250, grossMarginPercent: 40, stage: 'PAGO' },
      'org-amber',
    );
    expect(b.total).toBe(54);
    expect(b.color).toBe('amber');
    expect(b.ceilingApplied).toBeNull();

    const uso = b.dimensions.find((d) => d.key === 'uso')!;
    expect(uso.score).toBe(50);
    expect(uso.contributionPoints).toBe(18); // round(50*0.35)
    expect(uso.gapPoints).toBe(18); // round(50*0.35) — maior gap ponderado

    // playbook tem um item por dimensão abaixo do ideal (3 aqui).
    expect(b.playbook).toHaveLength(3);
    expect(b.playbook.some((p) => p.dimension === 'adocao' && p.linkHref === '/admin/iza-knowledge')).toBe(true);
    expect(
      b.playbook.some((p) => p.dimension === 'uso' && p.linkHref === '/admin/iza-conversations?org=org-amber'),
    ).toBe(true);
    expect(b.playbook.some((p) => p.dimension === 'financeiro' && p.linkHref === '/admin/unit-economics')).toBe(true);

    // nextAction = maior gap ponderado (uso).
    expect(b.nextAction).toEqual({
      dimension: 'uso',
      action: 'Ativar campanha, checar conexão do WhatsApp, agendar call',
      linkHref: '/admin/iza-conversations?org=org-amber',
    });
    // targetToGreen: faltam 16 para 70; melhor ROI = uso.
    expect(b.targetToGreen).toEqual({
      pointsNeeded: 16,
      bestDimension: 'uso',
      message: 'Faltam 16 pontos para o verde. Maior ROI: Uso.',
    });
  });

  it('conta VERMELHA: score baixo, semáforo red, playbook das 3 dimensões', () => {
    const b = computeHealthBreakdown(
      { aiReadinessScore: 20, aiMessagesProcessed: 0, grossMarginPercent: -10, stage: 'PAGO' },
      'org-red',
    );
    expect(b.total).toBe(8);
    expect(b.color).toBe('red');
    expect(b.playbook).toHaveLength(3);
    // maior gap ponderado = uso (100*0.35=35).
    expect(b.nextAction!.dimension).toBe('uso');
    expect(b.targetToGreen!.bestDimension).toBe('uso');
    expect(b.targetToGreen!.pointsNeeded).toBe(62);
  });

  it('OVERLAY DE RISCO: trial expirado gera nextAction de risco + teto aplicado', () => {
    const b = computeHealthBreakdown(
      { aiReadinessScore: 100, aiMessagesProcessed: 500, grossMarginPercent: 80, stage: 'TRIAL_EXPIRADO' },
      'org-risk',
    );
    // uncapped seria 100; teto de TRIAL_EXPIRADO puxa para 45.
    expect(b.total).toBe(45);
    expect(b.ceilingApplied).toEqual({ stage: 'TRIAL_EXPIRADO', cap: 45 });
    // item de risco entra com prioridade máxima (0), no topo do playbook.
    expect(b.playbook[0]).toEqual({
      dimension: 'risco',
      diagnosis: 'Ação comercial urgente',
      action: 'Criar tarefa, atribuir dono ou fazer oferta',
      linkHref: '#owner',
      priority: 0,
    });
    // nextAction = o item de risco (ação no próprio drawer).
    expect(b.nextAction).toEqual({
      dimension: 'risco',
      action: 'Criar tarefa, atribuir dono ou fazer oferta',
      linkHref: '#owner',
    });
  });

  it('OVERLAY DE RISCO: trial vencendo em <=3 dias também dispara risco', () => {
    const b = computeHealthBreakdown(
      { aiReadinessScore: 60, aiMessagesProcessed: 250, grossMarginPercent: 40, stage: 'EM_TRIAL', trialDaysLeft: 2 },
      'org-trialend',
    );
    expect(b.nextAction!.dimension).toBe('risco');
    expect(b.playbook[0].dimension).toBe('risco');
  });

  it('conta saudável (>=70): targetToGreen null com mensagem implícita ausente', () => {
    const b = computeHealthBreakdown(
      { aiReadinessScore: 90, aiMessagesProcessed: 450, grossMarginPercent: 70, stage: 'PAGO' },
      'org-ok',
    );
    expect(b.total).toBeGreaterThanOrEqual(70);
    expect(b.targetToGreen).toBeNull();
  });
});

describe('computeHealthAggregate', () => {
  const mk = (over: Partial<AccountRawInput>): AccountRawInput => ({
    crmAccountId: null, organizationId: null, signupId: null,
    name: null, email: `${Math.random()}@x.com`, company: null, cnpj: null,
    plan: null, createdAt: NOW, ...over,
  });

  it('distribui semáforo, acha dimensão mais fraca e lista quick wins ordenados', () => {
    const rows = [
      // verde
      buildAccountRow(mk({ materializedStage: 'PAGO', aiReadinessScore: 100, aiMessagesProcessed: 500, grossMarginPercent: 80 }), NOW),
      // amber a 4 pontos do verde (total 66): adocao=90,uso=50,financeiro=40 → 36+17.5+10=63.5→64? ajusta abaixo
      buildAccountRow(mk({ materializedStage: 'PAGO', aiReadinessScore: 95, aiMessagesProcessed: 350, grossMarginPercent: 40 }), NOW),
      // vermelho: adocao=0,uso=0,financeiro=0 (nenhum sinal)
      buildAccountRow(mk({ materializedStage: 'PAGO', aiReadinessScore: 0, aiMessagesProcessed: 0, grossMarginPercent: -10 }), NOW),
      // staging não conta
      buildAccountRow(mk({ materializedStage: 'PAGO', isStaging: true, aiReadinessScore: 100, aiMessagesProcessed: 500, grossMarginPercent: 80 }), NOW),
    ];
    const agg = computeHealthAggregate(rows);

    // distribuição ignora staging (3 contas contadas).
    expect(agg.distribution.green + agg.distribution.amber + agg.distribution.red).toBe(3);
    expect(agg.distribution.green).toBeGreaterThanOrEqual(1);

    // dimensão mais fraca é uma das três com avgScore numérico.
    expect(['adocao', 'uso', 'financeiro']).toContain(agg.weakestDimension.key);
    expect(typeof agg.weakestDimension.avgScore).toBe('number');

    // quick wins: cada um está a <=10 pontos da próxima faixa e ordenado.
    for (const q of agg.quickWins) {
      expect(q.pointsToNextTier).toBeLessThanOrEqual(10);
      expect(q.pointsToNextTier).toBeGreaterThanOrEqual(0);
    }
    const efforts = agg.quickWins.map((q) => q.pointsToNextTier);
    expect(efforts).toEqual([...efforts].sort((a, b) => a - b));
  });

  it('quick wins usam organizationId OU crmAccountId (a UI abre a conta por esse id)', () => {
    const mkFull = (over: Partial<AccountRawInput>): AccountRawInput => ({
      crmAccountId: null, organizationId: null, signupId: null,
      name: null, email: `${Math.random()}@x.com`, company: null, cnpj: null,
      plan: null, createdAt: NOW, ...over,
    });
    const row = buildAccountRow(
      mkFull({ crmAccountId: 'crm-1', organizationId: 'org-1', materializedStage: 'PAGO', aiReadinessScore: 90, aiMessagesProcessed: 300, grossMarginPercent: 29 }),
      NOW,
    );
    const agg = computeHealthAggregate([row]);
    expect(agg.quickWins).toHaveLength(1);
    // a UI faz `q.organizationId || q.crmAccountId` — ambos precisam estar presentes.
    expect(agg.quickWins[0].organizationId).toBe('org-1');
    expect(agg.quickWins[0].crmAccountId).toBe('crm-1');
    expect(agg.quickWins[0].organizationId || agg.quickWins[0].crmAccountId).toBeTruthy();
  });

  it('identifica quick win amber→green a <=10 pontos', () => {
    // total 66 (amber, a 4 do verde): adocao=90(36)+uso=60(21)+financeiro=36(9)=66
    // uso 300 msgs → 60; margem 29 → round(29/80*100)=36.
    const amberRow = buildAccountRow(
      mk({ materializedStage: 'PAGO', aiReadinessScore: 90, aiMessagesProcessed: 300, grossMarginPercent: 29 }),
      NOW,
    );
    expect(amberRow.healthColor).toBe('amber');
    const agg = computeHealthAggregate([amberRow]);
    expect(agg.quickWins).toHaveLength(1);
    expect(agg.quickWins[0].nextTier).toBe('green');
    expect(agg.quickWins[0].pointsToNextTier).toBe(70 - amberRow.healthScore);
  });
});

describe('isRiskRow / filterRowsBySpecial (filtros clicáveis da Visão Geral — Fase 2)', () => {
  const mk = (over: Partial<AccountRawInput>): AccountRawInput => ({
    crmAccountId: null, organizationId: null, signupId: null,
    name: null, email: `${Math.random()}@x.com`, company: null, cnpj: null,
    plan: null, createdAt: NOW, ...over,
  });

  const rows = [
    buildAccountRow(mk({ materializedStage: 'PAGO', aiReadinessScore: 100, aiMessagesProcessed: 500, grossMarginPercent: 80 }), NOW), // verde
    buildAccountRow(mk({ materializedStage: 'PAGO', aiReadinessScore: 60, aiMessagesProcessed: 250, grossMarginPercent: 40 }), NOW), // amarela (54)
    buildAccountRow(mk({ materializedStage: 'PAGO', aiReadinessScore: 0, aiMessagesProcessed: 0, grossMarginPercent: -10 }), NOW), // vermelha
    buildAccountRow(mk({ materializedStage: 'TRIAL_EXPIRADO' }), NOW), // risco por estágio
    buildAccountRow(mk({ materializedStage: 'PAST_DUE' }), NOW), // risco por estágio
  ];

  it('isRiskRow: trial expirado, inadimplente ou health vermelho', () => {
    expect(rows.filter(isRiskRow)).toHaveLength(3); // vermelha + TRIAL_EXPIRADO + PAST_DUE
    expect(isRiskRow(rows[0])).toBe(false); // verde
    expect(isRiskRow(rows[1])).toBe(false); // amarela
  });

  it('risco = mesma contagem do KPI contasEmRisco (fonte única)', () => {
    const k = computeKpis(rows, NOW);
    expect(filterRowsBySpecial(rows, { kind: 'risk' })).toHaveLength(k.contasEmRisco);
  });

  it('filtro por cor devolve só as contas daquela faixa', () => {
    expect(filterRowsBySpecial(rows, { kind: 'color', color: 'red' }).every((r) => r.healthColor === 'red')).toBe(true);
    expect(filterRowsBySpecial(rows, { kind: 'color', color: 'green' })).toHaveLength(
      rows.filter((r) => r.healthColor === 'green').length,
    );
  });

  it("'none' devolve a lista inteira sem cópia perdida", () => {
    expect(filterRowsBySpecial(rows, { kind: 'none' })).toHaveLength(rows.length);
  });
});

describe('filtro de seed nos agregados (PR-L 20/08/2026, MRR fantasma)', () => {
  const mk = (over: Partial<AccountRawInput>): AccountRawInput => ({
    crmAccountId: null, organizationId: null, signupId: null,
    name: null, email: `${Math.random()}@x.com`, company: null, cnpj: null,
    plan: null, createdAt: NOW, ...over,
  });

  // Conta pagante REAL (Stripe) e uma seed de abril/2026 marcada como PAGO
  // com mrr fictício nos preços antigos. A seed NÃO pode somar no MRR.
  const pagante = buildAccountRow(
    mk({ organizationId: 'org-real', materializedStage: 'PAGO', mrrCents: 59700 }),
    NOW,
  );
  const seedPaga = buildAccountRow(
    mk({ organizationId: 'org-seed', materializedStage: 'PAGO', mrrCents: 199700, isSeed: true }),
    NOW,
  );
  const seedNovo = buildAccountRow(
    mk({ organizationId: 'org-seed-2', materializedStage: 'NOVO', isSeed: true }),
    NOW,
  );

  it('buildAccountRow materializa isSeed (badge da listagem)', () => {
    expect(seedPaga.isSeed).toBe(true);
    expect(seedNovo.isSeed).toBe(true);
    expect(pagante.isSeed).toBe(false);
  });

  it('org seed fica FORA do MRR real dos KPIs', () => {
    const k = computeKpis([pagante, seedPaga, seedNovo], NOW);
    // Só a pagante real soma: R$ 597,00. A seed de R$ 1.997,00 fica de fora.
    expect(k.mrrRealCents).toBe(59700);
  });

  it('seed continua VISÍVEL na listagem (não é removida como staging)', () => {
    const rows = [pagante, seedPaga, seedNovo];
    // A lista que o route devolve mantém as seeds; quem some é só o MRR delas.
    expect(rows.filter((r) => r.isSeed)).toHaveLength(2);
    const k = computeKpis(rows, NOW);
    // As seeds seguem contadas por estágio (abas da UI continuam batendo).
    expect(k.byStage.PAGO).toBe(2);
    expect(k.byStage.NOVO).toBe(1);
  });

  it('sem seeds o MRR soma normalmente (regressão)', () => {
    const k = computeKpis([pagante], NOW);
    expect(k.mrrRealCents).toBe(59700);
  });
});
