import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { prisma } from '@zappiq/database';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const router = Router();

// =====================================================
// Pricing V3.2 · Stripe Price IDs reais (live account)
// -----------------------------------------------------
// Fonte canônica: packages/shared/src/planConfig.ts
// Mapeamento por tier × billing period.
// Anual: 20% off (== monthly × 9.6 ao invés de 12).
// =====================================================
const PLANS = {
  STARTER: {
    name: 'Starter',
    monthly: { amount: 197,  priceId: 'price_1TOguVKlp5SWv74X5SZzRqTH' },
    annual:  { amount: 1896, priceId: 'price_1TOguiKlp5SWv74XztvAJQJE' },
  },
  GROWTH: {
    name: 'Growth',
    monthly: { amount: 497,  priceId: 'price_1TOguYKlp5SWv74XjsbTItxg' },
    annual:  { amount: 4776, priceId: 'price_1TOgulKlp5SWv74XpEx93YYD' },
  },
  SCALE: {
    name: 'Scale',
    monthly: { amount: 997,  priceId: 'price_1TOgubKlp5SWv74XnpBRyLnz' },
    annual:  { amount: 9576, priceId: 'price_1TOguoKlp5SWv74XS6CGFe70' },
  },
  BUSINESS: {
    name: 'Business',
    monthly: { amount: 1997,  priceId: 'price_1TOgufKlp5SWv74XKOPNvSre' },
    annual:  { amount: 19176, priceId: 'price_1TOgusKlp5SWv74XUky82PNK' },
  },
} as const;

type PlanKey = keyof typeof PLANS;
type BillingPeriod = 'monthly' | 'annual';

const isPlanKey = (s: unknown): s is PlanKey =>
  typeof s === 'string' && s in PLANS;
const isBillingPeriod = (s: unknown): s is BillingPeriod =>
  s === 'monthly' || s === 'annual';

// GET /api/billing/plans
router.get('/plans', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.entries(PLANS).map(([key, p]) => ({
      id: key,
      name: p.name,
      monthly: { amount: p.monthly.amount, priceId: p.monthly.priceId },
      annual:  { amount: p.annual.amount,  priceId: p.annual.priceId  },
      annualDiscountPercent: 20,
    })),
  });
});

// POST /api/billing/checkout
// Body: { plan: 'STARTER'|'GROWTH'|'SCALE'|'BUSINESS', billing?: 'monthly'|'annual' }
router.post('/checkout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plan, billing = 'monthly' } = req.body ?? {};

    if (!isPlanKey(plan)) {
      res.status(400).json({ error: 'Invalid plan', allowed: Object.keys(PLANS) });
      return;
    }
    if (!isBillingPeriod(billing)) {
      res.status(400).json({ error: 'Invalid billing period', allowed: ['monthly', 'annual'] });
      return;
    }

    const planConfig = PLANS[plan];
    const priceId = planConfig[billing].priceId;

    const org = await prisma.organization.findUnique({ where: { id: req.organizationId! } });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      // V3.2: expõe campo "inserir cupom" (ex.: ANTONELLA100 pra pilotos)
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: {
          organizationId: req.organizationId!,
          plan,
          billing,
          pricing_version: 'v32',
        },
      },
      metadata: {
        organizationId: req.organizationId!,
        plan,
        billing,
        pricing_version: 'v32',
      },
      success_url: `${env.NEXT_PUBLIC_APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/billing/cancel`,
    });

    logger.info('checkout.session.created', {
      organizationId: req.organizationId,
      plan,
      billing,
      priceId,
      sessionId: session.id,
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
