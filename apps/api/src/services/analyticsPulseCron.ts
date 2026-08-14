/* ══════════════════════════════════════════════════════════════════════
 * Analytics "Pulso" Cron (Fase 2) — gera o insight diário por org.
 * --------------------------------------------------------------------
 * Roda 03:20 UTC (antes do eval das 04:30 e do reconciliation, pra não
 * concorrer por bandwidth Anthropic). Para cada org: computa o snapshot do
 * dia anterior, detecta anomalias e persiste 1 insight (IA narra; fallback
 * determinístico garantido). Fail-soft por org — uma falha não derruba o ciclo.
 *
 * Estrutura espelhada de agentEvalCronService.ts (BullMQ repeatable job).
 * ══════════════════════════════════════════════════════════════════════ */

import { Queue, Worker } from 'bullmq';
import { prisma } from '@zappiq/database';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { generatePulseInsight } from './analyticsPulse.js';
import { queueConnection as connection } from '../config/queueRedis.js';

export const analyticsPulseQueue = new Queue('analytics-pulse-cron', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 14 },
    removeOnFail: { count: 30 },
    attempts: 1,
  },
});

let analyticsPulseWorker: Worker | null = null;

/** Dia de referência = ONTEM (UTC), já fechado. */
function yesterdayUTC(): Date {
  return new Date(Date.now() - 86400000);
}

export async function runAnalyticsPulseCycle(): Promise<{
  organizationsProcessed: number;
  insightsCreated: number;
  alerted: number;
  failed: number;
  durationMs: number;
}> {
  const startedAt = Date.now();
  const ref = yesterdayUTC();
  let processed = 0, created = 0, alerted = 0, failed = 0;

  const orgs = await prisma.organization.findMany({ select: { id: true } });
  logger.info({ msg: 'analytics_pulse_cron_start', orgs: orgs.length, refDate: ref.toISOString().slice(0, 10) });

  for (const org of orgs) {
    try {
      const { created: didCreate, severity } = await generatePulseInsight(org.id, ref);
      processed++;
      if (didCreate) created++;
      if (severity === 'attention' || severity === 'critical') alerted++;
    } catch (err: any) {
      failed++;
      logger.error({ msg: 'analytics_pulse_cron_org_failed', organizationId: org.id, error: String(err?.message ?? err) });
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.info({ msg: 'analytics_pulse_cron_done', organizationsProcessed: processed, insightsCreated: created, alerted, failed, durationMs });
  return { organizationsProcessed: processed, insightsCreated: created, alerted, failed, durationMs };
}

export async function initAnalyticsPulseCronJob(): Promise<void> {
  // Kill-switch: ANALYTICS_PULSE_CRON='0' desliga a geração diária (custo de LLM)
  // sem redeploy de código — basta `fly secrets set` e restart. Endpoint manual
  // /insights/refresh continua funcionando.
  if (process.env.ANALYTICS_PULSE_CRON === '0') {
    logger.warn('[analyticsPulseCron] desativado via ANALYTICS_PULSE_CRON=0');
    return;
  }

  analyticsPulseWorker = new Worker(
    'analytics-pulse-cron',
    async () => runAnalyticsPulseCycle(),
    { connection, concurrency: 1 },
  );

  analyticsPulseWorker.on('failed', (job, err) => {
    logger.error({ msg: 'analytics_pulse_cron_job_failed', jobId: job?.id, error: String(err?.message ?? err) });
  });

  // 03:20 UTC todo dia.
  await analyticsPulseQueue.add(
    'daily-analytics-pulse',
    {},
    { repeat: { pattern: '20 3 * * *' }, jobId: 'analytics-pulse-daily' },
  );
  logger.info('[analyticsPulseCron] job diário registrado (03:20 UTC)');
}

export async function closeAnalyticsPulseCronJob(): Promise<void> {
  await analyticsPulseWorker?.close();
  await analyticsPulseQueue.close();
}
