/* ══════════════════════════════════════════════════════════════════════
 * Mira Prospects — cron mensal do espelho de CNPJ (BullMQ).
 * --------------------------------------------------------------------
 * Registra o job repetível que chama syncCnpjMirror (lógica em cnpjMirror.ts)
 * dia 1 de cada mês. A materialização é o único job "caro" (varre a partição
 * inteira da base BD Pro, ~50-76 GB), roda 1x/mês e cabe no 1 TiB/mês grátis;
 * a descoberta B2B consulta a tabela espelho barata. Ver cnpjMirror.ts e doc 10.
 * Estrutura espelhada de analyticsPulseCron.ts.
 * ══════════════════════════════════════════════════════════════════════ */

import { Queue, Worker } from 'bullmq';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { bigQueryDisponivel } from './bigqueryClient.js';
import { syncCnpjMirror } from './cnpjMirror.js';
import { syncCagedSetor } from './cagedMirror.js';

export { syncCnpjMirror };

/** Roda os dois espelhos mensais do Mira (CNPJ ativos + sinal setorial CAGED). */
async function runMiraMirrors(): Promise<void> {
  await syncCnpjMirror();
  await syncCagedSetor();
}

const redisUrl = new URL(env.REDIS_URL);
const isTLS = env.REDIS_URL.startsWith('rediss://');
const connection = {
  host: redisUrl.hostname || 'localhost',
  port: Number(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
  username: redisUrl.username || undefined,
  ...(isTLS ? { tls: { rejectUnauthorized: false } } : {}),
};

export const cnpjMirrorQueue = new Queue('mira-cnpj-mirror-cron', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 6 },
    removeOnFail: { count: 12 },
    attempts: 1,
  },
});

let cnpjMirrorWorker: Worker | null = null;

export async function initCnpjMirrorSyncCronJob(): Promise<void> {
  // Kill-switch sem redeploy: MIRA_CNPJ_MIRROR_CRON='0'.
  if (process.env.MIRA_CNPJ_MIRROR_CRON === '0') {
    logger.warn('[cnpjMirrorSync] desativado via MIRA_CNPJ_MIRROR_CRON=0');
    return;
  }
  // Sem BigQuery configurado, não registra o job (silencioso — o Mira degrada
  // para índice local / busca pública, como já fazia).
  if (!bigQueryDisponivel()) {
    logger.info('[cnpjMirrorSync] BigQuery não configurado; espelho mensal inativo.');
    return;
  }

  cnpjMirrorWorker = new Worker(
    'mira-cnpj-mirror-cron',
    async () => runMiraMirrors(),
    { connection, concurrency: 1 },
  );
  cnpjMirrorWorker.on('failed', (job, err) => {
    logger.error({ msg: 'mira_cnpj_mirror_cron_job_failed', jobId: job?.id, error: String(err?.message ?? err) });
  });

  // Dia 1 de cada mês, 06:00 UTC (a Base dos Dados atualiza a base mensalmente).
  await cnpjMirrorQueue.add(
    'monthly-cnpj-mirror',
    {},
    { repeat: { pattern: '0 6 1 * *' }, jobId: 'mira-cnpj-mirror-monthly' },
  );
  logger.info('[cnpjMirrorSync] job mensal registrado (dia 1, 06:00 UTC)');
}

export async function closeCnpjMirrorSyncCronJob(): Promise<void> {
  await cnpjMirrorWorker?.close();
  await cnpjMirrorQueue.close();
}
