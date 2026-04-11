import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '@zappiq/database';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const router = Router();

// POST /api/stripe-webhook — must receive raw body
router.post('/', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder'
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
          await prisma.organization.update({
            where: { id: orgId },
            data: {
              plan: plan as any,
              settings: {
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
              },
            },
          });
          logger.info(`[Stripe] Checkout complete: org ${orgId} → plan ${plan}`);
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
