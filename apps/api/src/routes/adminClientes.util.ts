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

  const health = computeHealthScore({
    aiReadinessScore: raw.aiReadinessScore,
    aiMessagesProcessed: raw.aiMessagesProcessed,
    grossMarginPercent: raw.grossMarginPercent,
    stage,
  });

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
