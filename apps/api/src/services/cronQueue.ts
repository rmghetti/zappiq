/**
 * Fila única de cron do ZappIQ.
 *
 * Antes: 11 filas BullMQ, uma por rotina, cada uma com Queue + Worker
 * próprios. Como toda máquina do Fly sobe todos os workers, eram 22 workers
 * ociosos batendo no Redis 24/7 só para rodar rotinas que disparam uma vez
 * por dia. Foi isso que produziu 3,1 milhões de comandos por dia no Upstash.
 *
 * Agora: uma fila `cron` com jobs nomeados e UM worker por máquina. O BullMQ
 * garante que só uma máquina pega cada disparo, então os dois nós continuam
 * cobrindo um ao outro sem executar a rotina em duplicidade.
 *
 * O que deliberadamente NÃO entrou aqui:
 *   - `campaign-scheduler-cron`: dispara a cada minuto, não é rotina ociosa,
 *     e com concorrência limitada ficaria atrás de rotina diária longa.
 *   - `trial-followup`: é fila de trabalho de verdade (jobs por organização,
 *     concorrência 5), não só um tique. Só o tique diário dela virou job
 *     desta fila; o envio por organização continua na fila própria.
 *
 * Para adicionar uma rotina nova: entre em CRON_JOBS. Não crie fila.
 */
import { Queue, Worker, type Job } from 'bullmq';

import { queueConnection as connection } from '../config/queueRedis.js';
import { logger } from '../utils/logger.js';
import { runAgentEvalCronCycle } from './agentEvalCronService.js';
import { runAnalyticsPulseCycle } from './analyticsPulseCron.js';
import { runConversationExpiryCycle } from './conversationExpiryService.js';
import { runCostGuardCycle } from './costGuardService.js';
import { runMiraMirrors } from './mira/cnpjMirrorSync.js';
import { runMiraReleasesCycle } from './mira/releasesCron.js';
import { runRetentionCycle } from './retentionService.js';
import { runDigest } from './superadminTrialDigestCron.js';
import { runTenantUsageCycle } from './tenantUsageService.js';
import { runTrialExpirationCycle } from './trialExpirationCron.js';
import { runTrialFollowupScheduler } from './trialFollowupService.js';
import { runUsageReconciliationCycle } from './usageReconciliationService.js';
import { runWabaHealthSweep } from './wabaHealthService.js';

export const cronQueue = new Queue('cron', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 200 },
  },
});

export interface CronJobDefinition {
  /** Nome do job dentro da fila `cron`. É o que o worker usa pra despachar. */
  name: string;
  /** Padrão cron em UTC. */
  pattern: string;
  run: () => Promise<unknown>;
}

/**
 * Horários preservados exatamente como estavam nas filas antigas. O
 * escalonamento (03:00, 03:10, 03:20, 03:40, 04:00, 04:30) é intencional:
 * espalha a carga da madrugada.
 */
export const CRON_JOBS: CronJobDefinition[] = [
  { name: 'lgpd-retention', pattern: '0 3 * * *', run: runRetentionCycle },
  { name: 'tenant-usage-aggregation', pattern: '10 3 * * *', run: runTenantUsageCycle },
  { name: 'analytics-pulse', pattern: '20 3 * * *', run: runAnalyticsPulseCycle },
  { name: 'trial-expiration', pattern: '40 3 * * *', run: runTrialExpirationCycle },
  { name: 'usage-reconciliation', pattern: '0 4 * * *', run: runUsageReconciliationCycle },
  { name: 'agent-eval-iza', pattern: '30 4 * * *', run: () => runAgentEvalCron('iza') },
  { name: 'agent-eval-clients', pattern: '30 4 * * 1', run: () => runAgentEvalCron('clients') },
  { name: 'mira-releases', pattern: '0 6 * * 1', run: runMiraReleasesCycle },
  { name: 'mira-cnpj-mirror', pattern: '0 6 1 * *', run: runMiraMirrors },
  { name: 'superadmin-trial-digest', pattern: '0 13 * * *', run: runDigest },
  { name: 'trial-followup-scheduler', pattern: '0 14 * * *', run: runTrialFollowupScheduler },
  // Resposta Meta out/2026 — rotinas novas (não vieram de fila antiga).
  // Expiração de conversa parada 72h, de hora em hora no minuto 50: fora dos
  // minutos das rotinas da madrugada pra não empilhar carga no mesmo instante.
  { name: 'conversation-expiry', pattern: '50 * * * *', run: runConversationExpiryCycle },
  // Varredura de saúde do WABA a cada 6 horas. O handler real chega no PR-D;
  // o stub atual garante que o registro compila e o horário já fica travado.
  { name: 'waba-health', pattern: '5 */6 * * *', run: runWabaHealthSweep },
  // Cost Guard (PR-H, decisão D5): custo Meta do mês × teto efetivo por org,
  // de hora em hora no minuto 20 (fora dos minutos 50 e 5 das rotinas acima).
  // Às 03:20 coincide com o analytics-pulse diário; a concorrência 3 do
  // worker absorve as duas sem uma segurar a outra.
  { name: 'cost-guard', pattern: '20 * * * *', run: runCostGuardCycle },
];

/**
 * Kill-switch de custo que vivia dentro do worker do agent-eval. Preservado
 * na íntegra: pausa a auditoria automática sem precisar de deploy.
 */
async function runAgentEvalCron(scope: 'iza' | 'clients'): Promise<unknown> {
  if (process.env.AGENT_EVAL_CRON_DISABLED === 'true') {
    logger.warn('[cron] AGENT_EVAL_CRON_DISABLED=true — ciclo do agent-eval pulado (kill-switch).');
    return { agentsProcessed: 0, agentsAlerted: 0, agentsFailed: 0, durationMs: 0 };
  }
  return runAgentEvalCronCycle(scope);
}

/**
 * Filas que existiam só para hospedar um cron e não são mais alimentadas.
 * Os repetíveis delas precisam sair do Redis, senão ficam agendados para
 * sempre sem ninguém para processar.
 */
export const LEGACY_CRON_QUEUES = [
  'lgpd-retention',
  'tenant-usage-aggregation',
  'analytics-pulse-cron',
  'trial-expiration-cron',
  'usage-reconciliation',
  'agent-eval-cron',
  'mira-releases-cron',
  'mira-cnpj-mirror-cron',
  'superadmin-trial-digest',
];

/**
 * Remove os agendamentos das filas antigas.
 *
 * Enumera o que está de fato registrado no Redis em vez de assumir os
 * pares (nome, padrão) do código: se algum agendamento tiver ficado para
 * trás numa mudança anterior, ele sai também.
 *
 * Idempotente de propósito, porque as duas máquinas do Fly rodam isto no
 * boot. Falha aqui é logada e não derruba o init: cron novo já está de pé.
 */
export async function removeLegacyCronSchedulers(): Promise<number> {
  let removed = 0;

  for (const queueName of LEGACY_CRON_QUEUES) {
    const legacy = new Queue(queueName, { connection });
    try {
      const schedulers = await legacy.getJobSchedulers();
      for (const scheduler of schedulers) {
        await legacy.removeJobScheduler(scheduler.key);
        removed += 1;
        logger.info({
          msg: 'cron_legacy_scheduler_removed',
          queue: queueName,
          scheduler: scheduler.key,
        });
      }
    } catch (err) {
      logger.error({
        msg: 'cron_legacy_scheduler_cleanup_failed',
        queue: queueName,
        error: String((err as Error)?.message ?? err),
      });
    } finally {
      await legacy.close().catch(() => undefined);
    }
  }

  // O tique diário do trial-followup migrou, mas a fila continua viva para os
  // jobs por organização. Só o agendamento sai.
  const followup = new Queue('trial-followup', { connection });
  try {
    for (const scheduler of await followup.getJobSchedulers()) {
      await followup.removeJobScheduler(scheduler.key);
      removed += 1;
      logger.info({
        msg: 'cron_legacy_scheduler_removed',
        queue: 'trial-followup',
        scheduler: scheduler.key,
      });
    }
  } catch (err) {
    logger.error({
      msg: 'cron_legacy_scheduler_cleanup_failed',
      queue: 'trial-followup',
      error: String((err as Error)?.message ?? err),
    });
  } finally {
    await followup.close().catch(() => undefined);
  }

  return removed;
}

let cronWorker: Worker | undefined;

export async function initCronQueue(): Promise<void> {
  // Concorrência 3 e não 1: as rotinas diárias eram filas separadas e rodavam
  // em paralelo. Com 1, uma rotina longa às 03:00 seguraria a das 03:10.
  cronWorker = new Worker(
    'cron',
    async (job: Job) => {
      const definition = CRON_JOBS.find((c) => c.name === job.name);
      if (!definition) {
        // Job de uma versão anterior do registro. Falhar alto é pior que
        // logar: o BullMQ tentaria de novo para sempre.
        logger.warn({ msg: 'cron_job_desconhecido', name: job.name, jobId: job.id });
        return;
      }
      logger.info({ msg: 'cron_job_start', name: job.name, jobId: job.id });
      const result = await definition.run();
      logger.info({ msg: 'cron_job_done', name: job.name, jobId: job.id });
      return result;
    },
    { connection, concurrency: 3 },
  );

  cronWorker.on('failed', (job, err) => {
    logger.error({
      msg: 'cron_job_failed',
      name: job?.name,
      jobId: job?.id,
      attempts: job?.attemptsMade,
      error: String(err?.message ?? err),
    });
  });

  cronWorker.on('error', (err) => {
    const transitório = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].some((e) =>
      err.message.includes(e),
    );
    if (transitório) {
      logger.warn(`[cron] erro transitório no Redis (vai reconectar): ${err.message}`);
    } else {
      logger.error(`[cron] erro no worker: ${err.message}`);
    }
  });

  await removeLegacyCronSchedulers();

  for (const { name, pattern } of CRON_JOBS) {
    await cronQueue.add(name, {}, { repeat: { pattern }, jobId: `cron:${name}` });
  }

  logger.info({ msg: 'cron_queue_pronta', jobs: CRON_JOBS.length });
}

export async function closeCronQueue(): Promise<void> {
  await cronWorker?.close();
  await cronQueue.close();
}
