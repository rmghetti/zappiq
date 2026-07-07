import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { prisma } from '@zappiq/database';
import { STRIPE_V4_PRICES, STRIPE_V4_MODE } from '@zappiq/shared';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { getUsage } from '../middleware/planLimits.js';
import { computeBillingUsage } from './billingUsage.util.js';
import { buildSubscriptionState } from './billingSubscription.util.js';
import { buildRecommendation } from '../services/planRecommendation.js';
import { listPurchasableAddons, resolveAddonLineItems } from './billingAddons.util.js';
import { deriveLifecycleStage } from '../services/accountLifecycle.js';
import { computeConfirmUpdate, isCheckoutSettled } from './billingCheckoutConfirm.util.js';
import { effectiveTrialDays } from './billingCheckout.util.js';
import { classifyPlanChange, type PlanTier, type BillingCycle as PlanCycle } from '../services/planChange.util.js';
import {
  isPlanTier,
  priceIdForSelection,
  resolveCurrentSelection,
  currentPeriodEndMs,
} from './billingChange.util.js';

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

    // Trial é UM por org: quem já testou (ativo ou vencido) ou já pagou
    // assina direto, sem ganhar novo período grátis no Iza Lite.
    trialDays = effectiveTrialDays(trialDays, org);

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

    // Trial Enforcement — "adicionar ao pacote": o cliente pode incluir addons
    // recorrentes junto do plano. Resolvemos os price IDs no SERVIDOR (o front
    // manda só as keys); keys inválidas/não-recorrentes são ignoradas.
    const addonLineItems = resolveAddonLineItems(body.addons);
    if (addonLineItems.length > 0) {
      subscriptionData.metadata!.addons = addonLineItems.length.toString();
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }, ...addonLineItems],
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

// POST /api/billing/checkout/confirm
// Confirmação SÍNCRONA e idempotente do retorno do Stripe Checkout. A página
// /billing/success chama isto com o session_id do success_url pra materializar
// a assinatura na org NA HORA — sem depender do timing do webhook. Assim o
// cliente já cai no painel reconhecido como ATIVO (e some o 404 do success_url
// que apontava pra uma rota inexistente). Usa os MESMOS building-blocks do
// webhook (stripeWebhook.util + deriveLifecycleStage), então os dois caminhos
// convergem pro mesmo estado. Fonte da verdade continua sendo o webhook.
router.post('/checkout/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authedOrgId = req.organizationId;
    const sessionId =
      (typeof req.body?.session_id === 'string' && req.body.session_id) ||
      (typeof req.query.session_id === 'string' && req.query.session_id) ||
      '';
    if (!sessionId) {
      res.status(400).json({ error: 'session_id obrigatório' });
      return;
    }
    if (!env.STRIPE_SECRET_KEY) {
      res.status(503).json({ error: 'Stripe não configurado' });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    const sessionOrgId = (session.metadata?.organizationId as string | undefined) || null;
    // Segurança: a sessão precisa ser da org autenticada (não confirma checkout
    // de outra org via session_id alheio).
    if (sessionOrgId && authedOrgId && sessionOrgId !== authedOrgId) {
      res.status(403).json({ error: 'Sessão de checkout de outra organização' });
      return;
    }
    const orgId = sessionOrgId || authedOrgId;
    if (!orgId) {
      res.status(400).json({ error: 'organização não resolvida' });
      return;
    }

    const sub =
      session.subscription && typeof session.subscription === 'object'
        ? (session.subscription as Stripe.Subscription)
        : null;

    if (sub) {
      const before = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { settings: true, paidAt: true, isTrialActive: true, trialConverted: true },
      });
      if (before) {
        const { data } = computeConfirmUpdate(sub, before);
        await prisma.organization.update({ where: { id: orgId }, data: data as any });

        // materializa o lifecycle (mesma função pura do webhook) pra org já
        // aparecer como ATIVA nos gates e na UI.
        const fresh = await prisma.organization.findUnique({
          where: { id: orgId },
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
        if (fresh) {
          const stage = deriveLifecycleStage(fresh);
          await prisma.organization.update({
            where: { id: orgId },
            data: { accountLifecycleStage: stage } as any,
          });
          await prisma.crmAccount
            .updateMany({ where: { organizationId: orgId }, data: { lifecycleStage: stage } })
            .catch(() => {
              /* espelho CRM best-effort; o webhook garante a timeline completa */
            });
        }
      }
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        plan: true,
        subscriptionStatus: true,
        stripeSubscriptionId: true,
        accountLifecycleStage: true,
        trialEndsAt: true,
        isTrialActive: true,
        trialConverted: true,
        churnedAt: true,
        paidAt: true,
      },
    });

    const stage = org
      ? deriveLifecycleStage({
          churnedAt: org.churnedAt,
          subscriptionStatus: org.subscriptionStatus,
          stripeSubscriptionId: org.stripeSubscriptionId,
          trialEndsAt: org.trialEndsAt,
          isTrialActive: org.isTrialActive,
          trialConverted: org.trialConverted,
          paidAt: org.paidAt,
        })
      : 'NOVO';

    res.json({
      success: true,
      active: stage === 'ACTIVE',
      settled: isCheckoutSettled(session),
      lifecycleStage: stage,
      plan: org?.plan ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Troca de plano (upgrade/downgrade, mensal/anual) com proration.
// Só para org com assinatura ATIVA real; trial/sem-sub segue no /checkout.
// Regra pura em planChange.util (classifyPlanChange). Aqui: mecânica Stripe.
// ═══════════════════════════════════════════════════════════════════════

const PLAN_LABELS: Record<string, string> = {
  IZA_LITE: 'Iza Lite',
  GROWTH: 'Growth',
  SCALE: 'Scale',
  ENTERPRISE: 'Enterprise',
};

type LoadedSub = {
  orgId: string;
  sub: Stripe.Subscription;
  itemId: string;
  current: { plan: PlanTier; cycle: PlanCycle };
};

/**
 * Carrega a assinatura ATIVA da org + a seleção atual (plano/ciclo). Responde
 * direto (409/503/404) e retorna null quando não dá pra prosseguir — trial e
 * orgs sem assinatura são mandadas pro checkout.
 */
async function loadActiveSubscription(
  req: Request,
  res: Response,
): Promise<LoadedSub | null> {
  const orgId = req.organizationId;
  if (!orgId) {
    res.status(401).json({ error: 'organization context missing' });
    return null;
  }
  if (!env.STRIPE_SECRET_KEY) {
    res.status(503).json({ error: 'Stripe não configurado' });
    return null;
  }
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, billingCycle: true, subscriptionStatus: true, stripeSubscriptionId: true },
  });
  if (!org?.stripeSubscriptionId) {
    // Sem assinatura real → o front deve abrir o checkout, não trocar plano.
    res.status(409).json({ error: 'no_active_subscription', action: 'checkout' });
    return null;
  }

  const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
  const status = (sub.status || '').toLowerCase();
  if (status !== 'active' && status !== 'trialing' && status !== 'past_due') {
    res.status(409).json({ error: 'no_active_subscription', action: 'checkout' });
    return null;
  }

  const item = sub.items?.data?.[0];
  if (!item) {
    res.status(422).json({ error: 'subscription_without_item' });
    return null;
  }

  const current = resolveCurrentSelection({
    subscriptionPriceId: item.price?.id,
    orgPlanEnum: org.plan,
    orgBillingCycle: org.billingCycle,
  });

  return { orgId, sub, itemId: item.id, current };
}

/** Valida e normaliza {plan, cycle} do body. Responde 400 e retorna null se inválido. */
function parseTarget(
  req: Request,
  res: Response,
): { plan: PlanTier; cycle: PlanCycle } | null {
  const plan = req.body?.plan;
  const cycle = req.body?.cycle;
  if (!isPlanTier(plan) || !isBillingCycle(cycle)) {
    res.status(400).json({ error: 'invalid_target', allowedPlans: Object.keys(PLAN_LABELS) });
    return null;
  }
  return { plan, cycle };
}

// POST /api/billing/change/preview — mostra a conta ANTES de confirmar.
router.post('/change/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const loaded = await loadActiveSubscription(req, res);
    if (!loaded) return;
    const target = parseTarget(req, res);
    if (!target) return;

    const cls = classifyPlanChange(loaded.current, target);
    const periodEndMs = currentPeriodEndMs(loaded.sub as any);
    const base = {
      kind: cls.kind,
      effectiveTiming: cls.effectiveTiming,
      currentPlanLabel: PLAN_LABELS[loaded.current.plan],
      targetPlanLabel: PLAN_LABELS[target.plan],
    };

    if (cls.kind === 'noop' || cls.kind === 'contact_sales') {
      res.json({ success: true, data: { ...base, chargeNowBrlCents: 0, effectiveDate: null, newRenewalDate: null } });
      return;
    }

    if (cls.kind === 'upgrade') {
      const newPrice = priceIdForSelection(target.plan, target.cycle);
      if (!newPrice) {
        res.status(422).json({ error: 'target_has_no_price' });
        return;
      }
      // Prévia da proration: quanto o Stripe cobraria AGORA pela troca.
      const preview = await stripe.invoices.createPreview({
        customer: loaded.sub.customer as string,
        subscription: loaded.sub.id,
        subscription_details: {
          items: [{ id: loaded.itemId, price: newPrice }],
          proration_behavior: 'always_invoice',
        },
      });
      const chargeNowBrlCents = Math.max(0, preview.amount_due ?? 0);
      // Fim do próximo período = última linha do preview (fallback: período atual).
      const lastLine = preview.lines?.data?.[preview.lines.data.length - 1];
      const nextEndEpoch = (lastLine?.period?.end ?? null) as number | null;
      const newRenewalDate = nextEndEpoch
        ? new Date(nextEndEpoch * 1000).toISOString()
        : periodEndMs
          ? new Date(periodEndMs).toISOString()
          : null;
      res.json({
        success: true,
        data: { ...base, chargeNowBrlCents, effectiveDate: new Date().toISOString(), newRenewalDate },
      });
      return;
    }

    // downgrade / downgrade_annual_locked → sem cobrança agora, vale no fim do período.
    const effectiveDate = periodEndMs ? new Date(periodEndMs).toISOString() : null;
    res.json({
      success: true,
      data: { ...base, chargeNowBrlCents: 0, effectiveDate, newRenewalDate: effectiveDate },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/billing/change — aplica a troca. Reclassifica no servidor.
router.post('/change', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const loaded = await loadActiveSubscription(req, res);
    if (!loaded) return;
    const target = parseTarget(req, res);
    if (!target) return;

    const cls = classifyPlanChange(loaded.current, target);

    if (cls.kind === 'noop') {
      res.json({ success: true, kind: 'noop', message: 'Você já está neste plano.' });
      return;
    }
    if (cls.kind === 'contact_sales') {
      res.status(422).json({ error: 'contact_sales' });
      return;
    }

    const newPrice = priceIdForSelection(target.plan, target.cycle);
    if (!newPrice) {
      res.status(422).json({ error: 'target_has_no_price' });
      return;
    }

    if (cls.kind === 'upgrade') {
      // Cobra a diferença proporcional AGORA e troca o item na hora. O webhook
      // customer.subscription.updated sincroniza plano/ciclo/MRR na org.
      await stripe.subscriptions.update(loaded.sub.id, {
        items: [{ id: loaded.itemId, price: newPrice }],
        proration_behavior: 'always_invoice',
        payment_behavior: 'error_if_incomplete',
      });
      // Se havia downgrade agendado, o upgrade imediato o torna obsoleto.
      await prisma.organization
        .update({ where: { id: loaded.orgId }, data: { pendingPlanChange: null } as any })
        .catch(() => {});
      logger.info('billing.change.upgrade_applied', {
        organizationId: loaded.orgId,
        from: loaded.current,
        to: target,
      });
      res.json({ success: true, kind: 'upgrade', effectiveTiming: 'immediate' });
      return;
    }

    // downgrade / downgrade_annual_locked → agenda via Subscription Schedule.
    const periodEndMs = currentPeriodEndMs(loaded.sub as any);
    const periodEndEpoch = periodEndMs ? Math.round(periodEndMs / 1000) : null;

    // Cria (ou reaproveita) o schedule a partir da assinatura e define 2 fases:
    // preço atual até o fim do período, depois o preço novo.
    const existingScheduleId =
      typeof loaded.sub.schedule === 'string' ? loaded.sub.schedule : loaded.sub.schedule?.id;
    const schedule = existingScheduleId
      ? await stripe.subscriptionSchedules.retrieve(existingScheduleId)
      : await stripe.subscriptionSchedules.create({ from_subscription: loaded.sub.id });

    const phase0 = schedule.phases?.[0];
    const currentPriceId = priceIdForSelection(loaded.current.plan, loaded.current.cycle) ?? newPrice;
    const startDate = (phase0?.start_date as number | undefined) ?? undefined;
    const boundary = (phase0?.end_date as number | undefined) ?? periodEndEpoch ?? undefined;

    await stripe.subscriptionSchedules.update(schedule.id, {
      proration_behavior: 'none',
      end_behavior: 'release',
      phases: [
        {
          items: [{ price: currentPriceId, quantity: 1 }],
          ...(startDate ? { start_date: startDate } : {}),
          ...(boundary ? { end_date: boundary } : {}),
        },
        {
          items: [{ price: newPrice, quantity: 1 }],
          ...(boundary ? { start_date: boundary } : {}),
        },
      ],
    });

    const effectiveAt = periodEndMs ? new Date(periodEndMs).toISOString() : null;
    await prisma.organization.update({
      where: { id: loaded.orgId },
      data: {
        pendingPlanChange: {
          plan: target.plan,
          cycle: target.cycle,
          effectiveAt,
          scheduleId: schedule.id,
        },
      } as any,
    });
    logger.info('billing.change.downgrade_scheduled', {
      organizationId: loaded.orgId,
      from: loaded.current,
      to: target,
      effectiveAt,
    });
    res.json({ success: true, kind: cls.kind, effectiveTiming: cls.effectiveTiming, effectiveAt });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/billing/change/scheduled — cancela um downgrade agendado.
router.delete('/change/scheduled', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'organization context missing' });
      return;
    }
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { pendingPlanChange: true, stripeSubscriptionId: true },
    });
    const pending = (org?.pendingPlanChange as any) || null;
    const scheduleId: string | null = pending?.scheduleId ?? null;

    if (scheduleId && env.STRIPE_SECRET_KEY) {
      await stripe.subscriptionSchedules.release(scheduleId).catch((e) => {
        // Já liberado/aplicado — idempotente, seguimos limpando o marcador.
        logger.warn('billing.change.release_noop', { organizationId: orgId, err: String(e) });
      });
    }
    await prisma.organization
      .update({ where: { id: orgId }, data: { pendingPlanChange: null } as any })
      .catch(() => {});

    res.json({ success: true });
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

// GET /api/billing/usage
// FIX W3.1 — uso REAL do periodo corrente vs limite do plano do tenant.
// Substitui o mock hardcoded (340/1000, 1/5, 3/5) do billing/page.tsx.
// Retorna { conversas, atendentes, docs, aiMessages }, cada um { used, limit }.
router.get('/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'organization context missing' });
      return;
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    });

    const usage = await computeBillingUsage(org?.plan, {
      // Conversas criadas no mes corrente.
      countConversations: (start, end) =>
        prisma.conversation
          .count({ where: { organizationId: orgId, createdAt: { gte: start, lt: end } } })
          .catch(() => 0),
      // Atendentes = seats de usuario da org.
      countAgents: () =>
        prisma.user.count({ where: { organizationId: orgId } }).catch(() => 0),
      // Docs na base RAG (KBDocument via KnowledgeBase da org).
      countDocs: () =>
        prisma.kBDocument
          .count({ where: { knowledgeBase: { organizationId: orgId } } })
          .catch(() => 0),
      // Mensagens de IA no ciclo — mesmo contador Redis do enforcement de quota.
      getAiMessagesUsage: () => getUsage(orgId, 'aiMessagesPerMonth').catch(() => 0),
    });

    res.json({ success: true, data: usage });
  } catch (err) {
    next(err);
  }
});

// GET /api/billing/recommendation
// Trial Enforcement — plano mais adequado pelo perfil de uso do trial + addons
// sugeridos. Consumido pela paywall (RecommendationHero) e pelo digest superadmin.
// Isento do gate requireActivePlan (montado em /api/billing, sem o gate).
router.get('/recommendation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'organization context missing' });
      return;
    }
    const recommendation = await buildRecommendation(orgId);
    res.json({ success: true, data: recommendation });
  } catch (err) {
    next(err);
  }
});

// GET /api/billing/addons — catálogo dos addons recorrentes compráveis "no pacote"
// (key + nome + preço; o price ID fica no servidor). Consumido pela paywall.
router.get('/addons', (_req: Request, res: Response) => {
  const addons = listPurchasableAddons().map(({ key, name, amountBrl }) => ({ key, name, amountBrl }));
  res.json({ success: true, data: addons });
});

// GET /api/billing/subscription
// FEATURE 5b.1 — estado REAL da assinatura pra tela de billing.
// Le as colunas ja existentes da Organization (subscriptionStatus, billingCycle,
// trialEndsAt, paidAt, stripeCustomerId, stripeSubscriptionId, plan) + a fatura
// paga mais recente das stripe_invoices. Estados honestos quando nao ha Stripe
// (a maioria das orgs): 'trialing' (com countdown) ou 'no_subscription'.
// Retorna { status, cycle, trialEndsAt, trialDaysLeft, nextInvoice?, lastInvoice?, plan }.
router.get('/subscription', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'organization context missing' });
      return;
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        plan: true,
        subscriptionStatus: true,
        billingCycle: true,
        trialEndsAt: true,
        paidAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!org) {
      res.status(404).json({ error: 'organization not found' });
      return;
    }

    // Fatura paga mais recente (maior paidAt) das stripe_invoices. Fail-soft:
    // se a tabela ainda nao tem nada (org sem Stripe), lastInvoice = null.
    const lastInvoice = await prisma.stripeInvoice
      .findFirst({
        where: { organizationId: orgId, status: 'paid' },
        orderBy: { paidAt: 'desc' },
        select: {
          amountBrlCents: true,
          status: true,
          periodStart: true,
          periodEnd: true,
          paidAt: true,
        },
      })
      .catch(() => null);

    const state = buildSubscriptionState({
      org: {
        plan: org.plan,
        subscriptionStatus: org.subscriptionStatus,
        billingCycle: org.billingCycle,
        trialEndsAt: org.trialEndsAt,
        paidAt: org.paidAt,
        stripeCustomerId: org.stripeCustomerId,
        stripeSubscriptionId: org.stripeSubscriptionId,
      },
      lastInvoice: lastInvoice
        ? {
            amountBrlCents: lastInvoice.amountBrlCents,
            status: lastInvoice.status,
            periodStart: lastInvoice.periodStart,
            periodEnd: lastInvoice.periodEnd,
            paidAt: lastInvoice.paidAt,
          }
        : null,
    });

    res.json({ success: true, data: state });
  } catch (err) {
    next(err);
  }
});

export default router;
