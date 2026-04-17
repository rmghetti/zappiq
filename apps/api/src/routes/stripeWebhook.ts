import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '@zappiq/database';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { sendEmail } from '../services/email/emailProvider.js';
import { renderTrialConvertedEmail } from '../services/email/templates/trialConverted.js';

if (!env.STRIPE_SECRET_KEY) {
  logger.warn('[Stripe] STRIPE_SECRET_KEY not set — webhook route will reject all events.');
}
const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY)
  : (null as unknown as Stripe);
const router = Router();

// Labels humanos por tier — evita espalhar string literal pelo código
const TIER_LABELS: Record<string, { label: string; monthlyBrl: number }> = {
  STARTER: { label: 'Starter', monthlyBrl: 247 },
  GROWTH: { label: 'Growth', monthlyBrl: 797 },
  SCALE: { label: 'Scale', monthlyBrl: 1697 },
  BUSINESS: { label: 'Business', monthlyBrl: 3997 },
  ENTERPRISE: { label: 'Enterprise', monthlyBrl: 9900 },
};

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
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err: any) {
    logger.warn('[Stripe] Webhook signature failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.organizationId;
        const plan = session.metadata?.plan;

        if (orgId && plan) {
          // Verifica se era trial → conversão (para disparar e-mail uma única vez)
          const before = (await prisma.organization.findUnique({
            where: { id: orgId },
          })) as any;
          const wasTrialConversion = before?.isTrialActive && !before?.trialConverted;

          await prisma.organization.update({
            where: { id: orgId },
            data: {
              plan: plan as any,
              isTrialActive: false,
              trialConverted: true,
              settings: {
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
              },
            } as any,
          });
          logger.info(`[Stripe] Checkout complete: org ${orgId} → plan ${plan}`);

          // Disparo do trial:converted — idempotente via wasTrialConversion check.
          if (wasTrialConversion) {
            try {
              const owner = await prisma.user.findFirst({
                where: { organizationId: orgId, role: 'ADMIN' },
                select: { email: true, name: true },
              });
              const tierMeta = TIER_LABELS[plan] ?? { label: plan, monthlyBrl: 0 };
              if (owner?.email) {
                const rendered = renderTrialConvertedEmail({
                  firstName: (owner.name || 'amigo(a)').split(' ')[0] ?? 'amigo(a)',
                  orgName: before?.name ?? 'sua empresa',
                  tierLabel: tierMeta.label,
                  monthlyBrl: tierMeta.monthlyBrl,
                });
                await sendEmail({
                  to: owner.email,
                  subject: rendered.subject,
                  html: rendered.html,
                  text: rendered.text,
                  tags: ['trial_converted', `org:${orgId}`, `tier:${plan}`],
                });
                logger.info(`[Stripe] trial:converted e-mail disparado para ${owner.email}`);
              }
            } catch (emailErr) {
              // Não falha o webhook por erro de e-mail — é side effect.
              logger.error('[Stripe] trial:converted e-mail falhou:', emailErr);
            }
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.organizationId;
        if (orgId) {
          const status = subscription.status;
          if (status === 'active') {
            logger.info(`[Stripe] Subscription active for org ${orgId}`);
          } else if (status === 'past_due' || status === 'unpaid') {
            logger.warn(`[Stripe] Subscription ${status} for org ${orgId}`);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.organizationId;
        if (orgId) {
          await prisma.organization.update({
            where: { id: orgId },
            data: { plan: 'STARTER' },
          });
          logger.info(`[Stripe] Subscription cancelled: org ${orgId} → downgraded to STARTER`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        logger.warn(`[Stripe] Payment failed for customer ${invoice.customer}`);
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
