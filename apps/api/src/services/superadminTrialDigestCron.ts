/**
 * Superadmin Trial Digest · BullMQ (diário 13:00 UTC = 10h BRT)
 *
 * Varre as orgs, seleciona (regra pura em superadminTrialDigest.util) as que
 * estão a ≤3 dias do fim do trial ou com a carência acabando, e manda ao CEO:
 *   - E-mail para founders@ (env.EMAIL_REPLY_TO) com a lista + plano recomendado
 *   - Alerta no Slack (canal dedicado SLACK_WEBHOOK_TRIAL_ALERTS, fallback quota)
 * para ação proativa de conversão. Só dispara quando há orgs (não polui a caixa).
 *
 * Kill-switch: SUPERADMIN_TRIAL_DIGEST_CRON=0 desliga sem redeploy.
 */
import { Queue, Worker } from 'bullmq';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { sendEmail } from './email/emailProvider.js';
import {
  renderSuperadminTrialDigestEmail,
  type SuperadminDigestEntry,
} from './email/templates/superadminTrialDigest.js';
import { digestEntryFor } from './superadminTrialDigest.util.js';
import { buildRecommendation } from './planRecommendation.js';
import {
  sendSlackAlert,
  buildHeaderBlock,
  buildSectionBlock,
  buildContextBlock,
} from './slackNotifier.js';

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

export const superadminTrialDigestQueue = new Queue('superadmin-trial-digest', {
  connection,
  defaultJobOptions: { attempts: 2, removeOnComplete: { count: 20 }, removeOnFail: { count: 20 } },
});

let digestWorker: Worker | null = null;

function formatDateBR(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

/** Coleta os dados do digest (exportado para teste/uso manual via /send-now). */
export async function collectSuperadminDigest(now = new Date()): Promise<SuperadminDigestEntry[]> {
  const orgs = (await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      plan: true,
      trialEndsAt: true,
      isTrialActive: true,
      trialConverted: true,
      paidAt: true,
      churnedAt: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
      paywallGraceUntil: true,
      users: {
        where: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
        select: { name: true, email: true, role: true },
        orderBy: { createdAt: 'asc' },
        take: 2,
      },
    },
  })) as any[];

  const entries: SuperadminDigestEntry[] = [];
  for (const org of orgs) {
    const hit = digestEntryFor({
      now,
      churnedAt: org.churnedAt,
      subscriptionStatus: org.subscriptionStatus,
      stripeSubscriptionId: org.stripeSubscriptionId,
      trialEndsAt: org.trialEndsAt,
      isTrialActive: org.isTrialActive,
      trialConverted: org.trialConverted,
      paidAt: org.paidAt,
      paywallGraceUntil: org.paywallGraceUntil,
    });
    if (!hit) continue;

    const admin = org.users.find((u: any) => u.role === 'ADMIN') ?? org.users[0] ?? null;

    let recommendedPlanLabel: string | null = null;
    let recommendedAnnualMonthlyBrl: number | null = null;
    try {
      const reco = await buildRecommendation(org.id);
      recommendedPlanLabel = reco.planLabel;
      recommendedAnnualMonthlyBrl = reco.annualMonthlyBrl;
    } catch {
      /* recomendação é best-effort — nunca derruba o digest */
    }

    entries.push({
      orgName: org.name,
      orgId: org.id,
      reason: hit.reason,
      daysLeft: hit.daysLeft,
      adminName: admin?.name ?? null,
      adminEmail: admin?.email ?? null,
      adminPhone: null,
      recommendedPlanLabel,
      recommendedAnnualMonthlyBrl,
      usageSummary: null,
    });
  }

  // Mais urgente primeiro.
  entries.sort((a, b) => a.daysLeft - b.daysLeft);
  return entries;
}

async function sendDigestSlack(entries: SuperadminDigestEntry[], dateLabel: string): Promise<void> {
  const webhook =
    process.env.SLACK_WEBHOOK_TRIAL_ALERTS || process.env.SLACK_WEBHOOK_QUOTA_ALERTS || undefined;
  const lines = entries.map((e) => {
    const dias = e.reason === 'grace_ending' ? `carência ${e.daysLeft}d` : `${e.daysLeft}d p/ vencer`;
    const contato = e.adminEmail ? ` · ${e.adminEmail}` : '';
    const reco = e.recommendedPlanLabel ? ` · sugerir *${e.recommendedPlanLabel}*` : '';
    return `• *${e.orgName}* (${dias})${contato}${reco}`;
  });
  await sendSlackAlert({
    webhook,
    text: `Digest de trials ${dateLabel}: ${entries.length} org(s) precisam de ação`,
    username: 'ZappIQ Trials',
    iconEmoji: ':hourglass_flowing_sand:',
    blocks: [
      buildHeaderBlock(`⏳ Trials precisando de ação · ${dateLabel}`),
      buildSectionBlock(lines.join('\n')),
      buildContextBlock('Aja proativamente antes de vencer. Detalhes no e-mail (founders@) e em /admin/clientes.'),
    ],
  });
}

async function runDigest(): Promise<void> {
  if (process.env.SUPERADMIN_TRIAL_DIGEST_CRON === '0') {
    logger.info({ msg: 'superadmin_trial_digest_disabled_killswitch' });
    return;
  }
  const now = new Date();
  const dateLabel = formatDateBR(now);
  const entries = await collectSuperadminDigest(now);

  logger.info({ msg: 'superadmin_trial_digest_run', count: entries.length });

  if (entries.length === 0) return; // nada a reportar hoje — não polui a caixa do CEO

  const to = env.EMAIL_REPLY_TO || 'founders@zappiq.com.br';
  const dashboardUrl = `${env.APP_URL}/admin/clientes`;
  const email = renderSuperadminTrialDigestEmail({ dateLabel, entries, dashboardUrl });

  await sendEmail({
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    tags: ['superadmin_trial_digest', `count:${entries.length}`],
  });
  await sendDigestSlack(entries, dateLabel);

  logger.info({ msg: 'superadmin_trial_digest_sent', to, count: entries.length });
}

export async function initSuperadminTrialDigestJob(): Promise<void> {
  digestWorker = new Worker(
    'superadmin-trial-digest',
    async () => {
      await runDigest();
    },
    { connection, concurrency: 1 },
  );
  digestWorker.on('failed', (job, err) => {
    logger.error({ msg: 'superadmin_trial_digest_failed', jobId: job?.id, error: String(err) });
  });

  await superadminTrialDigestQueue.add(
    'superadmin-trial-digest',
    {},
    { repeat: { pattern: '0 13 * * *' }, jobId: 'superadmin-trial-digest-daily' },
  );

  logger.info({ msg: 'superadmin_trial_digest_initialized', scheduler: '13:00 UTC daily' });
}

export async function closeSuperadminTrialDigestJob(): Promise<void> {
  await digestWorker?.close();
  digestWorker = null;
  await superadminTrialDigestQueue.close();
  logger.info({ msg: 'superadmin_trial_digest_closed' });
}
