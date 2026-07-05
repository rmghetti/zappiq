/* ══════════════════════════════════════════════════════════════════════
 * Campaign Scheduler Cron (W2.4) — dispara campanhas agendadas.
 * --------------------------------------------------------------------
 * ANTES: criar/atualizar uma campanha com scheduledAt só setava status
 * SCHEDULED — nada NUNCA varria essas campanhas nem enfileirava o disparo,
 * então elas ficavam SCHEDULED pra sempre. O loop ficava aberto.
 *
 * DEPOIS: um repeatable job (a cada minuto) varre campanhas com
 * status=SCHEDULED e scheduledAt<=now e enfileira o dispatch na
 * campaign-dispatch queue (mesmo caminho do POST /:id/send). Idempotente:
 * marca a campanha QUEUED-via-status SENDING? Não — deixamos o dispatch
 * transicionar; para não re-enfileirar a mesma campanha no minuto seguinte,
 * setamos status='SENDING' ANTES de enfileirar (o próprio dispatch também
 * seta SENDING, então é seguro).
 *
 * Estrutura espelhada de analyticsPulseCron.ts (BullMQ repeatable job).
 * ══════════════════════════════════════════════════════════════════════ */

import { Queue, Worker } from 'bullmq';
import { prisma } from '@zappiq/database';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { campaignDispatchQueue } from './queueService.js';

const redisUrl = new URL(env.REDIS_URL);
const isTLS = env.REDIS_URL.startsWith('rediss://');
const connection = {
  host: redisUrl.hostname || 'localhost',
  port: Number(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
  username: redisUrl.username || undefined,
  ...(isTLS ? { tls: { rejectUnauthorized: false } } : {}),
};

export const campaignSchedulerQueue = new Queue('campaign-scheduler-cron', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 60 },
    removeOnFail: { count: 60 },
    attempts: 1,
  },
});

let campaignSchedulerWorker: Worker | null = null;

/**
 * Varre campanhas SCHEDULED vencidas (scheduledAt<=now) e enfileira o
 * dispatch de cada uma. Para evitar re-enfileirar no ciclo seguinte, marca
 * a campanha como SENDING (transição idempotente com o dispatch worker).
 * Fail-soft por campanha. Exportado pra teste unitário.
 */
export async function runCampaignSchedulerCycle(
  now: Date = new Date(),
): Promise<{ due: number; enqueued: number; failed: number }> {
  const due = await prisma.campaign.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
    select: { id: true, organizationId: true },
  });

  if (due.length === 0) return { due: 0, enqueued: 0, failed: 0 };
  logger.info(`[campaignScheduler] ${due.length} campanha(s) agendada(s) vencida(s)`);

  let enqueued = 0;
  let failed = 0;
  for (const c of due) {
    try {
      // Marca SENDING ANTES de enfileirar — impede disparo duplicado no
      // próximo tick caso o job leve pra ser processado. updateMany com
      // filtro em status=SCHEDULED garante que só um ciclo "ganha" a corrida.
      const claimed = await prisma.campaign.updateMany({
        where: { id: c.id, status: 'SCHEDULED' },
        data: { status: 'SENDING' },
      });
      if (claimed.count === 0) continue; // outro ciclo já pegou

      await campaignDispatchQueue.add('dispatch', {
        campaignId: c.id,
        organizationId: c.organizationId,
      });
      enqueued++;
      logger.info(`[campaignScheduler] campanha ${c.id} enfileirada para disparo`);
    } catch (err) {
      failed++;
      logger.error(`[campaignScheduler] falha ao enfileirar campanha ${c.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { due: due.length, enqueued, failed };
}

export async function initCampaignSchedulerCronJob(): Promise<void> {
  // Kill-switch: CAMPAIGN_SCHEDULER_CRON='0' desliga o sweep sem redeploy.
  if (process.env.CAMPAIGN_SCHEDULER_CRON === '0') {
    logger.warn('[campaignScheduler] desativado via CAMPAIGN_SCHEDULER_CRON=0');
    return;
  }

  campaignSchedulerWorker = new Worker(
    'campaign-scheduler-cron',
    async () => runCampaignSchedulerCycle(),
    { connection, concurrency: 1 },
  );

  campaignSchedulerWorker.on('failed', (job, err) => {
    logger.error(`[campaignScheduler] job ${job?.id} falhou: ${err?.message ?? err}`);
  });

  // A cada minuto: varre SCHEDULED vencidas.
  await campaignSchedulerQueue.add(
    'sweep-scheduled-campaigns',
    {},
    { repeat: { pattern: '* * * * *' }, jobId: 'campaign-scheduler-sweep' },
  );
  logger.info('[campaignScheduler] sweep de campanhas agendadas registrado (a cada minuto)');
}

export async function closeCampaignSchedulerCronJob(): Promise<void> {
  await campaignSchedulerWorker?.close();
  await campaignSchedulerQueue.close();
}
