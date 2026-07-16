import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { prisma } from '@zappiq/database';
import {
  listMiraTiers,
  listMiraPacks,
  MIRA_INCLUDED_TIER_BY_PLAN,
  MIRA_TIER_KEYS,
  MIRA_PACK_KEYS,
  MIRA_PACKS,
  MIRA_TRIAL_ALVOS,
  ADDONS_V4_STRIPE,
} from '@zappiq/shared';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { getMiraEntitlement } from '../middleware/requireMira.js';

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : (null as unknown as Stripe);

/*
 * Rotas de ACESSO ao Mira Prospects — NÃO passam pelo requireMira (todo
 * cliente, mesmo sem o add-on, consulta seu status para ver a vitrine
 * de ativação e assinar). Montado em /api/mira-access (prefixo distinto de
 * /api/mira, que é gated). Espelha o padrão do Impulso.
 */
const router = Router();

// GET /api/mira-access — entitlement + cota + catálogo de faixas/packs
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const ent = await getMiraEntitlement(orgId);
    const perfil = await (prisma as any).miraPerfil.findUnique({
      where: { organizationId: orgId },
      select: { prontidao: true, updatedAt: true },
    });
    res.json({
      success: true,
      data: {
        ...ent,
        perfil: perfil ? { prontidao: perfil.prontidao, updatedAt: perfil.updatedAt } : null,
        catalog: {
          tiers: listMiraTiers(),
          packs: listMiraPacks(),
          includedByPlan: MIRA_INCLUDED_TIER_BY_PLAN,
          trialAlvos: MIRA_TRIAL_ALVOS,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/mira-access/trial/activate — teste grátis (SEM Stripe, SEM cartão).
// Uma vez por org: libera uma cota VITALÍCIA de MIRA_TRIAL_ALVOS Alvos (não
// mensal, não reseta). Mesmo padrão de flag do settings.miraAlpha — grava
// settings.miraTrialActivatedAt e a entitlement resolve source:'trial'.
// Guarda-corpo: só quem nunca ativou e ainda não tem faixa/inclusão.
router.post('/trial/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const current = await getMiraEntitlement(orgId);
    if (current.access.entitled) {
      res.status(400).json({
        error: 'already_entitled',
        message: 'Esta conta já tem acesso ao Mira Prospects (faixa ativa, inclusa no plano, ou teste em andamento).',
      });
      return;
    }
    if (!current.access.trialAvailable) {
      res.status(400).json({ error: 'trial_already_used', message: 'O teste grátis desta conta já foi usado.' });
      return;
    }
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
    const settings = (org?.settings as any) ?? {};
    await prisma.organization.update({
      where: { id: orgId },
      data: { settings: { ...settings, miraTrialActivatedAt: new Date().toISOString() } },
    });
    logger.info(`[Mira] teste grátis ativado org=${orgId} (${MIRA_TRIAL_ALVOS} Alvos, sem cartão)`);
    const ent = await getMiraEntitlement(orgId);
    res.json({ success: true, data: ent });
  } catch (err) {
    next(err);
  }
});

// POST /api/mira-access/checkout — assina uma FAIXA do Mira (recorrente).
// Assinatura SEPARADA do plano base (metadata.miraAddon marca a faixa); o
// webhook detecta em customer.subscription.created e liga settings.addons
// sem tocar na assinatura do plano base.
router.post('/checkout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tier = String(req.body?.tier || '');
    if (!(MIRA_TIER_KEYS as readonly string[]).includes(tier)) {
      res.status(400).json({ error: 'invalid_tier', allowed: MIRA_TIER_KEYS });
      return;
    }
    if (!stripe) {
      res.status(503).json({ error: 'stripe_not_configured' });
      return;
    }
    const cycle = req.body?.cycle === 'annual' ? 'annual' : 'monthly';
    const prices = (ADDONS_V4_STRIPE as Record<string, { priceIds?: Record<string, string> }>)[tier]?.priceIds ?? {};
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
      subscription_data: { metadata: { organizationId: req.organizationId!, miraAddon: tier } },
      metadata: { organizationId: req.organizationId!, miraAddon: tier },
      success_url: `${appUrl}/mira?ativado=1`,
      cancel_url: `${appUrl}/mira?cancelado=1`,
    });
    logger.info(`[Mira] checkout faixa criado org=${req.organizationId} tier=${tier} cycle=${cycle} session=${session.id}`);
    res.json({ success: true, url: session.url });
  } catch (err) {
    next(err);
  }
});

// POST /api/mira-access/pack/checkout — compra um PACK avulso (one-shot).
// Pagamento único (mode:payment); o webhook credita packExtra no mês corrente
// em checkout.session.completed. Usado quando a cota do mês esgota.
router.post('/pack/checkout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pack = String(req.body?.pack || '');
    if (!(MIRA_PACK_KEYS as readonly string[]).includes(pack)) {
      res.status(400).json({ error: 'invalid_pack', allowed: MIRA_PACK_KEYS });
      return;
    }
    if (!stripe) {
      res.status(503).json({ error: 'stripe_not_configured' });
      return;
    }
    // Só quem tem faixa ativa compra pack (o pack recarrega uma cota existente).
    //
    // BUG DE COBRANÇA corrigido em 16/07/2026: este gate checava `entitled`, e
    // quem está no TESTE GRÁTIS também é `entitled` (source:'trial') — então
    // passava. Só que o trial é um teto vitalício lido do ledger `monthKey:
    // 'TRIAL'` com `packExtra: 0` FIXO (ver requireMira.ts), enquanto
    // `creditMiraPack` credita sempre em `currentMonthKey()`. Resultado: quem
    // estava em trial pagava até R$ 1.436 e o pack caía num balde que a cota
    // dele nunca lê — cobrança sem entrega. Era alcançável: ao esgotar os 10
    // Alvos, /mira/alvos mostrava "Compre um pacote avulso para continuar".
    // Ninguém chegou a ser cobrado (0 packs comprados em produção).
    //
    // O certo é exigir FAIXA (tier), que é o que o comentário acima sempre
    // disse: no trial `tier` é null de propósito. Pack só faz sentido em cima
    // de uma cota mensal existente.
    const ent = await getMiraEntitlement(req.organizationId!);
    if (!ent.access.tier) {
      res.status(403).json({
        error: 'no_active_tier',
        message: ent.access.source === 'trial'
          ? 'O pacote avulso recarrega a cota de uma faixa. Assine uma faixa do Mira para continuar.'
          : 'Assine uma faixa do Mira antes de comprar packs.',
      });
      return;
    }
    const cfg = MIRA_PACKS[pack as keyof typeof MIRA_PACKS];
    const priceKey = `pack_${cfg.alvos}`;
    const priceId = (ADDONS_V4_STRIPE as Record<string, { priceIds?: Record<string, string> }>).MIRA_PACKS?.priceIds?.[priceKey];
    if (!priceId || !priceId.startsWith('price_')) {
      res.status(500).json({ error: 'pack_price_not_configured', pack, priceKey });
      return;
    }
    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId! },
      select: { stripeCustomerId: true },
    });
    const appUrl = env.NEXT_PUBLIC_APP_URL;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      // Decisão do Rodrigo (16/07/2026): TODO produto pago tem campo de cupom,
      // igual aos planos ZappIQ — se o cliente tiver um, usa. Era o único
      // checkout da plataforma sem o campo, num produto de até R$ 1.436.
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      ...(org?.stripeCustomerId ? { customer: org.stripeCustomerId } : {}),
      metadata: {
        organizationId: req.organizationId!,
        miraPack: pack,
        miraPackAlvos: String(cfg.alvos),
        miraPackPrice: String(cfg.price),
      },
      success_url: `${appUrl}/mira/alvos?pack=ok`,
      cancel_url: `${appUrl}/mira/alvos?pack=cancelado`,
    });
    logger.info(`[Mira] checkout pack criado org=${req.organizationId} pack=${pack} session=${session.id}`);
    res.json({ success: true, url: session.url });
  } catch (err) {
    next(err);
  }
});

export default router;
