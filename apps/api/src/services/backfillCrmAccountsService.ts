/* ══════════════════════════════════════════════════════════════════════
 * backfillCrmAccountsService — backfill idempotente reusável (Fase 1/2).
 * --------------------------------------------------------------------
 * A lógica que estava em scripts/backfillCrmAccounts.ts, extraída para uma
 * função pura de I/O (sem process.exit) para poder ser disparada tanto pelo
 * CLI quanto pelo endpoint POST /api/admin/clientes/backfill (Superadmin).
 *
 * Cobre "todos desde o início": conserta o elo signups↔org por email e semeia
 * crm_accounts para TODAS as orgs e signups, com lifecycleStage derivado.
 * Idempotente: reexecutar não duplica. NÃO destrói dado.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { deriveLifecycleStage } from './accountLifecycle.js';
import { logger } from '../utils/logger.js';

interface SignupRow {
  id: string;
  email: string;
  company: string | null;
  cnpj: string | null;
  plan_chosen: string | null;
  organization_id: string | null;
}

export interface BackfillResult {
  linked: number;
  orgAccounts: number;
  signupAccounts: number;
  durationMs: number;
  dryRun: boolean;
}

export async function runBackfillCrmAccounts(
  opts: { dryRun?: boolean } = {},
): Promise<BackfillResult> {
  const DRY = Boolean(opts.dryRun);
  const startedAt = Date.now();

  // ── (a) Ligar signups.organization_id por email (casa com users.email) ──
  let linked = 0;
  if (!DRY) {
    const res = await prisma.$executeRawUnsafe(`
      UPDATE signups s
         SET organization_id = u."organizationId",
             updated_at = now()
        FROM users u
       WHERE lower(s.email) = lower(u.email)
         AND u."organizationId" IS NOT NULL
         AND s.organization_id IS NULL
    `);
    linked = Number(res);
  } else {
    const rows = (await prisma.$queryRawUnsafe(`
      SELECT count(*)::int AS n
        FROM signups s
        JOIN users u ON lower(s.email) = lower(u.email)
       WHERE u."organizationId" IS NOT NULL AND s.organization_id IS NULL
    `)) as Array<{ n: number }>;
    linked = rows?.[0]?.n ?? 0;
  }

  // ── (b) Seed de crm_accounts para TODAS as orgs ──
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      settings: true,
      plan: true,
      churnedAt: true,
      subscriptionStatus: true,
      stripeSubscriptionId: true,
      trialEndsAt: true,
      isTrialActive: true,
      trialConverted: true,
      paidAt: true,
      users: { select: { email: true }, orderBy: { createdAt: 'asc' }, take: 1 },
    },
  });

  let orgAccounts = 0;
  for (const org of orgs) {
    const stage = deriveLifecycleStage({
      churnedAt: org.churnedAt,
      subscriptionStatus: org.subscriptionStatus,
      stripeSubscriptionId: org.stripeSubscriptionId,
      trialEndsAt: org.trialEndsAt,
      isTrialActive: org.isTrialActive,
      trialConverted: org.trialConverted,
      paidAt: org.paidAt,
    });
    const settings = (org.settings ?? {}) as Record<string, any>;
    const email = org.users?.[0]?.email ?? settings.ownerEmail ?? `org-${org.id}@unknown.local`;
    const company = settings.businessName ?? settings.company ?? null;

    const sig = (await prisma.$queryRawUnsafe(
      `SELECT id, cnpj FROM signups WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
      org.id,
    )) as Array<{ id: string; cnpj: string | null }>;

    if (DRY) {
      orgAccounts++;
      continue;
    }
    await prisma.crmAccount.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        signupId: sig?.[0]?.id ?? null,
        email,
        company,
        cnpj: sig?.[0]?.cnpj ?? null,
        plan: org.plan,
        lifecycleStage: stage,
        trialEndsAt: org.trialEndsAt,
      },
      update: {
        lifecycleStage: stage,
        signupId: sig?.[0]?.id ?? undefined,
        email,
        company: company ?? undefined,
        cnpj: sig?.[0]?.cnpj ?? undefined,
        plan: org.plan,
        trialEndsAt: org.trialEndsAt ?? undefined,
      },
    });
    orgAccounts++;
  }

  // ── (c) Seed de crm_accounts para signups SEM org (leads novos = NOVO) ──
  const orphanSignups = (await prisma.$queryRawUnsafe(`
    SELECT id, email, company, cnpj, plan_chosen, organization_id
      FROM signups
     WHERE organization_id IS NULL
  `)) as SignupRow[];

  let signupAccounts = 0;
  for (const s of orphanSignups) {
    if (DRY) {
      signupAccounts++;
      continue;
    }
    const existing = await prisma.crmAccount.findFirst({ where: { signupId: s.id } });
    if (existing) {
      await prisma.crmAccount.update({
        where: { id: existing.id },
        data: {
          email: s.email,
          company: s.company ?? undefined,
          cnpj: s.cnpj ?? undefined,
          plan: s.plan_chosen ?? undefined,
        },
      });
    } else {
      await prisma.crmAccount.create({
        data: {
          organizationId: null,
          signupId: s.id,
          email: s.email,
          company: s.company,
          cnpj: s.cnpj,
          plan: s.plan_chosen,
          lifecycleStage: 'NOVO',
        },
      });
    }
    signupAccounts++;
  }

  const durationMs = Date.now() - startedAt;
  logger.info({
    msg: 'backfill_crm_accounts_done',
    dryRun: DRY,
    linked,
    orgAccounts,
    signupAccounts,
    durationMs,
  });
  return { linked, orgAccounts, signupAccounts, durationMs, dryRun: DRY };
}
