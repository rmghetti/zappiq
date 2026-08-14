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
import { computeSavings } from './email/templates/trialSavingsFollowup.js';
import { renderTrialMidwayEmail } from './email/templates/trialMidway.js';
import { renderTrialReminderEmail } from './email/templates/trialReminder.js';
import { renderTrialConvertedEmail } from './email/templates/trialConverted.js';
import { computeAIReadiness } from './aiReadinessService.js';
import { pickTrialReminderStage } from './trialReminderStage.util.js';
import { queueConnection as connection } from '../config/queueRedis.js';

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
// Trial Enforcement (2026-07): cadência regressiva T-3/T-2/T-1/T-0 (dias ATÉ o
// fim do trial), substituindo D3/D7. D1 (ativação, 24h após cadastro) mantido.
export type TrialStage = 'D1' | 'T3' | 'T2' | 'T1' | 'T0';

export interface TrialFollowupJobData {
  orgId: string;
  userId: string;
  type: 'trial:D1' | 'trial:T3' | 'trial:T2' | 'trial:T1' | 'trial:T0' | 'trial:converted';
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

// W3.3 fix (2026-07): estes e-mails vão pra leads REAIS. NADA de número
// inventado. Antes daqui saíam `50 + random` (readiness) e `R$10k + random`
// (economia). Agora: readiness vem do computeAIReadiness real da org; a
// economia é DERIVADA da mesma fonte do savingsEmail (computeSavings sobre a
// baseline pública Blip vs. preço ZappIQ Starter). Se o dado real não existir,
// retornamos `undefined` e o template OMITE a frase em vez de mentir.

// Baseline pública (mediana Blip) — fonte canônica da estimativa de economia.
const DEFAULT_COMPETITOR_SETUP_BRL = 8000;
const DEFAULT_COMPETITOR_MONTHLY_BRL = 1500;
const ZAPPIQ_STARTER_MONTHLY_BRL = 197;

/**
 * AI Readiness Score REAL da org (0-100). Retorna `undefined` se não for
 * possível computar — o template omite o bloco em vez de inventar um número.
 */
async function getAIReadinessScore(orgId: string): Promise<number | undefined> {
  try {
    const result = await computeAIReadiness(orgId);
    return typeof result.score === 'number' && Number.isFinite(result.score)
      ? result.score
      : undefined;
  } catch (err) {
    logger.warn({ msg: 'trial_followup_readiness_failed', orgId, err: String(err) });
    return undefined;
  }
}

/**
 * Economia estimada no 1º ano (R$), DERIVADA de dados reais — mesma fórmula e
 * mesma fonte de baseline usada no savingsEmail (computeSavings). Não é
 * aleatória: é a diferença entre o custo de referência do concorrente e o
 * custo ZappIQ Starter no primeiro ano. Retorna `undefined` se der ≤ 0.
 */
async function getEstimatedSavings(orgId: string): Promise<number | undefined> {
  try {
    const { savings } = computeSavings(
      DEFAULT_COMPETITOR_SETUP_BRL,
      DEFAULT_COMPETITOR_MONTHLY_BRL,
      ZAPPIQ_STARTER_MONTHLY_BRL,
    );
    return savings > 0 ? savings : undefined;
  } catch (err) {
    logger.warn({ msg: 'trial_followup_savings_failed', orgId, err: String(err) });
    return undefined;
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

    // T-3 / T-2 / T-1 / T-0 · contagem regressiva do fim do trial.
    // Um único template parametrizado por daysLeft. Empurra o plano anual (20% off).
    else if (
      type === 'trial:T3' ||
      type === 'trial:T2' ||
      type === 'trial:T1' ||
      type === 'trial:T0'
    ) {
      const daysLeft = (type === 'trial:T3' ? 3 : type === 'trial:T2' ? 2 : type === 'trial:T1' ? 1 : 0) as 0 | 1 | 2 | 3;
      stage = type.slice('trial:'.length) as TrialStage; // 'T3' | 'T2' | 'T1' | 'T0'
      templateId = `trialReminder_${stage}`;
      if (await alreadySent(orgId, stage)) {
        logger.info({ msg: 'trial_followup_already_sent_skip', orgId, stage });
        return;
      }
      const rendered = renderTrialReminderEmail({
        firstName,
        daysLeft,
        ctaUrl: `${appUrl}/billing?reason=trial_ending&utm_source=email&utm_campaign=trial_${stage.toLowerCase()}`,
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

    // Elegíveis: trial ATIVO, ou trial recém-vencido (≤3 dias) ainda SEM pagamento.
    // A janela pós-fim garante que o T-0 dispare mesmo depois do trialExpirationCron
    // (03:40 UTC) zerar isTrialActive. NÃO pega as orgs legadas vencidas há muito.
    const nowMs = Date.now();
    const RECENT_END_MS = 3 * 24 * 60 * 60 * 1000;
    const orgs = allOrgs.filter((org: any) => {
      const active = org.isTrialActive === true;
      const endsAt = org.trialEndsAt ? new Date(org.trialEndsAt).getTime() : null;
      const recentlyEnded = endsAt !== null && endsAt <= nowMs && nowMs - endsAt <= RECENT_END_MS;
      const unpaid = !org.paidAt && !org.churnedAt && !org.stripeSubscriptionId;
      return active || (recentlyEnded && unpaid);
    });

    logger.info({ msg: 'trial_followup_scheduler_run', orgsToProcess: orgs.length });

    let enqueuedD1 = 0, enqueuedT3 = 0, enqueuedT2 = 0, enqueuedT1 = 0, enqueuedT0 = 0, skippedNoAdmin = 0;

    for (const org of orgs) {
      const adminUser = (org as any).users[0];
      if (!adminUser) {
        logger.warn({ msg: 'trial_followup_no_admin_user', orgId: org.id, orgName: org.name });
        skippedNoAdmin++;
        continue;
      }

      // D+1 · ativação (24h após cadastro) — só durante trial ativo. dsc >= N com
      // gate em alreadySent: qualquer execução pega orgs em catch-up sem duplicar.
      const dsc = daysSinceCreated(org.createdAt);
      if (org.isTrialActive === true && dsc >= 1 && !(await alreadySent(org.id, 'D1'))) {
        await enqueueTrialFollowup(org.id, adminUser.id, 'trial:D1');
        enqueuedD1++;
      }

      // T-3/T-2/T-1/T-0 · só para orgs SEM pagamento (quem já assinou não recebe).
      const unpaid = !org.paidAt && !org.churnedAt && !org.stripeSubscriptionId;
      if (unpaid) {
        const dtl = daysUntilTrialEnds(org.trialEndsAt ? new Date(org.trialEndsAt) : null);
        const sent = {
          T0: await alreadySent(org.id, 'T0'),
          T1: await alreadySent(org.id, 'T1'),
          T2: await alreadySent(org.id, 'T2'),
          T3: await alreadySent(org.id, 'T3'),
        };
        const pick = pickTrialReminderStage(dtl, sent);
        if (pick) {
          await enqueueTrialFollowup(org.id, adminUser.id, `trial:${pick}`);
          if (pick === 'T0') enqueuedT0++;
          else if (pick === 'T1') enqueuedT1++;
          else if (pick === 'T2') enqueuedT2++;
          else enqueuedT3++;
        }
      }
    }

    logger.info({
      msg: 'trial_followup_scheduler_complete',
      orgsProcessed: orgs.length,
      enqueuedD1, enqueuedT3, enqueuedT2, enqueuedT1, enqueuedT0, skippedNoAdmin,
    });
  } catch (err) {
    logger.error({
      msg: 'trial_followup_scheduler_error',
      error: String(err),
    });
    throw err;
  }
}
