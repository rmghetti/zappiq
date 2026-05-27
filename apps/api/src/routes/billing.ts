import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { prisma } from '@zappiq/database';
import { STRIPE_V4_PRICES, STRIPE_V4_MODE } from '@zappiq/shared';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const router = Router();

// =====================================================
// Pricing V4 (2026-05-27)
// -----------------------------------------------------
// Fonte de verdade: packages/shared/src/planStripeIds.ts (gerado pelo
// .command PRICING_V4_LITE_TRIAL no PR #223). Antes ficava hardcoded
// aqui, agora vem do shared pra evitar drift.
//
// Iza Lite tem trial_period_days: 14 — sem isso o cliente seria
// cobrado R$ 249,00 no dia 1.
// =====================================================

// Mapa tier -> dias de trial. Centralizado pra futuro (Growth/Scale com trial
// promocional, por exemplo). Hoje so Iza Lite usa.
const TRIAL_DAYS: Record<string, number> = {
  IZA_LITE: STRIPE_V4_PRICES.IZA_LITE.trialDays, // 14
  GROWTH:   STRIPE_V4_PRICES.GROWTH.trialDays,   // 0
  SCALE:    STRIPE_V4_PRICES.SCALE.trialDays,    // 0
};

// Grandfather V3.2: clientes em STARTER ou BUSINESS antigo ainda podem
// fazer portal/upgrade — mas signup NOVO so via tiers V4.
const LEGACY_V32_PRICE_MAP: Record<string, { monthly: string; annual: string }> = {
  STARTER: {
    monthly: 'price_1TOguVKlp5SWv74X5SZzRqTH',
    annual:  'price_1TOguiKlp5SWv74XztvAJQJE',
  },
  BUSINESS: {
    monthly: 'price_1TOgufKlp5SWv74XKOPNvSre',
    annual:  'price_1TOgusKlp5SWv74XUky82PNK',
  },
};

type PlanV4 = keyof typeof STRIPE_V4_PRICES;        // 'IZA_LITE' | 'GROWTH' | 'SCALE'
type BillingCycle = 'monthly' | 'annual';

const V4_PLANS = Object.keys(STRIPE_V4_PRICES) as PlanV4[];
const ALL_PLANS = [...V4_PLANS, ...Object.keys(LEGACY_V32_PRICE_MAP)] as string[];

const isPlanV4 = (s: unknown): s is PlanV4 =>
  typeof s === 'string' && (V4_PLANS as readonly string[]).includes(s);

const isLegacyPlan = (s: unknown): s is keyof typeof LEGACY_V32_PRICE_MAP =>
  typeof s === 'string' && s in LEGACY_V32_PRICE_MAP;

const isBillingCycle = (s: unknown): s is BillingCycle =>
  s === 'monthly' || s === 'annual';

// GET /api/billing/plans  (publica os tiers V4 + nao expoe legacy)
router.get('/plans', (_req: Request, res: Response) => {
  res.json({
    success: true,
    version: 'v4',
    stripeMode: STRIPE_V4_MODE,
    data: V4_PLANS.map((id) => {
      const p = STRIPE_V4_PRICES[id];
      return {
        id,
        productId: p.productId,
        monthly: { priceId: p.monthly },
        annual:  { priceId: p.annual  },
        trialDays: p.trialDays,
        annualDiscountPercent: 20,
      };
    }),
  });
});

// POST /api/billing/checkout
// Body: { plan, cycle?, billing? }
//   plan  = 'IZA_LITE' | 'GROWTH' | 'SCALE' (novos)
//           ou 'STARTER' | 'BUSINESS' (legacy grandfather)
//   cycle = 'monthly' | 'annual'  (novo nome — billing/page.tsx V4 manda esse)
//   billing = 'monthly' | 'annual' (compat com frontend V3.2 antigo)
router.post('/checkout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body ?? {};
    const plan: string = body.plan;
    const cycle: BillingCycle = (body.cycle ?? body.billing ?? 'monthly') as BillingCycle;

    if (!isBillingCycle(cycle)) {
      res.status(400).json({ error: 'Invalid cycle', allowed: ['monthly', 'annual'] });
      return;
    }

    let priceId: string;
    let trialDays = 0;
    let pricingVersion: 'v4' | 'v32_legacy';

    if (isPlanV4(plan)) {
      const cfg = STRIPE_V4_PRICES[plan];
      priceId = cycle === 'monthly' ? cfg.monthly : cfg.annual;
      trialDays = TRIAL_DAYS[plan] ?? 0;
      pricingVersion = 'v4';
    } else if (isLegacyPlan(plan)) {
      // Permite upgrade de grandfathered (Starter/Business antigos) — mas log
      // pra acompanhar. Trial 0 (esses planos nao tinham trial).
      priceId = LEGACY_V32_PRICE_MAP[plan][cycle];
      trialDays = 0;
      pricingVersion = 'v32_legacy';
      logger.warn('checkout.legacy_v32_plan_used', {
        organizationId: req.organizationId,
        plan,
        cycle,
        note: 'Cliente assinou tier V3.2 legacy — esperado so pra grandfather',
      });
    } else {
      res.status(400).json({
        error: 'Invalid plan',
        allowed: ALL_PLANS,
        note: 'V4 tiers (Iza Lite/Growth/Scale) sao os recomendados. STARTER e BUSINESS sao legacy.',
      });
      return;
    }

    const org = await prisma.organization.findUnique({ where: { id: req.organizationId! } });

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        organizationId: req.organizationId!,
        plan,
        cycle,
        pricing_version: pricingVersion,
      },
    };

    // CRITICAL: trial_period_days so se > 0. Iza Lite usa 14.
    if (trialDays > 0) {
      subscriptionData.trial_period_days = trialDays;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: subscriptionData,
      metadata: {
        organizationId: req.organizationId!,
        plan,
        cycle,
        pricing_version: pricingVersion,
      },
      success_url: `${env.NEXT_PUBLIC_APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${env.NEXT_PUBLIC_APP_URL}/billing/cancel`,
    });

    logger.info('checkout.session.created', {
      organizationId: req.organizationId,
      plan,
      cycle,
      priceId,
      trialDays,
      pricingVersion,
      sessionId: session.id,
    });

    res.json({ success: true, url: session.url, trialDays, pricingVersion });
  } catch (err) {
    next(err);
  }
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
  } catch (err) {
    next(err);
  }
});

export default router;
