/* ══════════════════════════════════════════════════════════════════════
 * seedPaywallGrace (CLI) — cortesia de migração do gate de paywall (one-time).
 * --------------------------------------------------------------------
 * Dá 7 dias de carência (paywallGraceUntil = now + 7d) às ~8 orgs LEGADAS que
 * já estavam TRIAL_EXPIRED no go-live do gate, para que não sejam bloqueadas de
 * imediato. É a contrapartida da política go-forward "dura no T-0": orgs novas
 * NÃO são tocadas (paywallGraceUntil fica null → bloqueio duro assim que vence).
 *
 * A verdade da regra é computeAccessState() (services/accountAccess). Aqui só
 * selecionamos as orgs cujo stage === 'TRIAL_EXPIRED', gravamos a carência e
 * mandamos UM e-mail honesto de aviso ao ADMIN.
 *
 * Critérios (todos precisam valer):
 *   - computeAccessState(org).stage === 'TRIAL_EXPIRED'
 *   - paywallGraceUntil IS NULL            (idempotente: já setado => pula)
 *   - plan !== 'ENTERPRISE'                (enterprise não passa por paywall)
 *   - NÃO é org interna/superadmin         (todos os users são SUPERADMIN)
 *
 * IDEMPOTENTE: rodar de novo não regrava carência nem reenvia e-mail (a
 * condição paywallGraceUntil IS NULL some após a 1ª aplicação).
 *
 * NÃO deve ser executado por workflow — só deixado pronto para o Rodrigo rodar.
 * APONTA PARA PROD: rode primeiro em --dry-run e confira o resumo.
 *
 * Uso (manual, a partir da raiz do worktree):
 *   (dry-run) pnpm --filter @zappiq/api exec tsx apps/api/scripts/seedPaywallGrace.ts --dry-run
 *   (aplicar) pnpm --filter @zappiq/api exec tsx apps/api/scripts/seedPaywallGrace.ts --apply
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { env } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';
import { computeAccessState } from '../src/services/accountAccess.js';
import { sendEmail } from '../src/services/email/emailProvider.js';

const GRACE_DAYS = 7;
const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000;

/** Parse mínimo de process.argv: default é --dry-run; --apply grava.
 *  --email <addr> (opcional) restringe a UMA org, a que tem esse ADMIN. */
function parseFlags(): { apply: boolean; emailFilter: string | null } {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  let emailFilter: string | null = null;
  const eqFlag = argv.find((a) => a.startsWith('--email='));
  if (eqFlag) {
    emailFilter = eqFlag.slice('--email='.length).trim().toLowerCase() || null;
  } else {
    const idx = argv.indexOf('--email');
    if (idx >= 0 && argv[idx + 1]) emailFilter = argv[idx + 1].trim().toLowerCase() || null;
  }
  return { apply, emailFilter };
}

/** Formata a data como dd/mm/yyyy (pt-BR) para a cópia do e-mail. */
function formatDateBR(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Monta o e-mail de aviso (pt-BR, sem travessão por house style /voz-humana).
 * COPY PROVISÓRIA: precisa passar pelo passe de /voz-humana antes de enviar.
 */
function buildGraceEmail(input: {
  orgName: string;
  adminName: string;
  graceEndDate: Date;
}): { subject: string; html: string; text: string } {
  const dateStr = formatDateBR(input.graceEndDate);
  const billingUrl = `${env.APP_URL}/billing`;
  const firstName = (input.adminName ?? '').trim().split(/\s+/)[0] || 'Olá';

  const subject = 'Seu teste gratuito terminou, você ainda tem acesso por alguns dias';

  const html = `<!-- COPY PROVISÓRIA: revisar voz-humana -->
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
  <p>Oi, ${firstName}.</p>
  <p>Passando para avisar que o teste gratuito de 14 dias da ${input.orgName} chegou ao fim.</p>
  <p>Para você não parar do nada, liberamos acesso para a sua conta até <strong>${dateStr}</strong>. Depois dessa data, o acesso fica reservado a quem já escolheu um plano.</p>
  <p>Se a ZappIQ está ajudando o seu time, escolha o plano ideal e siga sem interrupção:</p>
  <p><a href="${billingUrl}" style="display: inline-block; background: #6d28d9; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: bold;">Escolher meu plano</a></p>
  <p style="font-size: 13px; color: #555;">Se preferir, o link direto é ${billingUrl}</p>
  <p>Qualquer dúvida, é só responder este e-mail. A gente ajuda.</p>
  <p>Um abraço,<br />Time ZappIQ</p>
</div>`;

  const text = [
    `Oi, ${firstName}.`,
    '',
    `Passando para avisar que o teste gratuito de 14 dias da ${input.orgName} chegou ao fim.`,
    '',
    `Para você não parar do nada, liberamos acesso para a sua conta até ${dateStr}. Depois dessa data, o acesso fica reservado a quem já escolheu um plano.`,
    '',
    'Se a ZappIQ está ajudando o seu time, escolha o plano ideal e siga sem interrupção:',
    billingUrl,
    '',
    'Qualquer dúvida, é só responder este e-mail. A gente ajuda.',
    '',
    'Um abraço,',
    'Time ZappIQ',
  ].join('\n');

  return { subject, html, text };
}

interface MatchedOrg {
  id: string;
  name: string;
  plan: string;
  graceUntil: Date;
  adminEmail: string | null;
  adminName: string | null;
}

async function main(): Promise<void> {
  const { apply, emailFilter } = parseFlags();
  const now = new Date();
  const graceUntil = new Date(now.getTime() + GRACE_MS);

  logger.info({
    msg: 'seed_paywall_grace_start',
    mode: apply ? 'apply' : 'dry-run',
    emailFilter: emailFilter ?? '(todas)',
    graceDays: GRACE_DAYS,
    graceUntil: graceUntil.toISOString(),
  });

  // Carrega todas as orgs com os sinais que computeAccessState precisa + users
  // (para achar o ADMIN do e-mail e detectar org interna só-SUPERADMIN).
  const orgs = await prisma.organization.findMany({
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
      createdAt: true,
      users: {
        select: { email: true, name: true, role: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  const matched: MatchedOrg[] = [];
  let skippedNotExpired = 0;
  let skippedHasGrace = 0;
  let skippedEnterprise = 0;
  let skippedInternal = 0;
  let skippedEmailFilter = 0;

  for (const org of orgs) {
    // 1) Idempotência: já tem carência => nunca reprocessa.
    if (org.paywallGraceUntil != null) {
      skippedHasGrace++;
      continue;
    }

    // 2) Enterprise não passa por paywall.
    if (org.plan === 'ENTERPRISE') {
      skippedEnterprise++;
      continue;
    }

    // 3) Org interna/superadmin: pula se TODOS os users forem SUPERADMIN.
    //    (org sem nenhum user também é tratada como interna/degenerada => pula.)
    const isInternal =
      org.users.length === 0 || org.users.every((u) => u.role === 'SUPERADMIN');
    if (isInternal) {
      skippedInternal++;
      continue;
    }

    // 4) A regra canônica: só toca quem está TRIAL_EXPIRED agora.
    const { stage } = computeAccessState({
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
    if (stage !== 'TRIAL_EXPIRED') {
      skippedNotExpired++;
      continue;
    }

    // 1º ADMIN da org (para o e-mail de catch-up). Sem ADMIN: seta coluna, sem e-mail.
    const admin = org.users.find((u) => u.role === 'ADMIN') ?? null;

    // Filtro opcional --email: só processa a org cujo ADMIN casa com o e-mail.
    if (emailFilter && (admin?.email ?? '').toLowerCase() !== emailFilter) {
      skippedEmailFilter++;
      continue;
    }

    matched.push({
      id: org.id,
      name: org.name,
      plan: org.plan,
      graceUntil,
      adminEmail: admin?.email ?? null,
      adminName: admin?.name ?? null,
    });
  }

  let updated = 0;
  let emailsSent = 0;

  if (apply) {
    for (const org of matched) {
      try {
        await prisma.organization.update({
          where: { id: org.id },
          data: { paywallGraceUntil: org.graceUntil },
        });
        updated++;
      } catch (err: any) {
        logger.error({
          msg: 'seed_paywall_grace_update_failed',
          orgId: org.id,
          orgName: org.name,
          error: String(err?.message ?? err),
        });
        // Não tenta enviar e-mail se a gravação falhou.
        continue;
      }

      // E-mail de catch-up: UM por org, só se houver ADMIN.
      if (!org.adminEmail) {
        logger.warn({
          msg: 'seed_paywall_grace_no_admin',
          orgId: org.id,
          orgName: org.name,
        });
        continue;
      }

      try {
        const { subject, html, text } = buildGraceEmail({
          orgName: org.name,
          adminName: org.adminName ?? '',
          graceEndDate: org.graceUntil,
        });
        await sendEmail({
          to: org.adminEmail,
          subject,
          html,
          text,
          tags: ['trial_grace_intro', `org:${org.id}`],
        });
        emailsSent++;
      } catch (err: any) {
        logger.error({
          msg: 'seed_paywall_grace_email_failed',
          orgId: org.id,
          orgName: org.name,
          to: org.adminEmail,
          error: String(err?.message ?? err),
        });
      }
    }
  }

  // ── Resumo ──────────────────────────────────────────────────────────
  logger.info({
    msg: 'seed_paywall_grace_summary',
    mode: apply ? 'apply' : 'dry-run',
    totalOrgsScanned: orgs.length,
    matched: matched.length,
    updated,
    emailsSent,
    skipped: {
      notExpired: skippedNotExpired,
      alreadyHadGrace: skippedHasGrace,
      enterprise: skippedEnterprise,
      internalSuperadmin: skippedInternal,
      emailFilter: skippedEmailFilter,
    },
  });

  logger.info({
    msg: 'seed_paywall_grace_matched_list',
    orgs: matched.map((o) => ({
      orgName: o.name,
      id: o.id,
      graceUntil: o.graceUntil.toISOString(),
      hasAdmin: o.adminEmail != null,
    })),
  });

  if (!apply) {
    logger.warn(
      'DRY-RUN (nada gravado). Rode com --apply para aplicar.',
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({
      msg: 'seed_paywall_grace_fatal',
      error: String(err?.message ?? err),
    });
    await prisma.$disconnect();
    process.exit(1);
  });
