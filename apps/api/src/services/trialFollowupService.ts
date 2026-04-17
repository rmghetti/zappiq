/**
 * Trial Followup Service · BullMQ
 *
 * Cria uma fila `trial-followup` que dispara e-mails de trial em momentos
 * específicos (D+3, D+10, último dia) e ao converter.
 *
 * Scheduler diário (14:00 UTC = 11h BRT) verifica all orgs com `isTrialActive=true`
 * e enfileira jobs conforme `daysRemaining`. Deduplicação por jobId determinístico.
 *
 * Job types:
 *   - trial:D3        → renderTrialSavingsFollowupEmail (D+3, 18 dias restantes)
 *   - trial:D10       → renderTrialMidwayEmail (D+10, 11 dias restantes)
 *   - trial:lastDay   → renderTrialLastDayEmail (último dia, 1 dia restante)
 *   - trial:converted → renderTrialConvertedEmail (ao converter, chamado via stripe webhook)
 */

import { Queue, Worker } from 'bullmq';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import redis from '../utils/redis.js';
import { sendEmail } from './email/emailProvider.js';
import { renderTrialSavingsFollowupEmail } from './email/templates/trialSavingsFollowup.js';
import { renderTrialMidwayEmail } from './email/templates/trialMidway.js';
import { renderTrialLastDayEmail } from './email/templates/trialLastDay.js';
import { renderTrialConvertedEmail } from './email/templates/trialConverted.js';

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

export const trialFollowupQueue = new Queue('trial-followup', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 30 },
  },
});

let trialFollowupWorker: Worker | null = null;

// ── Job payload types ──────────────────────────────
export interface TrialFollowupJobData {
  orgId: string;
  userId: string;
  type: 'trial:D3' | 'trial:D10' | 'trial:lastDay' | 'trial:converted';
  // Extras para trial:converted
  tierLabel?: string;
  monthlyBrl?: number;
}

// ── Helpers ────────────────────────────────────────
function daysUntilTrialEnds(trialEndsAt: Date | null): number {
  if (!trialEndsAt) return 14; // default fallback
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

// Placeholder: computar AI Readiness Score (se existir)
async function getAIReadinessScore(orgId: string): Promise<number> {
  try {
    // TODO: chamar real computeAIReadiness se estiver disponível
    // Por enquanto, retorna score dummy de 50-80
    return 50 + Math.floor(Math.random() * 30);
  } catch {
    return 50;
  }
}

// Calcula economia dummy (idealmente puxaria de savings real)
async function getEstimatedSavings(orgId: string): Promise<number> {
  try {
    // TODO: computar de verdade baseado em dados da org
    // Por enquanto, retorna valores entre 10k e 30k
    return 10000 + Math.floor(Math.random() * 20000);
  } catch {
    return 15000;
  }
}

// ── Worker ─────────────────────────────────────────
async function processTrialFollowupJob(job: any): Promise<void> {
  const jobData = job.data as TrialFollowupJobData;
  const { orgId, userId, type } = jobData;

  try {
    const [user, org] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.organization.findUnique({ where: { id: orgId } }),
    ]);

    if (!user || !org) {
      logger.warn({
        msg: 'trial_followup_user_or_org_not_found',
        orgId,
        userId,
        type,
      });
      return;
    }

    if (!user.email) {
      logger.warn({
        msg: 'trial_followup_no_email',
        orgId,
        userId,
        type,
      });
      return;
    }

    const firstName = (user.name || 'amigo(a)').split(' ')[0] ?? 'amigo(a)';
    const appUrl = env.APP_URL;

    let subject = '';
    let html = '';
    let text = '';

    // D+3 · trial:D3
    if (type === 'trial:D3') {
      const readiness = await getAIReadinessScore(orgId);
      const savings = await getEstimatedSavings(orgId);

      const rendered = renderTrialSavingsFollowupEmail({
        firstName,
        daysRemaining: 11,
        competitorSetupBrl: 8000,
        competitorMonthlyBrl: 1500,
        aiReadinessScore: readiness,
        ctaUrl: `${appUrl}/billing?coupon=TRIAL14&utm_source=email&utm_campaign=trial_d3`,
      });
      subject = rendered.subject;
      html = rendered.html;
      text = rendered.text;
    }

    // D+10 · trial:D10
    else if (type === 'trial:D10') {
      const readiness = await getAIReadinessScore(orgId);
      const savings = await getEstimatedSavings(orgId);

      const rendered = renderTrialMidwayEmail({
        firstName,
        daysRemaining: 4,
        aiReadinessScore: readiness,
        savings,
        ctaUrl: `${appUrl}/billing?coupon=TRIAL14&utm_source=email&utm_campaign=trial_d10`,
      });
      subject = rendered.subject;
      html = rendered.html;
      text = rendered.text;
    }

    // Último dia
    else if (type === 'trial:lastDay') {
      const readiness = await getAIReadinessScore(orgId);
      const savings = await getEstimatedSavings(orgId);

      const rendered = renderTrialLastDayEmail({
        firstName,
        aiReadinessScore: readiness,
        savings,
        ctaUrl: `${appUrl}/billing?coupon=LASTDAY14&utm_source=email&utm_campaign=trial_lastday`,
      });
      subject = rendered.subject;
      html = rendered.html;
      text = rendered.text;
    }

    // Convertido
    else if (type === 'trial:converted') {
      const tierLabel = jobData.tierLabel || 'Starter';
      const monthlyBrl = jobData.monthlyBrl || 247;

      const rendered = renderTrialConvertedEmail({
        firstName,
        orgName: org.name,
        tierLabel,
        monthlyBrl,
      });
      subject = rendered.subject;
      html = rendered.html;
      text = rendered.text;
    }

    // Dispara e-mail
    if (subject && html && text) {
      await sendEmail({
        to: user.email,
        subject,
        html,
        text,
        tags: ['trial_followup', `type:${type}`, `org:${orgId}`],
      });

      logger.info({
        msg: 'trial_followup_sent',
        orgId,
        userId,
        type,
        to: user.email,
        subject,
      });
    }
  } catch (err) {
    logger.error({
      msg: 'trial_followup_job_error',
      orgId,
      userId,
      type,
      error: String(err),
    });
    throw err; // Deixa BullMQ retentar
  }
}

// ── Init/Close ─────────────────────────────────────
export async function initTrialFollowupJob(): Promise<void> {
  // Worker: processa jobs da fila
  trialFollowupWorker = new Worker('trial-followup', processTrialFollowupJob as any, {
    connection,
    concurrency: 5,
  });

  trialFollowupWorker.on('completed', (job) => {
    logger.debug({
      msg: 'trial_followup_completed',
      jobId: job.id,
      jobName: job.name,
    });
  });

  trialFollowupWorker.on('failed', (job, err) => {
    logger.error({
      msg: 'trial_followup_failed',
      jobId: job?.id,
      jobName: job?.name,
      error: String(err),
    });
  });

  // Scheduler: job repeatable diário às 14:00 UTC (11h BRT)
  await trialFollowupQueue.add(
    'trial-followup-scheduler',
    { scheduler: true },
    {
      repeat: {
        pattern: '0 14 * * *', // cron UTC: 14:00 (11h BRT)
      },
      jobId: 'trial-followup-scheduler-daily',
    },
  );

  logger.info({
    msg: 'trial_followup_job_initialized',
    scheduler: '14:00 UTC daily',
  });
}

export async function closeTrialFollowupJob(): Promise<void> {
  if (trialFollowupWorker) {
    await trialFollowupWorker.close();
    trialFollowupWorker = null;
  }
  logger.info({ msg: 'trial_followup_job_closed' });
}

// ── Public API ─────────────────────────────────────

/**
 * Enfileira um job de trial followup.
 * Usa jobId determinístico para evitar duplicatas.
 *
 * @param orgId Organization ID
 * @param userId User ID
 * @param type Job type (trial:D3, trial:D10, trial:lastDay, trial:converted)
 * @param delayMs Delay em ms antes de executar (default: 0)
 */
export async function enqueueTrialFollowup(
  orgId: string,
  userId: string,
  type: TrialFollowupJobData['type'],
  delayMs: number = 0,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const jobId = `${orgId}:${type}:${today}`;

  await trialFollowupQueue.add(
    'trial-followup',
    { orgId, userId, type } as TrialFollowupJobData,
    {
      jobId,
      delay: delayMs,
    },
  );

  logger.debug({
    msg: 'trial_followup_enqueued',
    jobId,
    orgId,
    userId,
    type,
    delayMs,
  });
}

/**
 * Scheduler: chamado diariamente (14:00 UTC).
 * Varre organizations com isTrialActive=true e enfileira jobs
 * conforme daysRemaining.
 */
export async function runTrialFollowupScheduler(): Promise<void> {
  try {
    const allOrgs = (await prisma.organization.findMany({
      include: {
        users: {
          where: { role: 'ADMIN' },
          select: { id: true },
          take: 1,
        },
      },
    })) as any[];

    // Filter in-memory since Prisma generated types don't include isTrialActive in where
    const orgs = allOrgs.filter((org) => (org as any).isTrialActive === true);

    logger.info({
      msg: 'trial_followup_scheduler_run',
      orgsToProcess: orgs.length,
    });

    for (const org of orgs) {
      const daysRemaining = daysUntilTrialEnds((org as any).trialEndsAt);
      const adminUser = (org as any).users[0];

      if (!adminUser) {
        logger.warn({
          msg: 'trial_followup_no_admin_user',
          orgId: org.id,
        });
        continue;
      }

      // D+3 (18 dias restantes)
      if (daysRemaining === 18) {
        await enqueueTrialFollowup(org.id, adminUser.id, 'trial:D3');
      }

      // D+10 (11 dias restantes)
      if (daysRemaining === 11) {
        await enqueueTrialFollowup(org.id, adminUser.id, 'trial:D10');
      }

      // Último dia (1 dia restante)
      if (daysRemaining === 1) {
        await enqueueTrialFollowup(org.id, adminUser.id, 'trial:lastDay');
      }
    }

    logger.info({
      msg: 'trial_followup_scheduler_complete',
      orgsProcessed: orgs.length,
    });
  } catch (err) {
    logger.error({
      msg: 'trial_followup_scheduler_error',
      error: String(err),
    });
    throw err;
  }
}
