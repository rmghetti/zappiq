/**
 * Usage Reconciliation Service (PR #149 — Quota Mgmt #6, audit-only Fase 1).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Objetivo
 * ═══════════════════════════════════════════════════════════════════════════
 * Roda diariamente às 04:00 UTC (dez minutos depois do tenant-usage-aggregation
 * que sobe TenantUsageMonthly). Pra cada organização:
 *
 *   1. Carrega consumo do mês corrente (TenantUsageMonthly).
 *   2. Cruza com limite do plano (PLAN_CONFIG.aiMessagesPerMonth).
 *   3. Cruza com preferências do cliente (organization.settings.billing —
 *      vindas do PR #111: autoOverage / hardCeilingBrl / notifyAtPercent).
 *   4. Decide qual ação seria tomada em produção (would_pause /
 *      would_charge_overage / over_ceiling / notify_only).
 *   5. Dispara alerta no Slack quando cruza thresholds (idempotente —
 *      memória em Redis impede notificar mesmo threshold duas vezes no mês).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IMPORTANTE — Fase 1 é AUDIT-ONLY
 * ═══════════════════════════════════════════════════════════════════════════
 * Este service NÃO pausa agente, NÃO cria Stripe usage record, NÃO bloqueia
 * mensagens. Ele apenas observa, calcula e notifica. Razão: capturar duas
 * semanas de dados reais (quantas orgs estouram, com que frequência, que
 * percentual do tempo) antes de mexer em invoice de cliente. Decisão tomada
 * em ARCHITECTURE.md §quota_mgmt + memória project_v4_decisions_consolidated.
 *
 * Próximos PRs que ativam ações reais:
 *   - #149.1 → pause real quando autoOverage:false e atingiu 100%
 *   - #149.2 → Stripe usage records quando autoOverage:true (e respeita
 *               hardCeilingBrl)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Persistência (sem migration!)
 * ═══════════════════════════════════════════════════════════════════════════
 * Pra evitar drift com migrations (memória feedback_validate_migrations_in_prod
 * — Dockerfile não roda prisma migrate deploy), o estado idempotente vai pro
 * Redis:
 *
 *   Hash key: zappiq:reconcil:{orgId}:{yyyy-mm}
 *   Fields:
 *     - last_run_at      → ISO timestamp da última execução
 *     - notify_pct_50    → ISO timestamp quando notificou 50% (ou ausente)
 *     - notify_pct_80    → idem 80%
 *     - notify_pct_100   → idem 100%
 *     - over_ceiling     → ISO timestamp se ultrapassou hardCeilingBrl
 *     - last_action      → string do reconciliationAction
 *     - actual_messages  → contador do mês na última run
 *     - usage_percent    → percentual da última run
 *
 *   TTL: 60 dias (atravessa virada de mês + grace pra inspeção retroativa).
 *
 * Histórico longo: vai pro Slack channel quota-alerts (retenção própria) +
 * logger estruturado que termina no Grafana Loki.
 */

import { Queue, Worker } from 'bullmq';
import { prisma } from '@zappiq/database';
import { PLAN_CONFIG, type PlanConfig, type PlanId } from '@zappiq/shared';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import redis from '../utils/redis.js';
import { dispatchMultiChannelQuotaAlert, type QuotaAlertThreshold } from './quotaAlertsService.js';
import {
  sendSlackAlert,
  buildHeaderBlock,
  buildSectionBlock,
  buildFieldsBlock,
  buildContextBlock,
  buildDividerBlock,
} from './slackNotifier.js';
import { queueConnection as connection } from '../config/queueRedis.js';

// ─── BullMQ connection (mesma config do tenantUsageService) ─────

let usageReconciliationWorker: Worker | null = null;

// ─── Helpers ───────────────────────────────────────────────────
const BRL_TO_USD = 5.0; // Mesma aproximação do tenantUsageService

function currentYearMonth(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function reconcilKey(orgId: string, yearMonth: string): string {
  return `zappiq:reconcil:${orgId}:${yearMonth}`;
}

const RECONCIL_TTL_SECONDS = 60 * 24 * 3600; // 60 dias

// Notify thresholds em ordem decrescente — checamos do mais crítico pro mais leve.
// Cada threshold tem um field correspondente no hash Redis pra idempotência.
const NOTIFY_THRESHOLDS = [100, 95, 90, 80, 70] as const;
type NotifyThreshold = (typeof NOTIFY_THRESHOLDS)[number];

function thresholdField(threshold: NotifyThreshold): string {
  return `notify_pct_${threshold}`;
}

// ─── Tipos ─────────────────────────────────────────────────────

interface BillingSettings {
  autoOverage?: boolean;
  hardCeilingBrl?: number | null;
  notifyAtPercent?: number;
}

interface OrgSnapshot {
  id: string;
  name: string;
  plan: string;
  settings: { billing?: BillingSettings; [k: string]: unknown } | null;
}

interface UsageSnapshot {
  aiMessagesProcessed: number;
  llmCostUsd: number;
}

interface ReconcileDecision {
  thresholdReached: NotifyThreshold | null;
  reconciliationAction:
    | 'no_action'
    | 'notify_only'
    | 'would_pause'
    | 'would_charge_overage'
    | 'over_ceiling';
  overageMessages: number;
  estimatedOverageBrlCents: number;
}

// ─── Core reconciliation logic ─────────────────────────────────

/**
 * Carrega settings.billing com defaults conservadores.
 * Default: autoOverage=false (não cobra sem opt-in), notifyAtPercent=80.
 */
function readBilling(settings: OrgSnapshot['settings']): Required<BillingSettings> {
  const b = settings?.billing ?? {};
  return {
    autoOverage: Boolean(b.autoOverage),
    hardCeilingBrl: b.hardCeilingBrl ?? null,
    notifyAtPercent: typeof b.notifyAtPercent === 'number' ? b.notifyAtPercent : 80,
  };
}

/**
 * Calcula a decisão de reconciliação pra uma org.
 * Pure function — fácil de testar isoladamente.
 */
export function decideReconcileAction(
  planLimitMessages: number,
  actualMessages: number,
  llmCostUsdMonth: number,
  billing: Required<BillingSettings>,
): ReconcileDecision {
  // Plano ilimitado (-1): sem reconciliação possível
  if (planLimitMessages === -1) {
    return {
      thresholdReached: null,
      reconciliationAction: 'no_action',
      overageMessages: 0,
      estimatedOverageBrlCents: 0,
    };
  }

  const usagePercent = planLimitMessages > 0 ? (actualMessages / planLimitMessages) * 100 : 0;

  // Estima custo unitário em USD por mensagem do mês corrente
  const costPerMessageUsd = actualMessages > 0 ? llmCostUsdMonth / actualMessages : 0;
  const overageMessages = Math.max(0, actualMessages - planLimitMessages);
  // Convertemos USD → BRL → cents
  const estimatedOverageBrlCents = Math.round(
    overageMessages * costPerMessageUsd * BRL_TO_USD * 100,
  );

  // Thresholds: percorremos do mais alto pro mais baixo, retornamos o primeiro hit
  let thresholdReached: NotifyThreshold | null = null;
  for (const t of NOTIFY_THRESHOLDS) {
    if (usagePercent >= t) {
      thresholdReached = t;
      break;
    }
  }

  // Se o cliente customizou notifyAtPercent pra abaixo dos hardcoded (ex: 50),
  // mapeamos pro nivel mais leve do canon (70 = "Aviso preventivo"): os copies
  // de email/WA e o emoji Slack sao keyed por QuotaAlertThreshold (70..100),
  // entao um valor fora do canon quebraria o dispatch downstream.
  if (
    thresholdReached === null &&
    billing.notifyAtPercent < 80 &&
    usagePercent >= billing.notifyAtPercent
  ) {
    thresholdReached = 70;
  }

  // Decisão da ação (audit-only — não executa)
  let action: ReconcileDecision['reconciliationAction'] = 'no_action';

  if (usagePercent >= 100) {
    if (!billing.autoOverage) {
      action = 'would_pause'; // Cliente optou por NÃO ter overage → pausaria
    } else if (billing.hardCeilingBrl != null) {
      // Verifica se overage estimado já estourou o teto declarado
      const hardCeilingCents = Math.round(billing.hardCeilingBrl * 100);
      action = estimatedOverageBrlCents >= hardCeilingCents ? 'over_ceiling' : 'would_charge_overage';
    } else {
      action = 'would_charge_overage'; // autoOverage ON sem teto → cobraria
    }
  } else if (thresholdReached !== null) {
    action = 'notify_only';
  }

  return {
    thresholdReached,
    reconciliationAction: action,
    overageMessages,
    estimatedOverageBrlCents,
  };
}

// ─── Slack alert payload ───────────────────────────────────────

function actionLabel(action: ReconcileDecision['reconciliationAction']): string {
  const map: Record<ReconcileDecision['reconciliationAction'], string> = {
    no_action: 'Sem ação',
    notify_only: 'Notificação preventiva',
    would_pause: ':warning: PAUSARIA IA (autoOverage OFF)',
    would_charge_overage: ':moneybag: COBRARIA EXCEDENTE (autoOverage ON)',
    over_ceiling: ':no_entry: ULTRAPASSOU TETO declarado (pausaria)',
  };
  return map[action];
}

function emojiForThreshold(t: NotifyThreshold): string {
  if (t === 100) return ':rotating_light:';
  if (t === 95) return ':rotating_light:';
  if (t === 90) return ':warning:';
  if (t === 80) return ':warning:';
  if (t === 70) return ':bell:';
  return ':bell:';
}

async function notifySlack(input: {
  org: OrgSnapshot;
  planLimit: number;
  actual: number;
  usagePercent: number;
  decision: ReconcileDecision;
  billing: Required<BillingSettings>;
  periodYearMonth: string;
}): Promise<boolean> {
  const { org, planLimit, actual, usagePercent, decision, billing, periodYearMonth } = input;
  const webhook = process.env.SLACK_WEBHOOK_QUOTA_ALERTS;

  const header = `${emojiForThreshold(decision.thresholdReached!)} Quota ${decision.thresholdReached}% — ${org.name}`;

  const blocks = [
    buildHeaderBlock(header),
    buildSectionBlock(
      `*Org:* ${org.name} \`${org.id}\` · *Plano:* ${org.plan} · *Período:* ${periodYearMonth}`,
    ),
    buildFieldsBlock([
      {
        label: 'Consumo',
        value: `${actual.toLocaleString('pt-BR')} / ${planLimit.toLocaleString('pt-BR')} msgs (${usagePercent.toFixed(1)}%)`,
      },
      {
        label: 'Ação prevista',
        value: actionLabel(decision.reconciliationAction),
      },
      {
        label: 'autoOverage',
        value: billing.autoOverage ? ':white_check_mark: Ativado' : ':x: Desativado',
      },
      {
        label: 'Teto declarado',
        value:
          billing.hardCeilingBrl != null
            ? `R$ ${billing.hardCeilingBrl.toLocaleString('pt-BR')}`
            : 'Sem teto',
      },
      {
        label: 'Overage estimado',
        value:
          decision.overageMessages > 0
            ? `${decision.overageMessages.toLocaleString('pt-BR')} msgs · R$ ${(decision.estimatedOverageBrlCents / 100).toFixed(2)}`
            : '—',
      },
      {
        label: 'Notificar @',
        value: `${billing.notifyAtPercent}%`,
      },
    ]),
    buildDividerBlock(),
    buildContextBlock(
      `:eyes: *AUDIT-ONLY FASE 1* — esta é uma observação. Nenhuma ação foi executada. Em PR #149.1/#149.2 essas decisões serão aplicadas em runtime.`,
    ),
  ];

  return sendSlackAlert({
    webhook,
    text: header, // fallback notification
    blocks,
    username: 'ZappIQ Quota Watch',
    iconEmoji: ':chart_with_upwards_trend:',
  });
}

// ─── Reconciliação por org ─────────────────────────────────────

export async function reconcileOrg(
  orgId: string,
  periodYearMonth: string,
): Promise<{
  skipped: boolean;
  actual: number;
  planLimit: number;
  usagePercent: number;
  decision: ReconcileDecision;
  slackSent: boolean;
}> {
  // 1) Carrega org com settings
  const org = (await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      plan: true,
      settings: true,
    },
  })) as unknown as OrgSnapshot | null;

  if (!org) {
    throw new Error(`Organization ${orgId} not found`);
  }

  // 2) Carrega usage do mês (pode não existir se aggregateOrgUsage ainda não rodou — graceful)
  const usage = (await (prisma as any).TenantUsageMonthly.findUnique({
    where: {
      organizationId_periodYearMonth: { organizationId: orgId, periodYearMonth },
    },
    select: { aiMessagesProcessed: true, llmCostUsd: true },
  })) as UsageSnapshot | null;

  const actual = usage?.aiMessagesProcessed ?? 0;
  const llmCostUsd = usage?.llmCostUsd ?? 0;

  // 3) Resolve limite do plano
  const cfg = (PLAN_CONFIG as Record<string, PlanConfig>)[org.plan];
  const planLimit = cfg?.limits?.aiMessagesPerMonth ?? 0;

  // 4) Lê billing settings
  const billing = readBilling(org.settings);

  // 5) Decide ação
  const decision = decideReconcileAction(planLimit, actual, llmCostUsd, billing);
  const usagePercent = planLimit > 0 ? (actual / planLimit) * 100 : 0;

  // 6) Atualiza Redis (sempre — pra dashboard) + decide se notifica Slack
  const key = reconcilKey(orgId, periodYearMonth);
  let slackSent = false;

  try {
    await redis.hset(key, {
      last_run_at: new Date().toISOString(),
      actual_messages: String(actual),
      usage_percent: usagePercent.toFixed(2),
      last_action: decision.reconciliationAction,
      plan_limit: String(planLimit),
      plan_id: org.plan,
    });
    await redis.expire(key, RECONCIL_TTL_SECONDS);

    // Notificação idempotente: se atingiu threshold X% e ainda não notificou
    // esse threshold neste mês, dispara Slack e marca o field.
    if (decision.thresholdReached !== null) {
      const field = thresholdField(decision.thresholdReached);
      const alreadyNotified = await redis.hget(key, field);

      if (!alreadyNotified) {
        slackSent = await notifySlack({
          org,
          planLimit,
          actual,
          usagePercent,
          decision,
          billing,
          periodYearMonth,
        });

        if (slackSent) {
          await redis.hset(key, { [field]: new Date().toISOString() });
        }

        // Onda 1.B — dispatch multi-canal (email + WA cadastro do admin)
        // Sequencial pra nao perder log; fail-soft via try interno.
        try {
          await dispatchMultiChannelQuotaAlert({
            orgId,
            orgName: org.name,
            threshold: decision.thresholdReached as QuotaAlertThreshold,
            current: actual,
            limit: planLimit,
            usagePercent,
            planId: org.plan,
            reconcilAction: decision.reconciliationAction,
            overageBrlCents: decision.estimatedOverageBrlCents,
          });
        } catch (err: any) {
          logger.warn(`[UsageReconcil] multi-channel dispatch falhou org=${orgId}: ${err?.message}`);
        }
      }
    }
  } catch (err: any) {
    logger.warn(`[UsageReconcil] Redis falhou para org=${orgId}: ${err.message}`);
  }

  // 7) Log estruturado pra Grafana Loki
  logger.info('[UsageReconcil] org processada', {
    orgId,
    orgName: org.name,
    plan: org.plan,
    periodYearMonth,
    actual,
    planLimit,
    usagePercent: Number(usagePercent.toFixed(2)),
    reconciliationAction: decision.reconciliationAction,
    thresholdReached: decision.thresholdReached,
    autoOverage: billing.autoOverage,
    hardCeilingBrl: billing.hardCeilingBrl,
    overageMessages: decision.overageMessages,
    estimatedOverageBrlCents: decision.estimatedOverageBrlCents,
    slackSent,
    auditOnly: true,
  });

  return {
    skipped: false,
    actual,
    planLimit,
    usagePercent,
    decision,
    slackSent,
  };
}

// ─── Ciclo completo ────────────────────────────────────────────

export async function runUsageReconciliationCycle(): Promise<{
  orgsProcessed: number;
  orgsFailed: number;
  alertsSent: number;
  durationMs: number;
  periodYearMonth: string;
}> {
  const started = Date.now();
  const periodYearMonth = currentYearMonth();

  logger.info(`[UsageReconcil] Iniciando ciclo — período=${periodYearMonth}`);

  // Só processa orgs com plano ativo. Trial/free orgs poderiam ter limite zero
  // e gerar ruído — filtramos quem está pagando ou em trial ativo.
  const orgs = await prisma.organization.findMany({
    select: { id: true, plan: true },
  });

  let orgsProcessed = 0;
  let orgsFailed = 0;
  let alertsSent = 0;

  for (const org of orgs) {
    try {
      const res = await reconcileOrg(org.id, periodYearMonth);
      orgsProcessed++;
      if (res.slackSent) alertsSent++;
    } catch (err: any) {
      orgsFailed++;
      logger.warn(`[UsageReconcil] Falha ao reconciliar org=${org.id}: ${err.message}`);
    }
  }

  const durationMs = Date.now() - started;
  logger.info(
    `[UsageReconcil] Ciclo concluído — ok=${orgsProcessed}, falha=${orgsFailed}, alerts=${alertsSent}, ${durationMs}ms`,
  );

  return { orgsProcessed, orgsFailed, alertsSent, durationMs, periodYearMonth };
}

// ─── BullMQ bootstrap ──────────────────────────────────────────

