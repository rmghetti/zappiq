/* ══════════════════════════════════════════════════════════════════════
 * adminClientes.util — lógica PURA da Área Clientes (Fase 2 / telas).
 * --------------------------------------------------------------------
 * Sem I/O: recebe dados já lidos e devolve as linhas/KPIs unificados. Assim
 * a classificação (lifecycleStage v1 → taxonomia da UI), o health score
 * composto (§3) e os KPIs (§2.3) ficam testáveis por vitest sem tocar no banco.
 *
 * Fonte de dados montada no route:
 *   - crm_accounts (fonte da verdade do CRM de plataforma, Fase 1)
 *   - organizations / tenant_usage_monthly (blocos reusados)
 *   - combineLeadRows() para dedup por email (adminLeads.util)
 *
 * Regra de ouro (§1): ATIVO/pagante exige stripeSubscriptionId real. O
 * lifecycleStage canônico já vem materializado de crm_accounts.lifecycleStage
 * (deriveLifecycleStage recomputa no cron). Aqui só MAPEAMOS os valores
 * canônicos EN para a taxonomia de UI e derivamos KPIs — sem reinventar estado.
 * ══════════════════════════════════════════════════════════════════════ */

import { deriveLifecycleStage, type LifecycleStage } from '../services/accountLifecycle.js';

/** Taxonomia da UI (§6). NOVO / EM_TRIAL / ATIVO / TRIAL_EXPIRADO / PAGO / CHURNED. */
export type UiLifecycleStage =
  | 'NOVO'
  | 'EM_TRIAL'
  | 'ATIVO'
  | 'TRIAL_EXPIRADO'
  | 'PAGO'
  | 'CHURNED'
  | 'PAST_DUE';

/**
 * Mapeia o estágio canônico (accountLifecycle) para a taxonomia exibida na UI.
 * Mantém PAST_DUE separado (inadimplente) e trata ACTIVE como PAGO (billing real).
 */
export function toUiStage(canonical: LifecycleStage): UiLifecycleStage {
  switch (canonical) {
    case 'CHURNED':
      return 'CHURNED';
    case 'PAST_DUE':
      return 'PAST_DUE';
    case 'ACTIVE':
      return 'PAGO';
    case 'TRIAL':
      return 'EM_TRIAL';
    case 'TRIAL_EXPIRED':
      return 'TRIAL_EXPIRADO';
    case 'NOVO':
    default:
      return 'NOVO';
  }
}

/** Aceita valores já materializados (canônicos ou já em taxonomia UI) e normaliza. */
export function normalizeStage(raw: string | null | undefined): UiLifecycleStage {
  const v = (raw ?? '').trim().toUpperCase();
  const uiValues: UiLifecycleStage[] = [
    'NOVO', 'EM_TRIAL', 'ATIVO', 'TRIAL_EXPIRADO', 'PAGO', 'CHURNED', 'PAST_DUE',
  ];
  if ((uiValues as string[]).includes(v)) {
    // 'ATIVO' legado == 'PAGO' na UI nova (billing real). Mantém coerência.
    return v === 'ATIVO' ? 'PAGO' : (v as UiLifecycleStage);
  }
  // valor canônico EN → mapeia.
  const canonicalValues: LifecycleStage[] = [
    'CHURNED', 'PAST_DUE', 'ACTIVE', 'TRIAL', 'TRIAL_EXPIRED', 'NOVO',
  ];
  if ((canonicalValues as string[]).includes(v)) return toUiStage(v as LifecycleStage);
  return 'NOVO';
}

// ─── Health score composto v1 (§3: w1 adoção + w2 uso + w3 financeiro) ───────
// v1 entrega w1+w2+w3 com os dados que já existem. Pesos somam 1.0.
export interface HealthInput {
  /** aiReadinessScore 0-100 (já existe na org). Adoção. */
  aiReadinessScore?: number | null;
  /** mensagens IA processadas no mês (tenant_usage_monthly). Uso. */
  aiMessagesProcessed?: number | null;
  /** margem bruta % (tenant_usage_monthly). Financeiro. */
  grossMarginPercent?: number | null;
  /** estágio atual — trial expirado / past_due / churned puxam o score pra baixo. */
  stage?: UiLifecycleStage;
}

const W_ADOPTION = 0.4;
const W_USAGE = 0.35;
const W_FINANCE = 0.25;

/** Normaliza mensagens IA para 0-100 (satura em 500 msgs/mês = uso pleno v1). */
function usageScore(msgs: number): number {
  if (msgs <= 0) return 0;
  return Math.min(100, Math.round((msgs / 500) * 100));
}

/** Margem % (pode ser negativa) → 0-100. <=0 vira 0; >=80 vira 100. */
function financeScore(marginPercent: number | null | undefined): number {
  if (marginPercent == null) return 50; // neutro quando não há dado
  if (marginPercent <= 0) return 0;
  return Math.min(100, Math.round((marginPercent / 80) * 100));
}

/**
 * Health 0-100 composto. Estágios de risco aplicam teto para nunca pintar
 * verde uma conta que está expirando/inadimplente/churn.
 */
export function computeHealthScore(input: HealthInput): number {
  const adoption = Math.max(0, Math.min(100, input.aiReadinessScore ?? 0));
  const usage = usageScore(Number(input.aiMessagesProcessed ?? 0));
  const finance = financeScore(input.grossMarginPercent);

  let score = Math.round(adoption * W_ADOPTION + usage * W_USAGE + finance * W_FINANCE);

  switch (input.stage) {
    case 'CHURNED':
      score = Math.min(score, 10);
      break;
    case 'PAST_DUE':
      score = Math.min(score, 35);
      break;
    case 'TRIAL_EXPIRADO':
      score = Math.min(score, 45);
      break;
    default:
      break;
  }
  return Math.max(0, Math.min(100, score));
}

/** Scores brutos 0-100 por dimensão (mesmas funções do score composto). */
export function healthDimensionScores(input: HealthInput): {
  adocao: number;
  uso: number;
  financeiro: number;
} {
  return {
    adocao: Math.max(0, Math.min(100, input.aiReadinessScore ?? 0)),
    uso: usageScore(Number(input.aiMessagesProcessed ?? 0)),
    financeiro: financeScore(input.grossMarginPercent),
  };
}

/** Semáforo derivado do health (verde/amarelo/vermelho). */
export function healthColor(score: number): 'green' | 'amber' | 'red' {
  if (score >= 70) return 'green';
  if (score >= 40) return 'amber';
  return 'red';
}

// ─── Linha unificada de conta (o que a Visão Geral renderiza) ────────────────
export interface ClienteAccountRow {
  /** id da crm_account (quando existe) ou fallback org/signup id. */
  crmAccountId: string | null;
  organizationId: string | null;
  signupId: string | null;
  name: string | null;
  email: string;
  company: string | null;
  cnpj: string | null;
  plan: string | null;
  stage: UiLifecycleStage;
  mrrCents: number;
  healthScore: number;
  healthColor: 'green' | 'amber' | 'red';
  /** scores brutos 0-100 por dimensão (Fase 1 — alimenta o agregado). */
  healthDimensions: { adocao: number; uso: number; financeiro: number };
  trialEndsAt: string | null;
  /** dias até o trial expirar (negativo = já expirou). null se não há trial. */
  trialDaysLeft: number | null;
  lastActivityAt: string | null;
  engaged: boolean;
  ownerUserId: string | null;
  isStaging: boolean;
  createdAt: string;
}

/** Bloco cru de conta (org OU signup) já materializado pelo route. */
export interface AccountRawInput {
  crmAccountId: string | null;
  organizationId: string | null;
  signupId: string | null;
  name: string | null;
  email: string;
  company: string | null;
  cnpj: string | null;
  plan: string | null;
  /** estágio já materializado em crm_accounts (canônico ou UI). */
  materializedStage?: string | null;
  /** sinais crus para recomputar quando não houver materializado. */
  churnedAt?: Date | string | null;
  subscriptionStatus?: string | null;
  stripeSubscriptionId?: string | null;
  trialEndsAt?: Date | string | null;
  isTrialActive?: boolean | null;
  trialConverted?: boolean | null;
  paidAt?: Date | string | null;
  mrrCents?: number | null;
  aiReadinessScore?: number | null;
  aiMessagesProcessed?: number | null;
  grossMarginPercent?: number | null;
  lastActivityAt?: Date | string | null;
  ownerUserId?: string | null;
  isStaging?: boolean;
  createdAt: Date | string;
}

function toIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Monta uma ClienteAccountRow a partir do bloco cru. Usa o estágio
 * materializado quando existe; senão recomputa via deriveLifecycleStage.
 */
export function buildAccountRow(raw: AccountRawInput, now: Date = new Date()): ClienteAccountRow {
  const stage: UiLifecycleStage = raw.materializedStage
    ? normalizeStage(raw.materializedStage)
    : toUiStage(
        deriveLifecycleStage({
          now,
          churnedAt: raw.churnedAt,
          subscriptionStatus: raw.subscriptionStatus,
          stripeSubscriptionId: raw.stripeSubscriptionId,
          trialEndsAt: raw.trialEndsAt,
          isTrialActive: raw.isTrialActive,
          trialConverted: raw.trialConverted,
          paidAt: raw.paidAt,
        }),
      );

  const healthSignals: HealthInput = {
    aiReadinessScore: raw.aiReadinessScore,
    aiMessagesProcessed: raw.aiMessagesProcessed,
    grossMarginPercent: raw.grossMarginPercent,
    stage,
  };
  const health = computeHealthScore(healthSignals);
  const healthDimensions = healthDimensionScores(healthSignals);

  const trialEnds = raw.trialEndsAt ? new Date(raw.trialEndsAt) : null;
  const trialDaysLeft =
    trialEnds && !Number.isNaN(trialEnds.getTime()) ? daysBetween(now, trialEnds) : null;

  const msgs = Number(raw.aiMessagesProcessed ?? 0);

  return {
    crmAccountId: raw.crmAccountId,
    organizationId: raw.organizationId,
    signupId: raw.signupId,
    name: raw.name,
    email: raw.email,
    company: raw.company,
    cnpj: raw.cnpj,
    plan: raw.plan,
    stage,
    mrrCents: Number(raw.mrrCents ?? 0),
    healthScore: health,
    healthColor: healthColor(health),
    healthDimensions,
    trialEndsAt: toIso(raw.trialEndsAt),
    trialDaysLeft,
    lastActivityAt: toIso(raw.lastActivityAt),
    engaged: msgs > 0,
    ownerUserId: raw.ownerUserId ?? null,
    isStaging: Boolean(raw.isStaging),
    createdAt: toIso(raw.createdAt) ?? new Date(now).toISOString(),
  };
}

// ─── KPIs da Visão Geral (§2.3 / §3) ─────────────────────────────────────────
export interface ClientesKpis {
  /** Contas em estágio PAGO (exige stripeSubscriptionId — billing real). */
  contasAtivas: number;
  /** Contas em trial. */
  emTrial: number;
  /** Subconjunto de emTrial que vence em <= 3 dias. */
  trialVencendo: number;
  /** Leads novos (NOVO) criados nos últimos 7 dias. */
  novosLeads7d: number;
  /** MRR real em centavos (soma de contas PAGO). Honesto — R$0 se ninguém paga. */
  mrrRealCents: number;
  /** Contas em risco: TRIAL_EXPIRADO + PAST_DUE + health vermelho. */
  contasEmRisco: number;
  /** Health médio (0-100) das contas não-staging. */
  healthMedio: number;
  /** Contadores por aba (taxonomia UI). */
  byStage: Record<UiLifecycleStage, number>;
}

export function computeKpis(rows: ClienteAccountRow[], now: Date = new Date()): ClientesKpis {
  const active = rows.filter((r) => !r.isStaging);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const byStage: Record<UiLifecycleStage, number> = {
    NOVO: 0, EM_TRIAL: 0, ATIVO: 0, TRIAL_EXPIRADO: 0, PAGO: 0, CHURNED: 0, PAST_DUE: 0,
  };
  for (const r of active) byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;

  const emTrial = active.filter((r) => r.stage === 'EM_TRIAL');
  const trialVencendo = emTrial.filter(
    (r) => r.trialDaysLeft != null && r.trialDaysLeft >= 0 && r.trialDaysLeft <= 3,
  ).length;

  const novosLeads7d = active.filter(
    (r) => r.stage === 'NOVO' && new Date(r.createdAt) >= sevenDaysAgo,
  ).length;

  const mrrRealCents = active
    .filter((r) => r.stage === 'PAGO')
    .reduce((sum, r) => sum + (r.mrrCents ?? 0), 0);

  const contasEmRisco = active.filter(
    (r) => r.stage === 'TRIAL_EXPIRADO' || r.stage === 'PAST_DUE' || r.healthColor === 'red',
  ).length;

  const healthMedio =
    active.length === 0
      ? 0
      : Math.round(active.reduce((sum, r) => sum + r.healthScore, 0) / active.length);

  return {
    contasAtivas: byStage.PAGO,
    emTrial: emTrial.length,
    trialVencendo,
    novosLeads7d,
    mrrRealCents,
    contasEmRisco,
    healthMedio,
    byStage,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Motor de Health estratégico (Fase 1) — breakdown por dimensão + playbook.
// ─────────────────────────────────────────────────────────────────────────
// PURO/testável. Reusa a MESMA matemática de computeHealthScore (adoção 0.40,
// uso 0.35 saturando em 500 msgs, financeiro 0.25 via margem bruta) e os tetos
// de risco. Em cima disso gera diagnóstico acionável: para cada dimensão fraca
// um item de playbook, um overlay de risco comercial quando o lifecycle pede,
// a próxima ação (risco > maior gap ponderado) e o alvo para virar verde (>=70)
// com o maior ROI. Aditivo — não altera os campos existentes das respostas.
// ═══════════════════════════════════════════════════════════════════════════

/** Limite para "verde" (conta saudável). Espelha healthColor(). */
const GREEN_THRESHOLD = 70;

/** Tetos de risco por estágio (espelham computeHealthScore). */
const RISK_CEILINGS: Partial<Record<UiLifecycleStage, number>> = {
  CHURNED: 10,
  PAST_DUE: 35,
  TRIAL_EXPIRADO: 45,
};

/** Chave de dimensão do health. */
export type HealthDimensionKey = 'adocao' | 'uso' | 'financeiro';

export interface HealthDimension {
  key: HealthDimensionKey;
  label: string;
  /** score bruto da dimensão 0-100. */
  score: number;
  /** peso (0-1). */
  weight: number;
  /** pontos que a dimensão contribui ao total (score*peso, arredondado). */
  contributionPoints: number;
  /** pontos que faltam nessa dimensão ((100-score)*peso, arredondado). */
  gapPoints: number;
}

export interface HealthPlaybookItem {
  dimension: HealthDimensionKey | 'risco';
  diagnosis: string;
  action: string;
  linkHref: string;
  /** menor = mais urgente. Risco = 0 (prioridade máxima). */
  priority: number;
}

export interface HealthNextAction {
  dimension: HealthPlaybookItem['dimension'];
  action: string;
  linkHref: string;
}

export interface HealthTargetToGreen {
  /** pontos que faltam para chegar a 70. */
  pointsNeeded: number;
  /** dimensão melhorável com maior gap ponderado (maior ROI). */
  bestDimension: HealthDimensionKey;
  message: string;
}

export interface HealthBreakdown {
  total: number;
  color: 'green' | 'amber' | 'red';
  /** teto de risco aplicado (quando o estágio limitou o score). */
  ceilingApplied: { stage: UiLifecycleStage; cap: number } | null;
  dimensions: HealthDimension[];
  playbook: HealthPlaybookItem[];
  nextAction: HealthNextAction | null;
  targetToGreen: HealthTargetToGreen | null;
}

const DIMENSION_LABEL: Record<HealthDimensionKey, string> = {
  adocao: 'Adoção',
  uso: 'Uso',
  financeiro: 'Financeiro',
};

const DIMENSION_WEIGHT: Record<HealthDimensionKey, number> = {
  adocao: W_ADOPTION,
  uso: W_USAGE,
  financeiro: W_FINANCE,
};

/** Diagnóstico/ação de playbook por dimensão fraca (regras do playbook §Fase1). */
function playbookForDimension(key: HealthDimensionKey, orgId: string | null): HealthPlaybookItem {
  switch (key) {
    case 'adocao':
      return {
        dimension: 'adocao',
        diagnosis: 'IA pouco treinada/configurada',
        action: 'Completar base de conhecimento e revisar respostas',
        linkHref: '/admin/iza-knowledge',
        priority: 2,
      };
    case 'uso':
      return {
        dimension: 'uso',
        diagnosis: 'Cliente quase não usa a Iza',
        action: 'Ativar campanha, checar conexão do WhatsApp, agendar call',
        linkHref: orgId
          ? `/admin/iza-conversations?org=${orgId}`
          : '/admin/iza-conversations',
        priority: 2,
      };
    case 'financeiro':
      return {
        dimension: 'financeiro',
        diagnosis: 'Margem apertada (custo de LLM vs plano)',
        action: 'Revisar plano e otimizar modelo/prompt',
        linkHref: '/admin/unit-economics',
        priority: 2,
      };
  }
}

/** Trial vencendo em <=3 dias conta como gatilho de risco comercial. */
function isRiskStage(stage: UiLifecycleStage | undefined, trialDaysLeft: number | null): boolean {
  if (stage === 'CHURNED' || stage === 'PAST_DUE' || stage === 'TRIAL_EXPIRADO') return true;
  if (trialDaysLeft != null && trialDaysLeft >= 0 && trialDaysLeft <= 3) return true;
  return false;
}

export interface HealthBreakdownInput extends HealthInput {
  /** dias até o trial expirar (usado no overlay de risco — trial vencendo <=3d). */
  trialDaysLeft?: number | null;
}

/**
 * computeHealthBreakdown — decompõe o health de UMA conta em dimensões +
 * playbook acionável. Reusa a matemática de computeHealthScore (mesmos pesos,
 * mesma saturação de uso, mesma pontuação de margem, MESMOS tetos de risco).
 */
export function computeHealthBreakdown(
  input: HealthBreakdownInput,
  orgId: string | null,
): HealthBreakdown {
  // — scores brutos por dimensão (mesmas funções do score composto) —
  const adocaoScore = Math.max(0, Math.min(100, input.aiReadinessScore ?? 0));
  const usoScore = usageScore(Number(input.aiMessagesProcessed ?? 0));
  const financeiroScore = financeScore(input.grossMarginPercent);

  const rawByKey: Record<HealthDimensionKey, number> = {
    adocao: adocaoScore,
    uso: usoScore,
    financeiro: financeiroScore,
  };

  const dimensions: HealthDimension[] = (['adocao', 'uso', 'financeiro'] as HealthDimensionKey[]).map(
    (key) => {
      const score = rawByKey[key];
      const weight = DIMENSION_WEIGHT[key];
      return {
        key,
        label: DIMENSION_LABEL[key],
        score,
        weight,
        contributionPoints: Math.round(score * weight),
        gapPoints: Math.round((100 - score) * weight),
      };
    },
  );

  // — total (idêntico a computeHealthScore, incl. teto de risco) —
  const total = computeHealthScore({
    aiReadinessScore: input.aiReadinessScore,
    aiMessagesProcessed: input.aiMessagesProcessed,
    grossMarginPercent: input.grossMarginPercent,
    stage: input.stage,
  });
  const color = healthColor(total);

  const cap = input.stage ? RISK_CEILINGS[input.stage] : undefined;
  // teto só "aplica" quando de fato limitou o score composto.
  const uncappedTotal = Math.round(
    adocaoScore * W_ADOPTION + usoScore * W_USAGE + financeiroScore * W_FINANCE,
  );
  const ceilingApplied =
    cap != null && uncappedTotal > cap && input.stage
      ? { stage: input.stage, cap }
      : null;

  // — playbook: um item por dimensão ABAIXO do ideal (score < 100) —
  const playbook: HealthPlaybookItem[] = dimensions
    .filter((d) => d.score < 100)
    .map((d) => playbookForDimension(d.key, orgId));

  // — overlay de risco comercial (prioridade máxima) —
  const riskItem: HealthPlaybookItem | null = isRiskStage(input.stage, input.trialDaysLeft ?? null)
    ? {
        dimension: 'risco',
        diagnosis: 'Ação comercial urgente',
        action: 'Criar tarefa, atribuir dono ou fazer oferta',
        linkHref: '#owner',
        priority: 0,
      }
    : null;
  if (riskItem) playbook.unshift(riskItem);

  playbook.sort((a, b) => a.priority - b.priority);

  // — dimensão com maior GAP PONDERADO entre as melhoráveis (score < 100) —
  const improvable = dimensions.filter((d) => d.score < 100);
  const worst = improvable.reduce<HealthDimension | null>(
    (acc, d) => (acc == null || d.gapPoints > acc.gapPoints ? d : acc),
    null,
  );

  // — nextAction: risco se existir; senão a dimensão de maior gap ponderado —
  let nextAction: HealthNextAction | null = null;
  if (riskItem) {
    nextAction = { dimension: riskItem.dimension, action: riskItem.action, linkHref: riskItem.linkHref };
  } else if (worst) {
    const item = playbookForDimension(worst.key, orgId);
    nextAction = { dimension: item.dimension, action: item.action, linkHref: item.linkHref };
  }

  // — targetToGreen: pontos até 70 + dimensão de maior ROI (maior gap ponderado) —
  let targetToGreen: HealthTargetToGreen | null = null;
  if (total >= GREEN_THRESHOLD) {
    targetToGreen = null;
  } else if (worst) {
    targetToGreen = {
      pointsNeeded: GREEN_THRESHOLD - total,
      bestDimension: worst.key,
      message: `Faltam ${GREEN_THRESHOLD - total} pontos para o verde. Maior ROI: ${DIMENSION_LABEL[worst.key]}.`,
    };
  }

  return {
    total,
    color,
    ceilingApplied,
    dimensions,
    playbook,
    nextAction,
    targetToGreen,
  };
}

// ─── Agregado de health da carteira (Visão Geral) ────────────────────────────
export interface HealthAggregate {
  distribution: { green: number; amber: number; red: number };
  weakestDimension: { key: HealthDimensionKey; label: string; avgScore: number };
  /** contas a <=10 pontos de subir de faixa (amber→green ou red→amber). */
  quickWins: Array<{
    crmAccountId: string | null;
    organizationId: string | null;
    name: string | null;
    healthScore: number;
    color: 'green' | 'amber' | 'red';
    /** pontos que faltam para a próxima faixa (menor = menos esforço). */
    pointsToNextTier: number;
    nextTier: 'green' | 'amber';
  }>;
}

/**
 * computeHealthAggregate — retrato da carteira: distribuição do semáforo, a
 * dimensão mais fraca em média (onde investir primeiro) e os "quick wins"
 * (contas a <=10 pontos de subir de faixa), ordenados por menor esforço.
 * Recebe as MESMAS linhas da lista (ClienteAccountRow) — não recomputa I/O.
 */
export function computeHealthAggregate(rows: ClienteAccountRow[]): HealthAggregate {
  const scored = rows.filter((r) => !r.isStaging);

  const distribution = { green: 0, amber: 0, red: 0 };
  for (const r of scored) distribution[r.healthColor] += 1;

  // Dimensão mais fraca: menor média dos scores brutos por dimensão (adoção /
  // uso / financeiro), lidos direto da row (buildAccountRow já os materializou).
  // É a dimensão onde investir primeiro para elevar a carteira inteira.
  const keys: HealthDimensionKey[] = ['adocao', 'uso', 'financeiro'];
  const avgByKey: Record<HealthDimensionKey, number> = { adocao: 0, uso: 0, financeiro: 0 };
  for (const key of keys) {
    avgByKey[key] =
      scored.length === 0
        ? 0
        : Math.round(scored.reduce((s, r) => s + (r.healthDimensions?.[key] ?? 0), 0) / scored.length);
  }
  const weakestKey = keys.reduce((worst, key) => (avgByKey[key] < avgByKey[worst] ? key : worst), keys[0]);
  const weakestDimension = {
    key: weakestKey,
    label: DIMENSION_LABEL[weakestKey],
    avgScore: avgByKey[weakestKey],
  };

  // Quick wins: contas a <=10 pontos de subir de faixa.
  //   red (<40) → falta (40 - score) para amber
  //   amber (<70) → falta (70 - score) para green
  const quickWins = scored
    .map((r) => {
      let pointsToNextTier = Infinity;
      let nextTier: 'green' | 'amber' | null = null;
      if (r.healthColor === 'red') {
        pointsToNextTier = 40 - r.healthScore;
        nextTier = 'amber';
      } else if (r.healthColor === 'amber') {
        pointsToNextTier = GREEN_THRESHOLD - r.healthScore;
        nextTier = 'green';
      }
      return { r, pointsToNextTier, nextTier };
    })
    .filter((x) => x.nextTier != null && x.pointsToNextTier <= 10 && x.pointsToNextTier >= 0)
    .sort((a, b) => a.pointsToNextTier - b.pointsToNextTier)
    .map((x) => ({
      crmAccountId: x.r.crmAccountId,
      organizationId: x.r.organizationId,
      name: x.r.name,
      healthScore: x.r.healthScore,
      color: x.r.healthColor,
      pointsToNextTier: x.pointsToNextTier,
      nextTier: x.nextTier as 'green' | 'amber',
    }));

  return { distribution, weakestDimension, quickWins };
}
