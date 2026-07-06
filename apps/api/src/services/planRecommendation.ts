/* ══════════════════════════════════════════════════════════════════════
 * planRecommendation — recomenda o plano mais adequado pelo perfil de uso.
 * --------------------------------------------------------------------
 * Usado na paywall (fim do trial) e no digest ao superadmin. Regra:
 *   1. Piso = plano que a pessoa TESTOU (legado mapeado pro V4 mais próximo).
 *      Nunca recomenda abaixo do que ela já validou.
 *   2. Menor plano ≥ piso onde o uso projetado cabe.
 *   3. Estouro pequeno (≤50% acima, ≤2 dimensões) → mantém o plano e sugere
 *      um ADDON pontual, em vez de forçar um tier acima (mais barato pra pessoa).
 *   4. cycle sempre 'annual' — empurramos o anual (20% off).
 * ══════════════════════════════════════════════════════════════════════ */
import { prisma } from '@zappiq/database';
import {
  PLAN_CONFIG,
  planAnnualMonthlyEquivalent,
  type PlanId,
} from '@zappiq/shared';
import { logger } from '../utils/logger.js';

/** Uso mensal (projetado) que alimenta a recomendação. */
export interface UsageProfile {
  aiMessages: number;
  contacts: number;
  agents: number;
  broadcasts: number;
}

export type V4PlanId = 'IZA_LITE' | 'GROWTH' | 'SCALE';

export interface AddonSuggestion {
  dimension: keyof UsageProfile;
  label: string;
}

export interface PlanRecommendation {
  planId: V4PlanId;
  planLabel: string;
  cycle: 'annual';
  monthlyBrl: number;
  annualMonthlyBrl: number;
  /** Economia no 1º ano ao escolher anual em vez de mensal (R$). */
  annualSavingsBrl: number;
  reasons: string[];
  addonSuggestions: AddonSuggestion[];
}

const V4_ORDER: V4PlanId[] = ['IZA_LITE', 'GROWTH', 'SCALE'];
const LABELS: Record<V4PlanId, string> = { IZA_LITE: 'Lite', GROWTH: 'Growth', SCALE: 'Scale' };

// dimensão de uso → campo do PlanLimits + rótulo humano do addon
const DIM_TO_LIMIT: Record<keyof UsageProfile, 'aiMessagesPerMonth' | 'contacts' | 'agents' | 'broadcastsPerMonth'> = {
  aiMessages: 'aiMessagesPerMonth',
  contacts: 'contacts',
  agents: 'agents',
  broadcasts: 'broadcastsPerMonth',
};
const DIM_ADDON_LABEL: Record<keyof UsageProfile, string> = {
  aiMessages: 'Pacote de mensagens de IA',
  contacts: 'Pacote de contatos',
  agents: 'Atendente extra (assento)',
  broadcasts: 'Pacote de disparos',
};

const HEADROOM_ADDON_FACTOR = 1.5; // até 50% acima do limite ainda é addon, não upgrade
const MAX_ADDON_DIMS = 2;

/** Mapeia qualquer plano (inclusive legado) para o V4 que serve de PISO. */
export function mapLegacyToV4(plan: string | null | undefined): V4PlanId {
  switch (plan) {
    case 'GROWTH':
      return 'GROWTH';
    case 'SCALE':
    case 'BUSINESS':
    case 'ENTERPRISE':
      return 'SCALE';
    case 'IZA_LITE':
    case 'STARTER':
    default:
      return 'IZA_LITE';
  }
}

function overflowingDims(usage: UsageProfile, planId: V4PlanId): (keyof UsageProfile)[] {
  const limits = PLAN_CONFIG[planId].limits;
  return (Object.keys(DIM_TO_LIMIT) as (keyof UsageProfile)[]).filter((dim) => {
    const limit = limits[DIM_TO_LIMIT[dim]];
    return limit !== -1 && usage[dim] > limit;
  });
}

function coverableByAddon(usage: UsageProfile, planId: V4PlanId, over: (keyof UsageProfile)[]): boolean {
  const limits = PLAN_CONFIG[planId].limits;
  return (
    over.length > 0 &&
    over.length <= MAX_ADDON_DIMS &&
    over.every((dim) => {
      const limit = limits[DIM_TO_LIMIT[dim]];
      return limit !== -1 && usage[dim] <= limit * HEADROOM_ADDON_FACTOR;
    })
  );
}

function priceOf(planId: V4PlanId): { monthlyBrl: number; annualMonthlyBrl: number; annualSavingsBrl: number } {
  const cfg = PLAN_CONFIG[planId];
  const monthlyBrl = cfg.priceMonthly ?? 0;
  const annualMonthlyBrl = planAnnualMonthlyEquivalent(cfg) ?? monthlyBrl;
  const annualSavingsBrl = Math.round((monthlyBrl - annualMonthlyBrl) * 12);
  return { monthlyBrl, annualMonthlyBrl, annualSavingsBrl };
}

function buildResult(
  planId: V4PlanId,
  usage: UsageProfile,
  addonDims: (keyof UsageProfile)[],
): PlanRecommendation {
  const price = priceOf(planId);
  const reasons: string[] = [];
  reasons.push(`No teste você projetou cerca de ${usage.aiMessages.toLocaleString('pt-BR')} mensagens de IA por mês.`);
  if (addonDims.length === 0) {
    reasons.push(`Seu uso cabe confortavelmente no ${LABELS[planId]}.`);
  } else {
    reasons.push(`Seu uso cabe no ${LABELS[planId]} com um addon pontual, mais econômico que subir de plano.`);
  }
  reasons.push(`No plano anual você economiza R$ ${price.annualSavingsBrl.toLocaleString('pt-BR')} no primeiro ano.`);
  return {
    planId,
    planLabel: LABELS[planId],
    cycle: 'annual',
    ...price,
    reasons,
    addonSuggestions: addonDims.map((dim) => ({ dimension: dim, label: DIM_ADDON_LABEL[dim] })),
  };
}

/**
 * Recomenda plano V4 (função pura). `testedPlan` é o plano que a org testou.
 */
export function recommendPlan(usage: UsageProfile, testedPlan: string | null | undefined): PlanRecommendation {
  const floor = mapLegacyToV4(testedPlan);
  const floorIdx = V4_ORDER.indexOf(floor);

  for (let i = floorIdx; i < V4_ORDER.length; i++) {
    const planId = V4_ORDER[i];
    const over = overflowingDims(usage, planId);
    if (over.length === 0) {
      return buildResult(planId, usage, []); // cabe folgado
    }
    const isLast = i === V4_ORDER.length - 1;
    if (coverableByAddon(usage, planId, over) || isLast) {
      // estouro pequeno (ou já é o topo): mantém o plano e cobre com addon
      return buildResult(planId, usage, over);
    }
    // estouro grande e há plano maior disponível → tenta o próximo tier
  }

  // fallback defensivo (nunca deve cair aqui)
  return buildResult('SCALE', usage, overflowingDims(usage, 'SCALE'));
}

// ── Leitura de uso real (impura) ───────────────────────────────────────
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Lê o uso real da org e projeta para um mês cheio (o trial tem só 14 dias, então
 * projetamos volume; contatos/atendentes são cumulativos e não se projetam).
 */
export async function buildRecommendation(orgId: string): Promise<PlanRecommendation> {
  try {
    const [org, contacts, agents, usageRow] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { plan: true, trialStartedAt: true, createdAt: true },
      }),
      prisma.contact.count({ where: { organizationId: orgId } }),
      prisma.user.count({ where: { organizationId: orgId } }),
      prisma.tenantUsageMonthly.findFirst({
        where: { organizationId: orgId },
        orderBy: { periodYearMonth: 'desc' },
        select: { aiMessagesProcessed: true, broadcastsSent: true },
      }),
    ]);

    const startedAt = org?.trialStartedAt ?? org?.createdAt ?? new Date();
    const daysActive = Math.max(1, Math.min(30, Math.ceil((Date.now() - new Date(startedAt).getTime()) / MS_PER_DAY)));
    const projFactor = 30 / daysActive;

    const usage: UsageProfile = {
      aiMessages: Math.round((usageRow?.aiMessagesProcessed ?? 0) * projFactor),
      broadcasts: Math.round((usageRow?.broadcastsSent ?? 0) * projFactor),
      contacts, // cumulativo
      agents, // cumulativo
    };

    return recommendPlan(usage, org?.plan ?? 'IZA_LITE');
  } catch (err) {
    logger.warn({ msg: 'buildRecommendation_failed_fallback', orgId, err: String(err) });
    // Fallback seguro: recomenda o Lite anual (nunca quebra a paywall).
    return recommendPlan({ aiMessages: 0, contacts: 0, agents: 1, broadcasts: 0 }, 'IZA_LITE');
  }
}
