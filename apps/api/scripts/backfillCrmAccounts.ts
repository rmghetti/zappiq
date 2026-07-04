/* ══════════════════════════════════════════════════════════════════════
 * backfillCrmAccounts — Área Clientes / Fase 1 (idempotente).
 * --------------------------------------------------------------------
 * Cobre "todos desde o início": conserta o elo signups↔org e semeia
 * crm_accounts para TODAS as orgs e signups existentes, com lifecycleStage
 * derivado por deriveLifecycleStage().
 *
 * Passos:
 *   (a) UPDATE signups.organization_id casando lower(email) com users (elo que
 *       hoje é NULL em 100% dos registros — raiz de "leads não aparecem").
 *   (b) upsert de crm_accounts para cada organization (lifecycle derivado).
 *   (c) upsert de crm_accounts para cada signup SEM org (lifecycleStage='NOVO').
 *
 * Idempotente: reexecutar não duplica (UPDATE por email + upsert por chave).
 * NÃO destrói dado. NÃO deve ser executado por este workflow — só deixado pronto.
 *
 * Uso (manual, quando o Rodrigo decidir):
 *   pnpm --filter @zappiq/api tsx scripts/backfillCrmAccounts.ts
 *   (dry-run) BACKFILL_DRY_RUN=1 pnpm --filter @zappiq/api tsx scripts/backfillCrmAccounts.ts
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { deriveLifecycleStage } from '../src/services/accountLifecycle.js';

const DRY = process.env.BACKFILL_DRY_RUN === '1';

interface SignupRow {
  id: string;
  email: string;
  company: string | null;
  cnpj: string | null;
  plan_chosen: string | null;
  organization_id: string | null;
}

async function main() {
  const startedAt = Date.now();
  console.log(`[backfillCrmAccounts] início${DRY ? ' (DRY RUN)' : ''}`);

  // ── (a) Ligar signups.organization_id por email (casa com users.email) ──
  // Só preenche onde está NULL; não sobrescreve elos já existentes.
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
  console.log(`[backfillCrmAccounts] signups ligados a org por email: ${linked}${DRY ? ' (seriam)' : ''}`);

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

    // busca o signupId ligado (se houver) para gravar o elo.
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
        // reexecução: atualiza o estágio derivado e reforça identidade/elo.
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
  console.log(`[backfillCrmAccounts] crm_accounts de org (upsert): ${orgAccounts}`);

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
    // evita duplicar: se já existe uma crm_account para esse signup, atualiza.
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
  console.log(`[backfillCrmAccounts] crm_accounts de signup órfão: ${signupAccounts}`);

  console.log(
    `[backfillCrmAccounts] concluído em ${Date.now() - startedAt}ms — ` +
      `linked=${linked} orgAccounts=${orgAccounts} signupAccounts=${signupAccounts}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[backfillCrmAccounts] ERRO:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
