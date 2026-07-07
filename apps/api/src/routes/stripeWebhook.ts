/* ══════════════════════════════════════════════════════════════════════
 * stripeWebhook — reescrita da Fase 3 (Área Clientes, §4/§9).
 * --------------------------------------------------------------------
 * Conserta os bugs conhecidos (§0.4 da spec):
 *   1) NÃO sobrescreve mais o settings inteiro — faz MERGE não-destrutivo
 *      (preserva niche/agentName/billing) via mergeSettings().
 *   2) customer.subscription.created/updated → GRAVA subscriptionStatus,
 *      billingCycle, stripeCustomerId, stripeSubscriptionId nas COLUNAS novas
 *      (Fase 1). Antes só logava.
 *   3) customer.subscription.deleted → marca churnedAt + lifecycle CHURNED.
 *      Antes só dava downgrade pra STARTER, sem registrar o churn.
 *   4) invoice.paid / invoice.payment_succeeded → persiste em stripe_invoices
 *      (+ paidAt na org). Idempotente por stripeInvoiceId (unique).
 *   5) invoice.payment_failed → marca subscriptionStatus='past_due' (dunning).
 *
 * Idempotência global por event id: cada evt_... é gravado em
 * stripe_webhook_events; reentrega do mesmo evento é ignorada (Stripe reentrega).
 *
 * Regra de ouro: pagante = stripeSubscriptionId REAL, nunca trialConverted.
 * Toda escrita de lifecycle passa por deriveLifecycleStage() (função pura).
 * ══════════════════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '@zappiq/database';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { sendEmail } from '../services/email/emailProvider.js';
import { renderTrialConvertedEmail } from '../services/email/templates/trialConverted.js';
import { deriveLifecycleStage } from '../services/accountLifecycle.js';
import { invalidateOrgAccessCache } from '../middleware/requireActivePlan.js'; // busta o cache do gate ao mudar billing
import {
  resolvePlanFromPriceId,
  planToOrgEnum,
  mrrCentsForPlan,
  normalizeSubscriptionStatus,
  mergeSettings,
  stripeEpochToDate,
} from './stripeWebhook.util.js';

if (!env.STRIPE_SECRET_KEY) {
  logger.warn('[Stripe] STRIPE_SECRET_KEY not set — webhook route will reject all events.');
}
const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY)
  : (null as unknown as Stripe);
const router = Router();

// Labels humanos por tier — evita espalhar string literal pelo código.
const TIER_LABELS: Record<string, { label: string; monthlyBrl: number }> = {
  IZA_LITE: { label: 'Iza Lite', monthlyBrl: 247 },
  STARTER: { label: 'Starter', monthlyBrl: 247 },
  GROWTH: { label: 'Growth', monthlyBrl: 497 },
  SCALE: { label: 'Scale', monthlyBrl: 1497 },
  BUSINESS: { label: 'Business', monthlyBrl: 1997 },
  ENTERPRISE: { label: 'Enterprise', monthlyBrl: 9900 },
};

// ─── helpers de I/O (a lógica pura vive em stripeWebhook.util.ts) ────────────

/**
 * Idempotência por event id. Tenta inserir a linha em stripe_webhook_events;
 * se já existe (P2002), o evento já foi processado → retorna false (pular).
 */
async function markEventProcessed(eventId: string, type: string): Promise<boolean> {
  try {
    await prisma.stripeWebhookEvent.create({ data: { id: eventId, type } });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      logger.info(`[Stripe] Evento ${eventId} (${type}) já processado — ignorando (idempotência).`);
      return false;
    }
    throw err;
  }
}

/**
 * Descobre a org do evento: metadata.organizationId (preferido) ou, na falta,
 * pela coluna stripeCustomerId da org (para eventos que só trazem o customer,
 * como invoices). Retorna null se não achar.
 */
async function resolveOrganizationId(
  metadataOrgId: string | null | undefined,
  stripeCustomerId: string | null | undefined,
): Promise<string | null> {
  if (metadataOrgId) return metadataOrgId;
  if (stripeCustomerId) {
    const org = await prisma.organization.findFirst({
      where: { stripeCustomerId },
      select: { id: true },
    });
    if (org) return org.id;
  }
  return null;
}

/** Recomputa e materializa o lifecycleStage da conta CRM ligada à org. */
async function recomputeLifecycle(organizationId: string, source: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      churnedAt: true,
      subscriptionStatus: true,
      stripeSubscriptionId: true,
      trialEndsAt: true,
      isTrialActive: true,
      trialConverted: true,
      paidAt: true,
    },
  });
  if (!org) return;

  const stage = deriveLifecycleStage({
    churnedAt: org.churnedAt,
    subscriptionStatus: org.subscriptionStatus,
    stripeSubscriptionId: org.stripeSubscriptionId,
    trialEndsAt: org.trialEndsAt,
    isTrialActive: org.isTrialActive,
    trialConverted: org.trialConverted,
    paidAt: org.paidAt,
  });

  // materializa cache na org (consultado por filtros) — sempre.
  await prisma.organization.update({
    where: { id: organizationId },
    data: { accountLifecycleStage: stage },
  });

  // Trial Enforcement: billing mudou → invalida o cache de 60s do gate, pra
  // um cliente que acabou de pagar não ficar preso no 402 até o TTL expirar.
  await invalidateOrgAccessCache(organizationId);

  // espelha em crm_accounts (fonte da UI), registrando mudança na timeline.
  const account = await prisma.crmAccount.findUnique({
    where: { organizationId },
    select: { id: true, lifecycleStage: true },
  });
  if (account && account.lifecycleStage !== stage) {
    await prisma.crmAccount.update({
      where: { id: account.id },
      data: { lifecycleStage: stage },
    });
    await prisma.crmAccountActivity.create({
      data: {
        crmAccountId: account.id,
        type: 'lifecycle_change',
        payload: { from: account.lifecycleStage, to: stage, source },
      },
    });
  }
}

/**
 * Extrai o priceId da assinatura (primeiro item). Stripe 17.x:
 * subscription.items.data[0].price.id.
 */
function priceIdFromSubscription(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  return (item?.price?.id as string | undefined) ?? null;
}

/**
 * Aplica os efeitos de uma assinatura (created/updated) na org: colunas de
 * billing + plano + settings (merge). Reusado pelos dois eventos.
 */
async function applySubscriptionState(
  organizationId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const status = normalizeSubscriptionStatus(sub.status);
  const priceId = priceIdFromSubscription(sub);
  const resolved = resolvePlanFromPriceId(priceId);
  const planEnum = resolved ? planToOrgEnum(resolved.plan) : null;
  const mrrCents = resolved ? mrrCentsForPlan(resolved.plan, resolved.billingCycle) : 0;
  const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;

  const before = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      settings: true,
      paidAt: true,
      isTrialActive: true,
      trialConverted: true,
      name: true,
      pendingPlanChange: true,
    },
  });
  if (!before) {
    logger.warn(`[Stripe] Org ${organizationId} não encontrada para subscription ${sub.id}`);
    return;
  }

  const wasTrialConversion =
    Boolean(before.isTrialActive) && !before.trialConverted && status === 'active';

  const mergedSettings = mergeSettings(before.settings, {
    stripeCustomerId: stripeCustomerId ?? undefined,
    stripeSubscriptionId: sub.id,
  });

  const data: Record<string, unknown> = {
    subscriptionStatus: status,
    billingCycle: resolved?.billingCycle ?? undefined,
    stripeCustomerId: stripeCustomerId ?? undefined,
    stripeSubscriptionId: sub.id,
    settings: mergedSettings,
  };
  if (planEnum) data.plan = planEnum;
  // primeiro pagamento confirmado: status ativo e ainda sem paidAt.
  if (status === 'active' && !before.paidAt) {
    data.paidAt = new Date();
    data.isTrialActive = false;
    data.trialConverted = true;
  }
  // Downgrade agendado que ENTROU em vigor: quando o plano/ciclo resultante bate
  // com o pendingPlanChange, o Subscription Schedule já aplicou a fase 2 — limpa
  // o marcador pra faixa "troca agendada" sumir do dash.
  const pending = (before.pendingPlanChange as { plan?: string; cycle?: string } | null) || null;
  if (
    pending &&
    resolved &&
    pending.plan === resolved.plan &&
    pending.cycle === resolved.billingCycle
  ) {
    data.pendingPlanChange = null;
  }

  await prisma.organization.update({ where: { id: organizationId }, data: data as any });

  // espelha mrr na crm_account (fonte da UI financeira).
  await prisma.crmAccount.updateMany({
    where: { organizationId },
    data: { mrrCents },
  });

  await recomputeLifecycle(organizationId, `subscription:${sub.status}`);

  logger.info(
    `[Stripe] Subscription ${sub.id} (${status}) aplicada em org ${organizationId} — plano ${resolved?.plan ?? '?'} mrr ${mrrCents}`,
  );

  // e-mail de conversão de trial — idempotente (só na 1ª vez que vira active).
  if (wasTrialConversion) {
    try {
      const owner = await prisma.user.findFirst({
        where: { organizationId, role: 'ADMIN' },
        select: { email: true, name: true },
      });
      const tierKey = (resolved?.plan ?? '').toUpperCase();
      const tierMeta = TIER_LABELS[tierKey] ?? { label: resolved?.plan ?? 'plano', monthlyBrl: mrrCents / 100 };
      if (owner?.email) {
        const rendered = renderTrialConvertedEmail({
          firstName: (owner.name || 'amigo(a)').split(' ')[0] ?? 'amigo(a)',
          orgName: before.name ?? 'sua empresa',
          tierLabel: tierMeta.label,
          monthlyBrl: tierMeta.monthlyBrl,
        });
        await sendEmail({
          to: owner.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          tags: ['trial_converted', `org:${organizationId}`, `tier:${tierKey}`],
        });
        logger.info(`[Stripe] trial:converted e-mail disparado para ${owner.email}`);
      }
    } catch (emailErr) {
      logger.error('[Stripe] trial:converted e-mail falhou:', emailErr);
    }
  }
}

// POST /api/stripe-webhook — must receive raw body
router.post('/', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    logger.error('[Stripe] Webhook called but STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not configured.');
    res.status(503).send('Stripe not configured');
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    logger.warn('[Stripe] Webhook signature failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    // Idempotência global por event id — pula se já processado.
    const isNew = await markEventProcessed(event.id, event.type);
    if (!isNew) {
      res.json({ received: true, idempotent: true });
      return;
    }

    switch (event.type) {
      // ── Assinatura criada/atualizada → grava billing + plano + status ──────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = await resolveOrganizationId(
          subscription.metadata?.organizationId,
          typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
        );
        if (orgId) {
          await applySubscriptionState(orgId, subscription);
        } else {
          logger.warn(`[Stripe] ${event.type}: org não resolvida (sub ${subscription.id})`);
        }
        break;
      }

      // ── Assinatura cancelada → churnedAt + lifecycle CHURNED ───────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = await resolveOrganizationId(
          subscription.metadata?.organizationId,
          typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
        );
        if (orgId) {
          const before = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { settings: true, churnedAt: true },
          });
          await prisma.organization.update({
            where: { id: orgId },
            data: {
              churnedAt: before?.churnedAt ?? new Date(),
              subscriptionStatus: 'canceled',
              isTrialActive: false,
              // preserva settings (merge não-destrutivo) — não apaga niche etc.
              settings: mergeSettings(before?.settings, {}),
            } as any,
          });
          // zera MRR da conta (não gera mais receita).
          await prisma.crmAccount.updateMany({ where: { organizationId: orgId }, data: { mrrCents: 0 } });
          await recomputeLifecycle(orgId, 'subscription:deleted');
          logger.info(`[Stripe] Subscription deletada: org ${orgId} → CHURNED (churnedAt marcado).`);
        } else {
          logger.warn(`[Stripe] subscription.deleted: org não resolvida (sub ${subscription.id})`);
        }
        break;
      }

      // ── Fatura paga → persiste em stripe_invoices + paidAt ─────────────────
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
        const metaOrgId =
          (invoice as any).subscription_details?.metadata?.organizationId ??
          invoice.metadata?.organizationId ??
          null;
        const orgId = await resolveOrganizationId(metaOrgId, stripeCustomerId);
        if (orgId) {
          const line = invoice.lines?.data?.[0];
          const periodStart = stripeEpochToDate(line?.period?.start);
          const periodEnd = stripeEpochToDate(line?.period?.end);
          const paidAt = new Date();
          // idempotente por stripeInvoiceId (unique) — upsert evita duplicata.
          await prisma.stripeInvoice.upsert({
            where: { stripeInvoiceId: invoice.id! },
            create: {
              organizationId: orgId,
              stripeInvoiceId: invoice.id!,
              amountBrlCents: invoice.amount_paid ?? invoice.amount_due ?? 0,
              status: invoice.status ?? 'paid',
              periodStart,
              periodEnd,
              paidAt,
            },
            update: {
              amountBrlCents: invoice.amount_paid ?? invoice.amount_due ?? 0,
              status: invoice.status ?? 'paid',
              paidAt,
            },
          });
          // marca paidAt na org se ainda não havia 1º pagamento.
          const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { paidAt: true },
          });
          if (org && !org.paidAt) {
            await prisma.organization.update({
              where: { id: orgId },
              data: { paidAt: new Date() },
            });
            await recomputeLifecycle(orgId, 'invoice:paid');
          }
          logger.info(`[Stripe] Invoice ${invoice.id} paga para org ${orgId} (R$${(invoice.amount_paid ?? 0) / 100}).`);
        } else {
          logger.warn(`[Stripe] invoice paga: org não resolvida (customer ${stripeCustomerId})`);
        }
        break;
      }

      // ── Pagamento falhou → past_due (dunning) ──────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
        const orgId = await resolveOrganizationId(invoice.metadata?.organizationId, stripeCustomerId);
        if (orgId) {
          await prisma.organization.update({
            where: { id: orgId },
            data: { subscriptionStatus: 'past_due' },
          });
          await recomputeLifecycle(orgId, 'invoice:payment_failed');
          logger.warn(`[Stripe] Pagamento falhou para org ${orgId} → past_due (dunning).`);
        } else {
          logger.warn(`[Stripe] payment_failed: org não resolvida (customer ${stripeCustomerId})`);
        }
        break;
      }

      // ── checkout.session.completed — vínculo inicial cus/sub + settings merge ─
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.organizationId;
        if (orgId) {
          const before = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { settings: true },
          });
          const merged = mergeSettings(before?.settings, {
            stripeCustomerId: (session.customer as string) ?? undefined,
            stripeSubscriptionId: (session.subscription as string) ?? undefined,
          });
          await prisma.organization.update({
            where: { id: orgId },
            data: {
              stripeCustomerId: (session.customer as string) ?? undefined,
              stripeSubscriptionId: (session.subscription as string) ?? undefined,
              cardAddedAt: new Date(),
              settings: merged,
            } as any,
          });
          logger.info(`[Stripe] Checkout completo: org ${orgId} vinculada a cus/sub (settings preservado).`);
          // O estado de plano/status/MRR é finalizado pelo subscription.created/updated.
          await recomputeLifecycle(orgId, 'checkout:completed');
        }
        break;
      }

      default:
        logger.debug(`[Stripe] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    logger.error('[Stripe] Webhook processing error:', err);
  }

  res.json({ received: true });
});

export default router;
