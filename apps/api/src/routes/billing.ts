import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { prisma } from '@zappiq/database';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const router = Router();

const PLANS = {
  STARTER: { amount: 197, name: 'Starter' },
  GROWTH: { amount: 497, name: 'Growth' },
  SCALE: { amount: 1197, name: 'Scale' },
};

// GET /api/billing/plans
router.get('/plans', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.entries(PLANS).map(([key, p]) => ({ id: key, ...p })),
  });
});

// POST /api/billing/checkout
router.post('/checkout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan as keyof typeof PLANS]) {
      res.status(400).json({ error: 'Invalid plan' });
      return;
    }

    const org = await prisma.organization.findUnique({ where: { id: req.organizationId! } });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price_data: {
        currency: 'brl',
        product_data: { name: `ZappIQ ${PLANS[plan as keyof typeof PLANS].name}` },
        unit_amount: PLANS[plan as keyof typeof PLANS].amount * 100,
        recurring: { interval: 'month' },
      }, quantity: 1 }],
      metadata: { organizationId: req.organizationId!, plan },
      success_url: `${env.NEXT_PUBLIC_APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/billing/cancel`,
    });

    res.json({ success: true, url: session.url });
  } catch (err) { next(err); }
});

// GET /api/billing/portal
router.get('/portal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.organizationId! } });
    const settings = (org?.settings as any) || {};

    if (!settings.stripeCustomerId) {
      res.status(400).json({ error: 'No active subscription found' });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: settings.stripeCustomerId,
      return_url: `${env.NEXT_PUBLIC_APP_URL}/billing`,
    });

    res.json({ success: true, url: session.url });
  } catch (err) { next(err); }
});

export default router;
