/* ══════════════════════════════════════════════════════════════════════
 * Trial Expiration Cron (Área Clientes / Fase 1).
 * --------------------------------------------------------------------
 * Job diário que fecha trials vencidos e mantém o estado canônico fresco:
 *   1) organizations: isTrialActive=false onde trialEndsAt < now e churnedAt
 *      é NULL (e ainda estava ativo). ADITIVO — nunca apaga dado.
 *   2) crm_accounts.lifecycleStage: recomputado via deriveLifecycleStage()
 *      (híbrido materializado — a verdade é a função pura, o cron materializa).
 *
 * Estrutura espelhada de analyticsPulseCron.ts (BullMQ repeatable job).
 * Fail-soft por org — uma falha não derruba o ciclo. Kill-switch por env.
 * ══════════════════════════════════════════════════════════════════════ */

import { Queue, Worker } from 'bullmq';
import { prisma } from '@zappiq/database';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { deriveLifecycleStage } from './accountLifecycle.js';
import { queueConnection as connection } from '../config/queueRedis.js';

let trialExpirationWorker: Worker | null = null;

export async function runTrialExpirationCycle(): Promise<{
  trialsClosed: number;
  crmAccountsRecomputed: number;
  failed: number;
  durationMs: number;
}> {
  const startedAt = Date.now();
  const now = new Date();
  let trialsClosed = 0;
  let recomputed = 0;
  let failed = 0;

  // 1) Fecha trials vencidos (aditivo: só flip do booleano onde já venceu).
  //    A comparação de trialEndsAt vs now é feita pelo Postgres aqui; a
  //    derivação canônica que classifica TRIAL vs TRIAL_EXPIRED continua no
  //    service layer (deriveLifecycleStage) — não convertemos tipos de coluna.
  try {
    const closed = await prisma.organization.updateMany({
      where: {
        trialEndsAt: { lt: now },
        churnedAt: null,
        isTrialActive: true,
      },
      data: { isTrialActive: false },
    });
    trialsClosed = closed.count;
  } catch (err: any) {
    failed++;
    logger.error({ msg: 'trial_expiration_close_failed', error: String(err?.message ?? err) });
  }

  // 2) Recomputa o lifecycleStage materializado de cada conta CRM ligada a org.
  const accounts = await prisma.crmAccount.findMany({
    where: { organizationId: { not: null } },
    select: {
      id: true,
      lifecycleStage: true,
      organization: {
        select: {
          churnedAt: true,
          subscriptionStatus: true,
          stripeSubscriptionId: true,
          trialEndsAt: true,
          isTrialActive: true,
          trialConverted: true,
          paidAt: true,
        },
      },
    },
  });

  for (const acc of accounts) {
    try {
      if (!acc.organization) continue;
      const stage = deriveLifecycleStage({
        now,
        churnedAt: acc.organization.churnedAt,
        subscriptionStatus: acc.organization.subscriptionStatus,
        stripeSubscriptionId: acc.organization.stripeSubscriptionId,
        trialEndsAt: acc.organization.trialEndsAt,
        isTrialActive: acc.organization.isTrialActive,
        trialConverted: acc.organization.trialConverted,
        paidAt: acc.organization.paidAt,
      });
      if (stage !== acc.lifecycleStage) {
        await prisma.crmAccount.update({
          where: { id: acc.id },
          data: { lifecycleStage: stage },
        });
        // materializa também na org (cache secundário consultado por filtros).
        await prisma.crmAccountActivity.create({
          data: {
            crmAccountId: acc.id,
            type: 'lifecycle_change',
            payload: { from: acc.lifecycleStage, to: stage, source: 'trial_expiration_cron' },
          },
        });
        recomputed++;
      }
    } catch (err: any) {
      failed++;
      logger.error({ msg: 'trial_expiration_recompute_failed', crmAccountId: acc.id, error: String(err?.message ?? err) });
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.info({ msg: 'trial_expiration_cron_done', trialsClosed, crmAccountsRecomputed: recomputed, failed, durationMs });
  return { trialsClosed, crmAccountsRecomputed: recomputed, failed, durationMs };
}

