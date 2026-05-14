/**
 * Trial Followup Service · BullMQ
 *
 * FASE 1.B task #240 (2026-05-13): refatorado pra D+1/D+3/D+7 (era D+3/D+10/lastDay).
 * Razão: diagnóstico de ativação V5.3 mostrou 0% conversão de trials externos.
 * Ataca cedo (D+1), reforça (D+3), última chance (D+7) — ao invés de esperar
 * trial quase acabar.
 *
 * Scheduler diário (14:00 UTC = 11h BRT) varre orgs com isTrialActive=true,
 * calcula daysSinceCreated, e enfileira jobs por stage. Dedup tripla:
 *   1. BullMQ jobId determinístico (orgId:stage:today)
 *   2. onboarding_journey_state UNIQUE (orgId, stage) — audit + idempotency
 *   3. Worker checa onboarding_journey_state antes de enviar (safety net)
 *
 * Job types:
 *   - trial:D1        → renderTrialMidwayEmail (D+1, lembrete config WA)
 *   - trial:D3        → renderTrialSavingsFollowupEmail (D+3, oferta call 1:1)
 *   - trial:D7        → renderTrialLastDayEmail (D+7, último toque)
 *   - trial:converted → renderTrialConvertedEmail (Stripe webhook trigger)
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
// FASE 1.B (#240): renomeado de D3/D10/lastDay pra D1/D3/D7 (mais cedo).
export type TrialStage = 'D1' | 'D3' | 'D7';

export interface TrialFollowupJobData {
  orgId: string;
  userId: string;
  type: 'trial:D1' | 'trial:D3' | 'trial:D7' | 'trial:converted';
  // Extras para trial:converted
  tierLabel?: string;
  monthlyBrl?: number;
}

// ── Helpers ────────────────────────────────────────
function daysSinceCreated(createdAt: Date): number {
  return Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntilTrialEnds(trialEndsAt: Date | null): number {
  if (!trialEndsAt) return 14;
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

/**
 * Verifica se um stage já foi enviado pra essa org via tabela audit.
 * Garante idempotência mesmo se BullMQ jobId expirou (>30 jobs no histórico).
 */
async function alreadySent(orgId: string, stage: TrialStage): Promise<boolean> {
  const existing = await prisma.onboardingJourneyState.findUnique({
    where: { organizationId_stage: { organizationId: orgId, stage } },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Marca um stage como enviado. Idempotente (UNIQUE constraint).
 */
async function markSent(
  orgId: string,
  stage: TrialStage,
  templateId: string,
  emailProviderId: string | undefined,
  orgSnapshot: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.onboardingJourneyState.create({
      data: {
        organizationId: orgId,
        stage,
        templateId,
        emailProviderId,
        // Prisma JSON field exige InputJsonValue (recursivo). Cast pra any
        // é seguro aqui — orgSnapshot é shape simples (strings/numbers) e
        // o DB faz a serialização JSONB nativamente.
        orgSnapshot: orgSnapshot as any,
      },
    });
  } catch (err: any) {
    // P2002 = unique constraint violation — significa que já foi marcado
    // (race condition entre 2 workers). Silently ignore.
    if (err?.code !== 'P2002') {
      logger.warn({ msg: 'mark_sent_failed', orgId, stage, err: String(err) });
    }
  }
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
  // FASE 1.B: job 'trial-followup-scheduler' (repeatable diário) chama o
  // varredor que enfileira jobs individuais por org. Jobs individuais têm
  // payload TrialFollowupJobData e renderizam/enviam email.
  if (job.name === 'trial-followup-scheduler' || job.data?.scheduler === true) {
    logger.info({ msg: 'trial_followup_scheduler_tick', jobId: job.id });
    await runTrialFollowupScheduler();
    return;
  }

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
    let stage: TrialStage | null = null;
    let templateId = '';

    // D+1 · trial:D1 — lembrete configurar WA (24h após cadastro)
    // Reusa template trialMidway (mais próximo do tom "vamos lá, configura aí").
    if (type === 'trial:D1') {
      stage = 'D1';
      templateId = 'trialMidway';
      if (await alreadySent(orgId, stage)) {
        logger.info({ msg: 'trial_followup_already_sent_skip', orgId, stage });
        return;
      }
      const readiness = await getAIReadinessScore(orgId);
      const savings = await getEstimatedSavings(orgId);

      const rendered = renderTrialMidwayEmail({
        firstName,
        daysRemaining: 13,
        aiReadinessScore: readiness,
        savings,
        ctaUrl: `${appUrl}/onboarding?utm_source=email&utm_campaign=trial_d1`,
      });
      subject = rendered.subject;
      html = rendered.html;
      text = rendered.text;
    }

    // D+3 · trial:D3 — oferta de call 1:1 (ainda dá tempo de salvar)
    else if (type === 'trial:D3') {
      stage = 'D3';
      templateId = 'trialSavingsFollowup';
      if (await alreadySent(orgId, stage)) {
        logger.info({ msg: 'trial_followup_already_sent_skip', orgId, stage });
        return;
      }
      const readiness = await getAIReadinessScore(orgId);

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

    // D+7 · trial:D7 — último toque (ativação ou churn iminente)
    else if (type === 'trial:D7') {
      stage = 'D7';
      templateId = 'trialLastDay';
      if (await alreadySent(orgId, stage)) {
        logger.info({ msg: 'trial_followup_already_sent_skip', orgId, stage });
        return;
      }
      const readiness = await getAIReadinessScore(orgId);
      const savings = await getEstimatedSavings(orgId);

      const rendered = renderTrialLastDayEmail({
        firstName,
        aiReadinessScore: readiness,
        savings,
        ctaUrl: `${appUrl}/billing?coupon=LASTDAY14&utm_source=email&utm_campaign=trial_d7`,
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
      const sendResult = await sendEmail({
        to: user.email,
        subject,
        html,
        text,
        tags: ['trial_followup', `type:${type}`, `org:${orgId}`],
      });

      // FASE 1.B: persiste audit em onboarding_journey_state pra idempotência
      // cruzada (BullMQ + DB) e visibilidade no admin dashboard.
      if (stage) {
        await markSent(orgId, stage, templateId, (sendResult as any)?.id, {
          orgName: org.name,
          plan: org.plan,
          daysSinceCreated: daysSinceCreated(org.createdAt),
          userEmail: user.email,
          firstName,
        });
      }

      logger.info({
        msg: 'trial_followup_sent',
        orgId,
        userId,
        type,
        stage,
        to: user.email,
        subject,
        emailProviderId: (sendResult as any)?.id,
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
          // FASE 3 P0b fix (2026-05-14): aceita SUPERADMIN também — TesteZappIQ
          // tem só usuário SUPERADMIN e estava sendo silenciosamente ignorado.
          where: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
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

    let enqueuedD1 = 0, enqueuedD3 = 0, enqueuedD7 = 0, skippedNoAdmin = 0;

    for (const org of orgs) {
      // FASE 1.B: D+1/D+3/D+7 baseado em daysSinceCreated (mais previsível
      // que daysRemaining, que depende de trialEndsAt nem sempre setado).
      const dsc = daysSinceCreated(org.createdAt);
      const adminUser = (org as any).users[0];

      if (!adminUser) {
        logger.warn({
          msg: 'trial_followup_no_admin_user',
          orgId: org.id,
          orgName: org.name,
        });
        skippedNoAdmin++;
        continue;
      }

      // FASE 3 P0b fix (2026-05-14): mudou de `dsc === N` (strict equality)
      // para `dsc >= N` com gate em alreadySent. A lógica antiga perdia
      // orgs pra sempre quando o scheduler pulava um dia (deploy, restart,
      // crash, qualquer coisa). Agora qualquer execução PEGA orgs em catch-up.
      // alreadySent garante que não envia 2x — feito via UNIQUE constraint.
      if (dsc >= 1 && !(await alreadySent(org.id, 'D1'))) {
        await enqueueTrialFollowup(org.id, adminUser.id, 'trial:D1');
        enqueuedD1++;
      }
      if (dsc >= 3 && !(await alreadySent(org.id, 'D3'))) {
        await enqueueTrialFollowup(org.id, adminUser.id, 'trial:D3');
        enqueuedD3++;
      }
      if (dsc >= 7 && !(await alreadySent(org.id, 'D7'))) {
        await enqueueTrialFollowup(org.id, adminUser.id, 'trial:D7');
        enqueuedD7++;
      }
    }

    logger.info({
      msg: 'trial_followup_scheduler_complete',
      orgsProcessed: orgs.length,
      enqueuedD1,
      enqueuedD3,
      enqueuedD7,
      skippedNoAdmin,
    });
  } catch (err) {
    logger.error({
      msg: 'trial_followup_scheduler_error',
      error: String(err),
    });
    throw err;
  }
}
