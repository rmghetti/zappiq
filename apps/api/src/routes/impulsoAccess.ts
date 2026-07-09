import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { prisma } from '@zappiq/database';
import { ADDONS_V4_STRIPE } from '@zappiq/shared';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  getImpulsoEntitlement,
  startImpulsoTrial,
  IMPULSO_ADDON_KEYS,
} from '../middleware/requireImpulso.js';

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : (null as unknown as Stripe);

/*
 * Rotas de ACESSO ao Impulso — NÃO passam pelo requireImpulso (todo cliente,
 * mesmo sem o add-on, precisa consultar seu status e poder ativar o teste).
 * Montado em /api/impulso-access (prefixo distinto de /api/impulso, que é gated).
 */
const router = Router();

// GET /api/impulso-access — status do entitlement da org (para a vitrine/paywall)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ent = await getImpulsoEntitlement(req.organizationId!);
    res.json({ success: true, data: ent });
  } catch (err) {
    next(err);
  }
});

// POST /api/impulso-access/trial — ativa o teste de 7 dias do Impulso
router.post('/trial', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await startImpulsoTrial(req.organizationId!);
    if (!result.ok) {
      res.status(409).json({
        success: false,
        error: result.reason,
        message:
          result.reason === 'already_active'
            ? 'O Impulso já está ativo nesta conta.'
            : result.reason === 'trial_active'
              ? 'O teste do Impulso já está em andamento.'
              : 'Esta conta já usou o teste do Impulso.',
        data: result.entitlement,
      });
      return;
    }
    res.json({ success: true, data: result.entitlement });
  } catch (err) {
    next(err);
  }
});

// POST /api/impulso-access/checkout — cria a sessão de checkout do add-on Impulso.
// Assinatura SEPARADA do plano base (metadata.impulsoAddon marca o tier); o webhook
// detecta e liga settings.addons sem tocar na assinatura do plano base.
router.post('/checkout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tier = String(req.body?.tier || '');
    if (!(IMPULSO_ADDON_KEYS as readonly string[]).includes(tier)) {
      res.status(400).json({ error: 'invalid_tier', allowed: IMPULSO_ADDON_KEYS });
      return;
    }
    if (!stripe) {
      res.status(503).json({ error: 'stripe_not_configured' });
      return;
    }
    // Ciclo mensal (padrão) ou anual (-20%). Fallback seguro pra mensal se o
    // preço anual ainda não estiver configurado no Stripe (id placeholder).
    const cycle = req.body?.cycle === 'annual' ? 'annual' : 'monthly';
    const prices = ADDONS_V4_STRIPE[tier]?.priceIds ?? {};
    let priceId = prices[cycle];
    if (!priceId || !priceId.startsWith('price_')) priceId = prices.monthly;
    if (!priceId || !priceId.startsWith('price_')) {
      res.status(500).json({ error: 'price_not_configured', tier });
      return;
    }
    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId! },
      select: { stripeCustomerId: true },
    });
    const appUrl = env.NEXT_PUBLIC_APP_URL;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      ...(org?.stripeCustomerId ? { customer: org.stripeCustomerId } : {}),
      subscription_data: { metadata: { organizationId: req.organizationId!, impulsoAddon: tier } },
      metadata: { organizationId: req.organizationId!, impulsoAddon: tier },
      success_url: `${appUrl}/campaigns?impulso=assinado`,
      cancel_url: `${appUrl}/campaigns?impulso=cancelado`,
    });
    logger.info(`[Impulso] checkout criado org=${req.organizationId} tier=${tier} session=${session.id}`);
    res.json({ success: true, url: session.url });
  } catch (err) {
    next(err);
  }
});

export default router;
