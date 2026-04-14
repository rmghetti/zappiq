/**
 * LGPD retention service.
 *
 * Obrigações cobertas:
 * - Art. 15 — término do tratamento quando o objetivo é alcançado
 * - Art. 16 — eliminação dos dados após o término do tratamento
 * - Art. 12 — dado anonimizado não é considerado dado pessoal
 *
 * Política:
 * 1. Conversas soft-deletadas há mais de `softDeleteRetentionDays` → hard delete
 *    (preservando apenas a trilha em audit_logs para fins de prestação de contas).
 * 2. Audit logs com mais de `auditRetentionDays` → anonimizados (PII removida,
 *    estrutura mantida para estatística + verificação de cadeia até o ponto).
 * 3. Defaults: 730d (2 anos) soft-deleted / 1825d (5 anos) audit — ajustáveis por org.
 *
 * O job roda diariamente às 03:00 UTC via BullMQ repeatable job.
 */
import { Queue, Worker } from 'bullmq';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { anonymizeExpiredAuditLogs } from './auditService.js';

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

export const retentionQueue = new Queue('lgpd-retention', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50 },
  },
});

let retentionWorker: Worker | null = null;

/** Purge físico de conversas soft-deletadas além do prazo. */
async function hardDeleteExpiredSoftDeletes(): Promise<number> {
  const orgs = await prisma.organization.findMany({
    select: { id: true, softDeleteRetentionDays: true },
  });

  let totalDeleted = 0;
  for (const org of orgs) {
    const cutoff = new Date(Date.now() - org.softDeleteRetentionDays * 24 * 60 * 60 * 1000);

    // Encontrar IDs alvo antes de deletar — precisamos logar no audit antes.
    const targets = await prisma.conversation.findMany({
      where: {
        organizationId: org.id,
        deletedAt: { lt: cutoff, not: null },
      },
      select: { id: true, contactId: true, deletedAt: true },
    });

    if (targets.length === 0) continue;

    // Deletar (cascade limpa messages + internalNotes via schema)
    const result = await prisma.conversation.deleteMany({
      where: { id: { in: targets.map((t) => t.id) } },
    });

    totalDeleted += result.count;

    logger.info(`[Retention] Hard-deleted ${result.count} conversations (org=${org.id}, retention=${org.softDeleteRetentionDays}d)`);
  }

  return totalDeleted;
}

/** Anonimização de audit logs além do prazo de retenção por organização. */
async function anonymizeExpiredAudits(): Promise<number> {
  const orgs = await prisma.organization.findMany({
    select: { id: true, auditRetentionDays: true },
  });

  let totalAnonymized = 0;
  for (const org of orgs) {
    const count = await anonymizeExpiredAuditLogs(org.id, org.auditRetentionDays);
    totalAnonymized += count;
  }
  return totalAnonymized;
}

/** Expira DSRs que ultrapassaram o prazo legal de 15 dias sem tratamento. */
async function expireOverdueDsrs(): Promise<number> {
  const now = new Date();
  const result = await prisma.dataSubjectRequest.updateMany({
    where: {
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      dueDate: { lt: now },
    },
    data: { status: 'EXPIRED' },
  });

  if (result.count > 0) {
    logger.warn(`[Retention] ${result.count} DSRs marcadas como EXPIRED (fora do prazo legal de 15 dias — Art. 19)`);
  }
  return result.count;
}

export async function runRetentionCycle(): Promise<{ deleted: number; anonymized: number; expiredDsrs: number }> {
  logger.info('[Retention] Iniciando ciclo de retenção LGPD');

  const [deleted, anonymized, expiredDsrs] = await Promise.all([
    hardDeleteExpiredSoftDeletes(),
    anonymizeExpiredAudits(),
    expireOverdueDsrs(),
  ]);

  logger.info(`[Retention] Ciclo concluído — deleted=${deleted}, anonymized=${anonymized}, expiredDsrs=${expiredDsrs}`);
  return { deleted, anonymized, expiredDsrs };
}

export async function initRetentionJob(): Promise<void> {
  // Worker que executa o ciclo
  retentionWorker = new Worker(
    'lgpd-retention',
    async () => {
      return runRetentionCycle();
    },
    { connection, concurrency: 1 },
  );

  retentionWorker.on('failed', (job, err) => {
    logger.error(`[Retention] Job ${job?.id} falhou`, { error: err.message });
  });

  retentionWorker.on('completed', (job, result) => {
    logger.info(`[Retention] Job ${job.id} concluído`, result as Record<string, unknown>);
  });

  // Agendar job diário às 03:00 UTC (baixo tráfego)
  await retentionQueue.add(
    'daily-retention',
    {},
    {
      repeat: { pattern: '0 3 * * *' }, // cron: 03:00 UTC diariamente
      jobId: 'lgpd-retention-daily',    // dedupe — não duplica no restart
    },
  );

  logger.info('[Retention] Job de retenção LGPD agendado (diário 03:00 UTC)');
}

export async function closeRetentionJob(): Promise<void> {
  await retentionWorker?.close();
  await retentionQueue.close();
}
