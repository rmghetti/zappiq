/**
 * Tenant Usage Aggregation (H10 — Unit Economics).
 *
 * Objetivo:
 *   Consolidar uso e custo por tenant em granularidade mensal (periodYearMonth
 *   = 'YYYY-MM'), permitindo calcular margem bruta por cliente e sinais de
 *   abuso / churn precoce sem precisar varrer tabelas transacionais a cada
 *   request do dashboard executivo.
 *
 * O que entra na agregação:
 *   - aiMessagesProcessed       : mensagens OUTBOUND geradas pelo bot
 *   - broadcastsSent            : MessageTemplate disparados no mês (campaigns.sentCount)
 *   - conversationsOpened       : conversas criadas no mês
 *   - conversationsClosed       : conversas com closedAt no mês
 *   - conversationsAiResolved   : fechadas sem transbordo humano
 *   - conversationsHumanResolved: fechadas com assignedToId não nulo
 *   - handoffsCount             : transições de status para WAITING (proxy)
 *   - llmCostUsd                : vem do contador Redis (trial + pós-trial)
 *   - infraCostUsd              : rateio fixo + extras (placeholder, ajustar)
 *   - revenueBrlCents           : derivado do plano contratado e add-ons
 *
 * Política de recorrência:
 *   - Job diário às 03:10 UTC (dez minutos depois do retention job para evitar
 *     pico simultâneo de DB). Recalcula o MÊS CORRENTE full — é idempotente
 *     graças ao upsert por (organizationId, periodYearMonth).
 *   - Em virada de mês, os dois primeiros dias o job ainda recomputa o mês
 *     anterior também, para capturar mensagens que chegaram com delay de
 *     webhook ou jobs que finalizaram tarde.
 *
 * Observabilidade:
 *   - Loga tempo de execução e número de orgs processadas.
 *   - Se uma org falhar, pula e continua — não aborta o ciclo.
 *
 * Este serviço alimenta:
 *   - GET /api/admin/tenant-usage/:orgId (dashboard executivo interno)
 *   - Alertas de margem negativa / custo anormal
 *   - Trigger de upsell (cliente estourou plano X por 2 meses consecutivos)
 */
import { Queue, Worker } from 'bullmq';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import redis from '../utils/redis.js';
import { PLAN_CONFIG, type PlanConfig } from '@zappiq/shared';

const redisUrl = new URL(env.REDIS_URL);
const isTLS = env.REDIS_URL.startsWith('rediss://');
const connection = {
  host: redisUrl.hostname || 'localhost',
  port: Number(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
  username: redisUrl.username || undefined,
  ...(isTLS ? { tls: { rejectUnauthorized: false } } : {}),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const tenantUsageQueue = new Queue('tenant-usage-aggregation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 30 },
  },
});

let tenantUsageWorker: Worker | null = null;

// ── Helpers ─────────────────────────────────────────────
export function currentYearMonth(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthRange(yearMonth: string): { start: Date; end: Date } {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0)); // primeiro dia do mês seguinte
  return { start, end };
}

// Preço em BRL por plano (centavos) vindo do source-of-truth compartilhado.
function revenueForPlan(planId: string): number {
  const cfg = (PLAN_CONFIG as Record<string, PlanConfig>)[planId];
  if (!cfg || cfg.priceMonthly == null) return 0;
  return Math.round(cfg.priceMonthly * 100);
}

// Custo infra rateado por tenant. Placeholder conservador — ajustar conforme
// cloud bill real (Fly.io, Neon, Upstash, Cloudflare R2).
// Regra provisória: 5% do MRR do plano, com piso de US$ 1,50.
function estimatedInfraCostUsd(planId: string): number {
  const mrrBrl = revenueForPlan(planId) / 100;
  const brlToUsd = 5.0; // aproximação; em produção puxar de fx table
  const mrrUsd = mrrBrl / brlToUsd;
  return Math.max(1.5, mrrUsd * 0.05);
}

// Lê total acumulado de custo LLM do Redis (chave de trial cap já acumula).
async function readLlmCostUsd(organizationId: string): Promise<number> {
  try {
    const raw = await redis.get(`zappiq:trial_cost_usd:${organizationId}`);
    return raw ? parseFloat(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

// ── Agregação por org ───────────────────────────────────
export async function aggregateOrgUsage(
  organizationId: string,
  yearMonth: string,
): Promise<void> {
  const { start, end } = monthRange(yearMonth);

  // Carrega plano atual para calcular revenue + infra
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, plan: true },
  });
  if (!org) return;

  // Queries em paralelo — cada uma é um count, barato com os índices existentes.
  const [
    conversationsOpened,
    conversationsClosed,
    conversationsHumanResolved,
    aiMessagesProcessed,
    handoffsCount,
    broadcastsSent,
  ] = await Promise.all([
    prisma.conversation.count({
      where: {
        organizationId,
        createdAt: { gte: start, lt: end },
      },
    }),
    prisma.conversation.count({
      where: {
        organizationId,
        closedAt: { gte: start, lt: end },
      },
    }),
    prisma.conversation.count({
      where: {
        organizationId,
        closedAt: { gte: start, lt: end },
        assignedToId: { not: null },
      },
    }),
    prisma.message.count({
      where: {
        conversation: { organizationId },
        direction: 'OUTBOUND',
        isFromBot: true,
        createdAt: { gte: start, lt: end },
      },
    }),
    // Proxy para handoff: conversas que passaram por WAITING no período.
    // Sem histórico de transição, usamos status atual + janela como aproximação.
    prisma.conversation.count({
      where: {
        organizationId,
        status: 'WAITING',
        updatedAt: { gte: start, lt: end },
      },
    }),
    // Broadcasts = soma sentCount de campaigns completadas no mês.
    prisma.campaign
      .aggregate({
        where: {
          organizationId,
          completedAt: { gte: start, lt: end },
        },
        _sum: { sentCount: true },
      })
      .then((r) => r._sum.sentCount ?? 0),
  ]);

  const conversationsAiResolved = Math.max(
    0,
    conversationsClosed - conversationsHumanResolved,
  );

  const llmCostUsd = await readLlmCostUsd(organizationId);
  const infraCostUsd = estimatedInfraCostUsd(org.plan);
  const revenueBrlCents = revenueForPlan(org.plan);

  // Margem bruta = (receita BRL convertida em USD − custo variável USD) / receita USD
  // Usa câmbio fixo conservador; aceitável para sinalização executiva, não para contabilidade.
  const brlToUsd = 5.0;
  const revenueUsd = revenueBrlCents / 100 / brlToUsd;
  const totalCostUsd = llmCostUsd + infraCostUsd;
  const grossMarginPercent =
    revenueUsd > 0 ? ((revenueUsd - totalCostUsd) / revenueUsd) * 100 : null;

  await (prisma as any).TenantUsageMonthly.upsert({
    where: {
      organizationId_periodYearMonth: {
        organizationId,
        periodYearMonth: yearMonth,
      },
    },
    create: {
      organizationId,
      periodYearMonth: yearMonth,
      llmCostUsd,
      llmInputTokens: BigInt(0),
      llmOutputTokens: BigInt(0),
      aiMessagesProcessed,
      broadcastsSent,
      conversationsOpened,
      conversationsClosed,
      conversationsAiResolved,
      conversationsHumanResolved,
      handoffsCount,
      revenueBrlCents,
      infraCostUsd,
      grossMarginPercent,
    },
    update: {
      llmCostUsd,
      aiMessagesProcessed,
      broadcastsSent,
      conversationsOpened,
      conversationsClosed,
      conversationsAiResolved,
      conversationsHumanResolved,
      handoffsCount,
      revenueBrlCents,
      infraCostUsd,
      grossMarginPercent,
    },
  });
}

// ── Ciclo completo ──────────────────────────────────────
export async function runTenantUsageCycle(): Promise<{
  orgsProcessed: number;
  orgsFailed: number;
  durationMs: number;
  periodsProcessed: string[];
}> {
  const started = Date.now();
  const now = new Date();
  const currentPeriod = currentYearMonth(now);

  // Até o dia 2 do mês, recomputa mês anterior também — garante que webhooks
  // tardios e jobs assíncronos finalizados depois da virada sejam capturados.
  const periods = [currentPeriod];
  if (now.getUTCDate() <= 2) {
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    periods.push(currentYearMonth(prev));
  }

  logger.info(
    `[TenantUsage] Iniciando ciclo — períodos=${periods.join(',')}`,
  );

  const orgs = await prisma.organization.findMany({
    select: { id: true },
  });

  let orgsProcessed = 0;
  let orgsFailed = 0;

  for (const org of orgs) {
    try {
      for (const period of periods) {
        await aggregateOrgUsage(org.id, period);
      }
      orgsProcessed++;
    } catch (err: any) {
      orgsFailed++;
      logger.warn(`[TenantUsage] Falha ao agregar org=${org.id}: ${err.message}`);
    }
  }

  const durationMs = Date.now() - started;
  logger.info(
    `[TenantUsage] Ciclo concluído — ok=${orgsProcessed}, falha=${orgsFailed}, ${durationMs}ms`,
  );

  return { orgsProcessed, orgsFailed, durationMs, periodsProcessed: periods };
}

// ── BullMQ bootstrap ────────────────────────────────────
export async function initTenantUsageJob(): Promise<void> {
  tenantUsageWorker = new Worker(
    'tenant-usage-aggregation',
    async () => {
      return runTenantUsageCycle();
    },
    { connection, concurrency: 1 },
  );

  tenantUsageWorker.on('failed', (job, err) => {
    logger.error(`[TenantUsage] Job ${job?.id} falhou`, { error: err.message });
  });

  tenantUsageWorker.on('completed', (job, result) => {
    logger.info(`[TenantUsage] Job ${job.id} concluído`, result as Record<string, unknown>);
  });

  // 03:10 UTC diariamente — dez minutos depois do retention para não competir
  // pelo mesmo pool de conexões Prisma na janela de baixo tráfego.
  await tenantUsageQueue.add(
    'daily-tenant-usage',
    {},
    {
      repeat: { pattern: '10 3 * * *' },
      jobId: 'tenant-usage-daily',
    },
  );

  logger.info('[TenantUsage] Job de agregação de unit economics agendado (diário 03:10 UTC)');
}

export async function closeTenantUsageJob(): Promise<void> {
  await tenantUsageWorker?.close();
  await tenantUsageQueue.close();
}
