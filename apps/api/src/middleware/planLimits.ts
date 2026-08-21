import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { PLAN_CONFIG, applyAddonGrants, type PlanId, type PlanLimits } from '@zappiq/shared';
import { cache } from '../services/cloud/index.js';
import { logger } from '../utils/logger.js';
import { reportOverageMeterEvent, estimateOverageBrl } from '../services/quotaOverageService.js';
import { env } from '../config/env.js';
import { isZappIQOrg } from '../config/zappiqOrg.js';

// PR #V4-005.3: migrado de redis direto pra abstração cloud-agnostic (cache).
// cache.incrby / cache.incrbyfloat / cache.get / cache.expire são fail-soft
// por contrato — null/false em erro de backend, não throw.

/*
 * ═════════════════════════════════════════════════════════════════
 * Plan Limits Enforcement
 * ─────────────────────────────────────────────────────────────────
 * Middleware que valida, antes de operações consumíveis, se o
 * tenant ainda tem quota no ciclo mensal corrente.
 *
 * Princípios:
 * - Soft-fail para GETs (nunca bloqueia leitura).
 * - Hard-fail para POSTs que geram custo (agent reply, broadcast,
 *   upload de doc RAG, criação de fluxo).
 * - Trial: aplica cap de custo em USD adicional ao limite do plano.
 * - Contadores em Redis com TTL de 35 dias (cobre ciclo + grace).
 * - Planos com limite -1 (ilimitado) sempre passam.
 * ═════════════════════════════════════════════════════════════════
 */

export type LimitKind =
  | 'agents'
  | 'aiMessagesPerMonth'
  // Resposta Meta out/2026 — unidade "atendimento de IA" em SOMBRA: só
  // medição (não existe em PlanLimits, nunca é enforced, nunca bloqueia).
  | 'aiAttendancesPerMonth'
  | 'broadcastsPerMonth'
  | 'contacts'
  | 'flows'
  | 'whatsappNumbers'
  | 'knowledgeBaseDocs';

// Chaves de métrica persistidas em Redis por ciclo.
// Formato: zappiq:usage:{orgId}:{yyyy-mm}:{kind}
function usageKey(orgId: string, kind: LimitKind): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `zappiq:usage:${orgId}:${ym}:${kind}`;
}

// TTL: 35 dias (cobre transição de mês com grace period).
const TTL_SECONDS = 35 * 24 * 3600;

export async function incrementUsage(
  orgId: string,
  kind: LimitKind,
  amount = 1,
): Promise<number> {
  const key = usageKey(orgId, kind);
  const current = await cache.incrby(key, amount);
  if (current === null) {
    // cache.incrby já logou warning. Fail-soft: prefere servir a bloquear.
    return 0;
  }
  // Set TTL apenas na primeira criação (contador igual ao increment = novo).
  if (current === amount) {
    await cache.expire(key, TTL_SECONDS);
  }
  return current;
}

export async function getUsage(orgId: string, kind: LimitKind): Promise<number> {
  const raw = await cache.get(usageKey(orgId, kind));
  return raw ? parseInt(raw, 10) : 0;
}

/*
 * ─────────────────────────────────────────────────────────────────
 * Resposta Meta out/2026 — metering SOMBRA da unidade "atendimento de IA".
 *
 * 1 atendimento = 1 conversa que recebeu resposta da IA, com fair use de 12
 * respostas: da 13ª resposta em diante abre uma "parte" nova da mesma
 * conversa, contada como novo atendimento (13..24 → parte 2, 25..36 → parte
 * 3, e assim por diante).
 *
 * SOMBRA PURA: alimenta contadores pra calibrar o preço da unidade nova.
 * Nunca bloqueia, nunca alerta, nunca lança. As chaves seguem a mesma
 * convenção usada pelo webChatService (marcador `zappiq:att:{org}:{conv}` e
 * contador mensal via usageKey), então os dois canais somam no mesmo lugar.
 * ─────────────────────────────────────────────────────────────────
 */

/** TTL das chaves por conversa (marcador e contador de respostas): 90 dias. */
const ATTENDANCE_TTL_SECONDS = 90 * 24 * 3600;

/** Fair use: respostas de IA por atendimento antes de abrir parte nova. */
export const ATTENDANCE_FAIR_USE_REPLIES = 12;

export async function recordAttendanceShadow(
  orgId: string,
  conversationId: string,
): Promise<void> {
  try {
    // 1) Conta a resposta de IA desta conversa (INCR; TTL só na criação).
    const repliesKey = `zappiq:attreplies:${conversationId}`;
    const replies = await cache.incrby(repliesKey, 1);
    if (replies === null) return; // backend fora do ar — sombra não insiste
    if (replies === 1) {
      await cache.expire(repliesKey, ATTENDANCE_TTL_SECONDS);
    }

    // 2) Parte corrente pelo fair use. A parte 1 usa a chave base (mesma do
    // webChatService); da 2ª em diante entra o sufixo `:N`. Manter a chave da
    // parte anterior no lugar (em vez de apagar e recriar) impede a mesma
    // parte de ser contada duas vezes.
    const part = Math.ceil(replies / ATTENDANCE_FAIR_USE_REPLIES);
    const baseKey = `zappiq:att:${orgId}:${conversationId}`;
    const attKey = part === 1 ? baseKey : `${baseKey}:${part}`;

    // 3) SET NX: só a PRIMEIRA resposta de cada parte cria o marcador e
    // incrementa o contador mensal. `false` (já existia) e `null` (erro de
    // backend) não contam — em sombra, subcontar é melhor que duplicar.
    const created = await cache.setNX(attKey, '1', ATTENDANCE_TTL_SECONDS);
    if (created === true) {
      await incrementUsage(orgId, 'aiAttendancesPerMonth');
    }
  } catch (err: any) {
    // Sombra pura: erro aqui jamais toca a resposta da IA.
    logger.warn(
      `[planLimits] recordAttendanceShadow falhou org=${orgId} conv=${conversationId}: ${err?.message ?? err}`,
    );
  }
}

/**
 * Carrega o plano efetivo do tenant, considerando estado de trial.
 * Durante trial: o tenant tem acesso a features do plano "contratado"
 * porém com cap de custo em USD para proteger margem.
 */
export async function getEffectivePlan(orgId: string): Promise<{
  planId: PlanId;
  limits: PlanLimits;
  isTrialing: boolean;
  trialCostCapUsd: number;
  trialEndsAt: Date | null;
}> {
  const org = (await prisma.organization.findUnique({
    where: { id: orgId },
  })) as any;

  if (!org) {
    throw new Error(`Organization ${orgId} not found`);
  }

  const planId = org.plan as PlanId;
  const config = PLAN_CONFIG[planId];
  const now = new Date();
  const isTrialing =
    org.isTrialActive &&
    !org.trialConverted &&
    org.trialEndsAt !== null &&
    org.trialEndsAt > now;

  // Camada 1 — limite EFETIVO = limite do plano + addons de pacote comprados
  // (settings.addons, populado pelo webhook Stripe). applyAddonGrants ignora
  // Impulso/keys sem grant e mantém -1 (ilimitado).
  const activeAddons: string[] = Array.isArray((org.settings as any)?.addons)
    ? (org.settings as any).addons
    : [];
  const limits = applyAddonGrants(config.limits, activeAddons);

  return {
    planId,
    limits,
    isTrialing,
    trialCostCapUsd: org.trialCostCapUsd,
    trialEndsAt: org.trialEndsAt,
  };
}

/**
 * Onda 1.C — Soft block 60d primeiros.
 * Orgs com createdAt < 60 dias ganham grace period: NAO sao bloqueadas
 * mesmo com autoOverage=false. Apos D+60, comportamento normal.
 */
export async function isInGracePeriod(orgId: string): Promise<boolean> {
  try {
    const org = (await prisma.organization.findUnique({
      where: { id: orgId },
      select: { createdAt: true },
    })) as any;
    if (!org?.createdAt) return false;
    const ageDays = (Date.now() - new Date(org.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays < 60;
  } catch {
    return false; // fail-safe: nao concede grace se nao conseguir ler
  }
}

/**
 * Checa se uma operação pode prosseguir sem violar o limite.
 * Retorna detalhes da decisão para resposta estruturada.
 */
export async function checkLimit(
  orgId: string,
  kind: LimitKind,
  delta = 1,
): Promise<{
  allowed: boolean;
  limit: number;
  current: number;
  remaining: number;
  reason?: string;
  planId: PlanId;
  isTrialing: boolean;
  /** True quando autoOverage ativo e estourou plano (permite + cobra). */
  isOverage?: boolean;
  /** Quantas msgs deste delta sao overage (pra reportar pro Stripe). */
  overageDelta?: number;
}> {
  const { planId, limits, isTrialing } = await getEffectivePlan(orgId);
  // aiAttendancesPerMonth é kind de SOMBRA: não existe em PlanLimits e nunca
  // é enforced — para qualquer caller, comporta como ilimitado.
  const limit = kind === 'aiAttendancesPerMonth' ? -1 : limits[kind];

  if (limit === -1) {
    return { allowed: true, limit: -1, current: 0, remaining: -1, planId, isTrialing };
  }

  const current = await getUsage(orgId, kind);
  const wouldBe = current + delta;

  if (wouldBe <= limit) {
    // Dentro do plano — comportamento normal
    return {
      allowed: true,
      limit,
      current,
      remaining: limit - wouldBe,
      planId,
      isTrialing,
    };
  }

  // ─── ALEM DO LIMITE — decisao de overage ─────────────────────────
  // Le settings.billing pra decidir se permite cobranca extra ou bloqueia
  // Apenas aplica logica de overage pra aiMessagesPerMonth nesta onda (1.A).
  // Outros kinds (broadcasts, contacts, etc.) continuam com block hard.

  if (kind !== 'aiMessagesPerMonth') {
    return {
      allowed: false,
      limit,
      current,
      remaining: Math.max(0, limit - current),
      reason: `Limite do plano ${planId} atingido para ${kind}. Atual: ${current}/${limit}.`,
      planId,
      isTrialing,
    };
  }

  const org = (await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  })) as any;
  const billing = (org?.settings as any)?.billing ?? {};
  const autoOverage: boolean = Boolean(billing.autoOverage);
  const hardCeilingBrl: number | null = billing.hardCeilingBrl ?? null;

  if (!autoOverage) {
    // Onda 1.C — Soft block: orgs < 60d ganham grace (permite + log warning)
    const inGrace = await isInGracePeriod(orgId);
    if (inGrace) {
      logger.warn(`[planLimits] SOFT BLOCK org=${orgId} kind=${kind} ${current}/${limit} (grace 60d ativa)`);
      return {
        allowed: true,
        limit,
        current,
        remaining: 0,
        planId,
        isTrialing,
        isOverage: true,
        overageDelta: delta,
        // Soft mode: nao reporta pro Stripe (autoOverage=false), mas permite uso
      };
    }
    return {
      allowed: false,
      limit,
      current,
      remaining: Math.max(0, limit - current),
      reason: `Limite do plano ${planId} atingido para ${kind}. autoOverage desativado — ative em /settings/billing pra continuar com cobranca por mensagem excedente.`,
      planId,
      isTrialing,
    };
  }

  // autoOverage ON — calcula overage e checa hardCeiling
  const totalOverageMsgs = wouldBe - limit;
  if (hardCeilingBrl !== null && hardCeilingBrl > 0) {
    const projectedOverageBrl = estimateOverageBrl(totalOverageMsgs);
    if (projectedOverageBrl > hardCeilingBrl) {
      return {
        allowed: false,
        limit,
        current,
        remaining: 0,
        reason: `Teto de R$ ${hardCeilingBrl.toFixed(2)}/mes atingido (excedente projetado: R$ ${projectedOverageBrl.toFixed(2)}). Aumente o teto em /settings/billing pra continuar.`,
        planId,
        isTrialing,
      };
    }
  }

  // Permite e marca como overage — middleware vai disparar meter_event
  return {
    allowed: true,
    limit,
    current,
    remaining: 0,
    planId,
    isTrialing,
    isOverage: true,
    overageDelta: delta,
  };
}

/**
 * W2.5 — Gate de quota no pipeline de resposta da IA.
 * ─────────────────────────────────────────────────────────────────
 * Chamado de dentro do agentOrchestrator ANTES de gerar/enviar a
 * resposta da IA ao inbound. Consome 1 crédito de aiMessagesPerMonth.
 *
 * Respeita QUOTA_OVERAGE_MODE (env, default 'audit_only'):
 *   - 'audit_only': NUNCA bloqueia. Registra uso, e se estourou o
 *     plano loga alerta + reporta meter_event (fail-soft). Retorna
 *     sempre { allowed: true }. É o comportamento atual (audita, não
 *     interrompe a resposta).
 *   - 'enforce': honra a decisão de checkLimit. Se checkLimit negar
 *     (limite atingido sem autoOverage/grace, ou teto hardCeiling
 *     estourado), retorna { allowed: false } — o orchestrator pausa a
 *     resposta. Se checkLimit permitir (dentro do plano, grace, ou
 *     overage opt-in), consome o crédito e reporta overage quando for
 *     o caso.
 *
 * Fail-soft: qualquer exceção interna libera a resposta (prefere
 * servir a bloquear). Nunca lança.
 */
export async function enforceAiReplyQuota(
  orgId: string,
  delta = 1,
): Promise<{
  allowed: boolean;
  mode: 'audit_only' | 'enforce';
  reason?: string;
  limit?: number;
  current?: number;
  planId?: PlanId;
  isOverage?: boolean;
}> {
  const mode = env.QUOTA_OVERAGE_MODE;
  try {
    const check = await checkLimit(orgId, 'aiMessagesPerMonth', delta);

    // ── audit_only: nunca bloqueia. Só registra/alerta. ──────────────
    if (mode !== 'enforce') {
      if (!check.allowed) {
        // checkLimit negaria (block hard), mas em audit_only servimos e
        // apenas auditamos que houve estouro.
        logger.warn(
          `[planLimits] AUDIT overage (não bloqueia) org=${orgId} kind=aiMessagesPerMonth ${check.current}/${check.limit} plan=${check.planId}`,
        );
      }
      await incrementUsage(orgId, 'aiMessagesPerMonth', delta);
      maybeReportOverage(orgId, check);
      return {
        allowed: true,
        mode,
        limit: check.limit,
        current: check.current,
        planId: check.planId,
        isOverage: !check.allowed || check.isOverage,
      };
    }

    // ── enforce: honra a decisão de checkLimit ───────────────────────
    if (!check.allowed) {
      logger.warn(
        `[planLimits] ENFORCE block org=${orgId} kind=aiMessagesPerMonth ${check.current}/${check.limit} plan=${check.planId} reason=${check.reason}`,
      );
      return {
        allowed: false,
        mode,
        reason: check.reason,
        limit: check.limit,
        current: check.current,
        planId: check.planId,
      };
    }

    await incrementUsage(orgId, 'aiMessagesPerMonth', delta);
    maybeReportOverage(orgId, check);
    return {
      allowed: true,
      mode,
      limit: check.limit,
      current: check.current,
      planId: check.planId,
      isOverage: check.isOverage,
    };
  } catch (err: any) {
    // Fail-soft: nunca derruba a resposta da IA por erro de quota.
    logger.error(`[planLimits] enforceAiReplyQuota error org=${orgId}: ${err?.message ?? err}`);
    return { allowed: true, mode };
  }
}

/**
 * Dispara meter_event de overage (fire-and-forget, fail-soft) quando a
 * checagem marcou overage. reportOverageMeterEvent já gateia por
 * QUOTA_OVERAGE_MODE internamente (skip 'mode_audit_only' em audit).
 */
function maybeReportOverage(
  orgId: string,
  check: { isOverage?: boolean; overageDelta?: number; allowed?: boolean },
): void {
  const overageCount =
    check.overageDelta && check.overageDelta > 0
      ? check.overageDelta
      : check.isOverage || check.allowed === false
        ? 1
        : 0;
  if (overageCount <= 0) return;
  reportOverageMeterEvent({ orgId, count: overageCount })
    .then((r) => {
      if (r.reported) {
        logger.info(
          `[planLimits] overage reportado org=${orgId} count=${overageCount} eventId=${r.meterEventId}`,
        );
      } else if (r.skipped !== 'mode_audit_only') {
        logger.warn(`[planLimits] overage NAO reportado org=${orgId} reason=${r.skipped}`);
      }
    })
    .catch((err) => {
      logger.warn(`[planLimits] overage report exception: ${err?.message ?? err}`);
    });
}

/**
 * Middleware factory para proteger rotas consumíveis.
 * Uso: router.post('/broadcasts', enforceLimit('broadcastsPerMonth'), handler)
 */
export function enforceLimit(kind: LimitKind, delta = 1) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'organization context missing' });
        return;
      }

      const check = await checkLimit(orgId, kind, delta);

      if (!check.allowed) {
        res.status(429).json({
          error: 'plan_limit_exceeded',
          message: check.reason,
          planId: check.planId,
          limit: check.limit,
          current: check.current,
          remaining: check.remaining,
          isTrialing: check.isTrialing,
          upgradeUrl: '/billing',
        });
        return;
      }

      // Incrementa o contador local (vale pro proximo check do mesmo ciclo).
      await incrementUsage(orgId, kind, delta);

      // OVERAGE: se permitido por estar acima do plano via autoOverage,
      // reporta meter_event pro Stripe (fire-and-forget, fail-soft).
      // Sinaliza no header pro frontend mostrar aviso ao operador.
      if (check.isOverage && check.overageDelta && check.overageDelta > 0) {
        res.setHeader('X-Quota-Overage', 'true');
        reportOverageMeterEvent({ orgId, count: check.overageDelta })
          .then((r) => {
            if (r.reported) {
              logger.info(
                `[planLimits] overage reportado org=${orgId} count=${check.overageDelta} eventId=${r.meterEventId}`,
              );
            } else if (r.skipped !== 'mode_audit_only') {
              logger.warn(
                `[planLimits] overage NAO reportado org=${orgId} reason=${r.skipped}`,
              );
            }
          })
          .catch((err) => {
            logger.warn(`[planLimits] overage report exception: ${err?.message ?? err}`);
          });
      }

      next();
    } catch (err: any) {
      logger.error(`[planLimits] enforcement error: ${err.message}`);
      // Graceful: se enforcement falhar, loga e libera (prefere servir a bloquear).
      next();
    }
  };
}

// ═════════════════════════════════════════════════════════════════
// Camada 2 — enforcement de RECURSOS COM ESTADO (contatos, fluxos, docs,
// atendentes). Diferente do checkLimit acima (contadores Redis mensais): aqui
// o "atual" é COUNT(*) real no banco vs limite EFETIVO (plano + addons, via
// getEffectivePlan). Atrás de RESOURCE_LIMITS_MODE (default audit_only = nunca
// bloqueia, só loga). Ligar bloqueio = fly secrets set RESOURCE_LIMITS_MODE=enforce.
// ═════════════════════════════════════════════════════════════════

export type ResourceLimitKind = 'contacts' | 'flows' | 'knowledgeBaseDocs' | 'agents';

export interface ResourceLimitDecision {
  /** Pode prosseguir? (audit_only => sempre true; só loga o estouro.) */
  allowed: boolean;
  /** Cabe no limite efetivo? (independente do modo.) */
  withinLimit: boolean;
  limit: number;
  current: number;
  mode: 'audit_only' | 'enforce';
}

/**
 * Decisão PURA de limite de recurso com estado. Limite -1 (ilimitado) sempre
 * passa. Em audit_only, `allowed` é sempre true (observa, não bloqueia).
 */
export function decideResourceLimit(input: {
  limit: number;
  current: number;
  delta: number;
  mode: 'audit_only' | 'enforce';
}): ResourceLimitDecision {
  const { limit, current, delta, mode } = input;
  if (limit === -1) return { allowed: true, withinLimit: true, limit, current, mode };
  const withinLimit = current + delta <= limit;
  const allowed = withinLimit || mode === 'audit_only';
  return { allowed, withinLimit, limit, current, mode };
}

/**
 * Checa um recurso com estado: lê o limite EFETIVO (plano + addons) e compara
 * com a contagem real informada. Loga quem estouraria (AUDIT) ou bloquearia
 * (BLOCK). Fail-soft: erro ao ler o plano nunca bloqueia (retorna allowed).
 */
export async function checkResourceLimit(
  orgId: string,
  kind: ResourceLimitKind,
  currentCount: number,
  delta = 1,
): Promise<ResourceLimitDecision> {
  const mode = env.RESOURCE_LIMITS_MODE;
  try {
    const { limits, planId } = await getEffectivePlan(orgId);
    const dec = decideResourceLimit({ limit: limits[kind], current: currentCount, delta, mode });
    if (!dec.withinLimit) {
      logger.warn(
        `[resourceLimits] ${dec.mode === 'enforce' ? 'BLOCK' : 'AUDIT'} org=${orgId} plan=${planId} kind=${kind} ${dec.current}+${delta}/${dec.limit}`,
      );
    }
    return dec;
  } catch (err: any) {
    logger.error(`[resourceLimits] check error org=${orgId} kind=${kind}: ${err?.message ?? err}`);
    return { allowed: true, withinLimit: true, limit: -1, current: currentCount, mode };
  }
}

/** Corpo padrão do 429 quando um recurso com estado é bloqueado. */
export function resourceLimitBody(kind: ResourceLimitKind, dec: ResourceLimitDecision) {
  return {
    error: 'plan_limit_exceeded',
    kind,
    limit: dec.limit,
    current: dec.current,
    message: `Limite do plano atingido para ${kind} (${dec.current}/${dec.limit}). Faça upgrade ou contrate um addon.`,
    upgradeUrl: '/billing',
  };
}

/*
 * ═════════════════════════════════════════════════════════════════
 * Resposta Meta out/2026 (PR-E): estágio de custo LLM da org.
 *
 * Uma org entra no regime protegido de custo (cap de trial + modelo leve +
 * rate limits) quando está em TRIAL (janela aberta) ou em estágio NOVO
 * (nunca iniciou trial E não tem assinatura Stripe). Qualquer org com
 * stripeSubscriptionId fica FORA do regime: o comportamento de conta
 * pagante não muda em nada. A org da própria ZappIQ (vitrine Iza) também
 * fica fora: ela não é um tenant em teste.
 * ═════════════════════════════════════════════════════════════════
 */

export type LlmCostStage = 'TRIAL' | 'NOVO' | 'OTHER';

export interface TrialLlmStageInfo {
  /** true quando a org está no regime protegido (TRIAL ou NOVO). */
  capped: boolean;
  stage: LlmCostStage;
  /** Teto de custo em USD (organizations.trialCostCapUsd, default 15). */
  capUsd: number;
}

/** Campos mínimos da org para decidir o estágio (função pura, testável). */
export interface LlmCostStageOrgInput {
  trialStartedAt?: Date | string | null;
  trialEndsAt?: Date | string | null;
  isTrialActive?: boolean | null;
  trialConverted?: boolean | null;
  stripeSubscriptionId?: string | null;
}

/**
 * Decisão PURA do estágio de custo LLM.
 *   - Assinatura Stripe presente (ativa ou não): 'OTHER', nunca mexemos.
 *   - Trial com janela aberta (mesma regra do getEffectivePlan): 'TRIAL'.
 *   - Nunca iniciou trial e sem assinatura: 'NOVO'.
 *   - Resto (ex.: trial expirado, que já tem paywall próprio): 'OTHER'.
 */
export function decideLlmCostStage(org: LlmCostStageOrgInput, now = new Date()): LlmCostStage {
  const hasSubscription = Boolean(
    org.stripeSubscriptionId && String(org.stripeSubscriptionId).trim() !== '',
  );
  if (hasSubscription) return 'OTHER';

  const trialEndsAt = org.trialEndsAt ? new Date(org.trialEndsAt) : null;
  const isTrialing =
    Boolean(org.isTrialActive) &&
    !org.trialConverted &&
    trialEndsAt !== null &&
    !Number.isNaN(trialEndsAt.getTime()) &&
    trialEndsAt > now;
  if (isTrialing) return 'TRIAL';

  if (org.trialStartedAt == null) return 'NOVO';
  return 'OTHER';
}

/** TTL do cache do estágio: 5 min. Conversão de plano demora até 5 min pra refletir. */
const TRIAL_STAGE_CACHE_TTL_SECONDS = 300;

/**
 * Estágio de custo LLM da org com cache Redis de 5 min (1 query de org a cada
 * 5 min por tenant, o resto é um GET no cache). Fail-soft: qualquer erro
 * devolve 'OTHER' (prefere servir sem restrição a travar cliente por engano).
 */
export async function getTrialLlmStage(orgId: string): Promise<TrialLlmStageInfo> {
  try {
    if (!orgId || isZappIQOrg(orgId)) {
      return { capped: false, stage: 'OTHER', capUsd: 0 };
    }

    const cacheKey = `zappiq:trial_stage:${orgId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { stage?: LlmCostStage; capUsd?: number };
        if (parsed.stage === 'TRIAL' || parsed.stage === 'NOVO' || parsed.stage === 'OTHER') {
          return {
            capped: parsed.stage !== 'OTHER',
            stage: parsed.stage,
            capUsd: typeof parsed.capUsd === 'number' ? parsed.capUsd : 15,
          };
        }
      } catch {
        // valor corrompido no cache: recalcula abaixo
      }
    }

    const org = (await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        trialStartedAt: true,
        trialEndsAt: true,
        isTrialActive: true,
        trialConverted: true,
        stripeSubscriptionId: true,
        trialCostCapUsd: true,
      },
    })) as any;
    if (!org) return { capped: false, stage: 'OTHER', capUsd: 0 };

    const stage = decideLlmCostStage(org);
    const capUsd = typeof org.trialCostCapUsd === 'number' ? org.trialCostCapUsd : 15;
    // cache.set é fail-soft (false em erro): estágio só fica sem cache.
    await cache.set(cacheKey, JSON.stringify({ stage, capUsd }), TRIAL_STAGE_CACHE_TTL_SECONDS);
    return { capped: stage !== 'OTHER', stage, capUsd };
  } catch (err: any) {
    logger.warn(`[planLimits] getTrialLlmStage falhou org=${orgId}: ${err?.message ?? err}`);
    return { capped: false, stage: 'OTHER', capUsd: 0 };
  }
}

/**
 * Trial cost cap: chamado de dentro do agentOrchestrator antes de efetuar
 * chamada LLM paga. Vale pra org em TRIAL ou em estágio NOVO (sem assinatura).
 *
 * Se o tenant já gastou > trialCostCapUsd (acumulado por recordTrialCost via
 * llmCallAudit), bloqueia a chamada; o caller degrada pra mensagem fixa.
 * Fail-soft: erro interno NUNCA bloqueia (retorna allowed=true) e nunca lança.
 */
export async function assertTrialCostCap(
  orgId: string,
  additionalUsdEstimate = 0.02,
): Promise<{ allowed: boolean; reason?: string; spentUsd: number; capUsd: number }> {
  try {
    const { capped, capUsd, stage } = await getTrialLlmStage(orgId);

    if (!capped) {
      return { allowed: true, spentUsd: 0, capUsd };
    }

    // Custo acumulado do período (populado por recordTrialCost no llmCallAudit).
    const costKey = `zappiq:trial_cost_usd:${orgId}`;
    const raw = await cache.get(costKey);
    const spentUsd = raw ? parseFloat(raw) : 0;

    if (spentUsd + additionalUsdEstimate > capUsd) {
      return {
        allowed: false,
        reason: `Cap de custo do ${stage === 'TRIAL' ? 'trial' : 'estágio NOVO'} atingido (US$ ${spentUsd.toFixed(2)} / US$ ${capUsd.toFixed(2)}). Assine um plano para continuar.`,
        spentUsd,
        capUsd,
      };
    }

    return { allowed: true, spentUsd, capUsd };
  } catch (err: any) {
    logger.warn(`[planLimits] assertTrialCostCap falhou org=${orgId}: ${err?.message ?? err}`);
    return { allowed: true, spentUsd: 0, capUsd: 0 };
  }
}

/**
 * Incrementa custo acumulado do trial (chamado após cada chamada LLM).
 */
export async function recordTrialCost(orgId: string, costUsd: number): Promise<void> {
  const key = `zappiq:trial_cost_usd:${orgId}`;
  // incrbyfloat pra precisão monetária. TTL = janela trial + grace (60 dias).
  // Fail-soft: cache.incrbyfloat já loga warning em erro; spentUsd só fica
  // momentaneamente desatualizado.
  const result = await cache.incrbyfloat(key, costUsd);
  if (result !== null) {
    await cache.expire(key, 60 * 24 * 3600);
  }
}

/*
 * ═════════════════════════════════════════════════════════════════
 * Resposta Meta out/2026 (PR-E): rate limits do regime TRIAL/NOVO.
 *
 * Dois tetos, ambos por janela de 1 hora, ambos INCR + TTL na criação:
 *   - WhatsApp/IG: respostas de IA por CONTATO (loop de bot com bot,
 *     contato abusivo). Ao exceder, a IA sai de cena em silêncio e o
 *     humano pode assumir a conversa.
 *   - Webchat: mensagens processadas por ORG (flood no widget público).
 *
 * Só valem pra org em regime TRIAL/NOVO (o caller gateia por
 * getTrialLlmStage). Fail-soft: backend de cache fora do ar libera.
 * ═════════════════════════════════════════════════════════════════
 */

/** Teto de respostas de IA por contato por hora (org em TRIAL/NOVO). */
export const TRIAL_CONTACT_REPLIES_PER_HOUR = 30;

/** Teto de mensagens de webchat por org por hora (org em TRIAL/NOVO). */
export const WEBCHAT_ORG_REPLIES_PER_HOUR = 300;

const RATE_LIMIT_WINDOW_SECONDS = 3600;

async function consumeHourlyBudget(
  key: string,
  limit: number,
): Promise<{ allowed: boolean; count: number }> {
  try {
    const count = await cache.incrby(key, 1);
    if (count === null) {
      // Backend fora do ar: prefere servir a bloquear (mesmo contrato do resto).
      return { allowed: true, count: 0 };
    }
    if (count === 1) {
      await cache.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }
    return { allowed: count <= limit, count };
  } catch {
    return { allowed: true, count: 0 };
  }
}

/**
 * Consome 1 unidade do teto horário de respostas de IA pro contato.
 * A 31ª resposta na mesma hora vem com allowed=false: o orchestrator loga e
 * NÃO responde (silêncio; humano pode assumir). Nunca lança.
 */
export async function consumeTrialContactReplyBudget(
  orgId: string,
  contactId: string,
): Promise<{ allowed: boolean; count: number }> {
  return consumeHourlyBudget(
    `zappiq:rl:contact:${orgId}:${contactId}`,
    TRIAL_CONTACT_REPLIES_PER_HOUR,
  );
}

/**
 * Consome 1 unidade do teto horário de webchat da org. A 301ª mensagem na
 * mesma hora vem com allowed=false: a rota devolve 429 sem tocar LLM.
 * Nunca lança.
 */
export async function consumeWebChatOrgReplyBudget(
  orgId: string,
): Promise<{ allowed: boolean; count: number }> {
  return consumeHourlyBudget(`zappiq:rl:webchat:${orgId}`, WEBCHAT_ORG_REPLIES_PER_HOUR);
}
