/**
 * Cupons de desconto — emissão e auditoria pelo SUPERADMIN (2026-07-08).
 *
 * O superadmin escolhe um produto (plano ou addon) + um desconto (10..100%) +
 * uma duração; geramos um Stripe Coupon RESTRITO àquele produto
 * (applies_to.products) e de USO ÚNICO (max_redemptions=1) + um Promotion Code
 * com código legível copiável. O cliente digita o código no campo "Cupom de
 * desconto" do checkout; a própria Stripe só aplica ao produto certo e recusa
 * se o produto não estiver no carrinho (isolamento nativo — pesquisado).
 *
 * Requer role SUPERADMIN (authz no servidor, nunca só na UI).
 */
import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import crypto from 'node:crypto';
import { prisma } from '@zappiq/database';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { listCouponableProducts, findCouponableProduct } from '@zappiq/shared';
import {
  buildCouponCreateParams,
  buildCouponName,
  generateCouponCode,
  bytesToCode,
  isCouponDuration,
} from './billingCoupons.util.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const router = Router();

router.use(authMiddleware, requireRole('SUPERADMIN'));

// GET /api/admin/coupons/catalog — produtos elegíveis pro dropdown.
router.get('/catalog', (_req: Request, res: Response) => {
  res.json({ success: true, data: listCouponableProducts() });
});

// GET /api/admin/coupons — cupons emitidos + status (usado/disponível).
// Sincroniza times_redeemed do Stripe (lista uma vez) pra refletir resgates.
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.discountCoupon.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });

    // Refresh best-effort do times_redeemed (não derruba a lista se o Stripe falhar).
    const redeemedByCode = new Map<string, number>();
    if (env.STRIPE_SECRET_KEY && rows.length > 0) {
      await stripe.promotionCodes
        .list({ limit: 100 })
        .then((pc) => {
          for (const p of pc.data) redeemedByCode.set(p.code, p.times_redeemed ?? 0);
        })
        .catch((e) => logger.warn('admin.coupons.list_promos_failed', { err: String(e) }));
    }

    const data = rows.map((r) => {
      const timesRedeemed = redeemedByCode.get(r.code) ?? r.timesRedeemed;
      const used = timesRedeemed >= 1;
      // Status: usado > cancelado (inativo e nunca usado) > disponível.
      const status = used ? 'used' : r.active ? 'available' : 'canceled';
      return {
        code: r.code,
        productKey: r.productKey,
        productLabel: r.productLabel,
        percentOff: r.percentOff,
        duration: r.duration,
        durationInMonths: r.durationInMonths,
        createdByEmail: r.createdByEmail,
        timesRedeemed,
        used,
        active: r.active,
        status,
        canCancel: !used && r.active, // só cancela o que está disponível
        createdAt: r.createdAt,
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/coupons — emite um novo cupom escopado + uso único.
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!env.STRIPE_SECRET_KEY) {
      res.status(503).json({ error: 'Stripe não configurado' });
      return;
    }
    const { productId, percentOff, duration, durationInMonths } = req.body ?? {};

    const product = findCouponableProduct(productId);
    if (!product) {
      res.status(400).json({ error: 'invalid_product', message: 'Produto não é elegível a cupom.' });
      return;
    }
    if (!isCouponDuration(duration)) {
      res.status(400).json({ error: 'invalid_duration' });
      return;
    }

    let couponParams;
    try {
      couponParams = buildCouponCreateParams({
        percentOff: Number(percentOff),
        productId: product.productId,
        duration,
        durationInMonths: durationInMonths != null ? Number(durationInMonths) : null,
      });
    } catch (e: any) {
      res.status(400).json({ error: e?.message || 'invalid_input' });
      return;
    }

    // 1) Coupon (regra + escopo + uso único).
    const coupon = await stripe.coupons.create({
      ...couponParams,
      // Stripe limita coupon.name a 40 chars — buildCouponName trunca com segurança.
      name: buildCouponName(couponParams.percent_off, product.label),
    } as Stripe.CouponCreateParams);

    // 2) Promotion Code (string digitável) com código único; retry em colisão.
    let promo: Stripe.PromotionCode | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 6 && !promo; attempt++) {
      const code = generateCouponCode(product.key, bytesToCode(crypto.randomBytes(12), 8));
      try {
        promo = await stripe.promotionCodes.create({
          coupon: coupon.id,
          code,
          max_redemptions: 1,
          active: true,
          metadata: { productId: product.productId, productKey: product.key },
        });
      } catch (e: any) {
        lastErr = e;
        // code já existe entre os ativos → tenta outro. Outros erros: aborta.
        if (!/already|exists|unique|code/i.test(e?.message ?? '')) throw e;
      }
    }
    if (!promo) throw lastErr ?? new Error('promo_code_generation_failed');

    // 3) Espelho local pra auditoria/listagem.
    await prisma.discountCoupon.create({
      data: {
        code: promo.code,
        stripeCouponId: coupon.id,
        stripePromotionCodeId: promo.id,
        productId: product.productId,
        productKey: product.key,
        productLabel: product.label,
        percentOff: couponParams.percent_off,
        duration: couponParams.duration,
        durationInMonths: couponParams.duration_in_months ?? null,
        createdByEmail: req.user?.email ?? 'superadmin',
        timesRedeemed: 0,
        active: true,
      },
    });

    logger.info('admin.coupons.created', {
      code: promo.code,
      product: product.key,
      percentOff: couponParams.percent_off,
      duration: couponParams.duration,
      by: req.user?.email,
    });

    res.status(201).json({
      success: true,
      data: {
        code: promo.code,
        productLabel: product.label,
        percentOff: couponParams.percent_off,
        duration: couponParams.duration,
        durationInMonths: couponParams.duration_in_months ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/coupons/:code — CANCELA um cupom AINDA NÃO USADO.
// Verifica no Stripe (fonte da verdade) que times_redeemed === 0; se já foi
// resgatado, recusa (409). Cancelar = desativar o promotion code + apagar o
// coupon no Stripe + marcar inativo localmente. Idempotente/fail-soft por parte.
router.delete('/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!env.STRIPE_SECRET_KEY) {
      res.status(503).json({ error: 'Stripe não configurado' });
      return;
    }
    const code = req.params.code;
    const row = await prisma.discountCoupon.findUnique({ where: { code } });
    if (!row) {
      res.status(404).json({ error: 'coupon_not_found' });
      return;
    }
    if (!row.active) {
      res.json({ success: true, alreadyCanceled: true });
      return;
    }

    // Fonte da verdade do resgate: o promotion code no Stripe.
    let timesRedeemed = row.timesRedeemed;
    try {
      const promo = await stripe.promotionCodes.retrieve(row.stripePromotionCodeId);
      timesRedeemed = promo.times_redeemed ?? timesRedeemed;
    } catch (e) {
      logger.warn('admin.coupons.cancel_retrieve_failed', { code, err: String(e) });
    }
    if (timesRedeemed >= 1) {
      // Já usado — não pode cancelar. Sincroniza o contador local.
      await prisma.discountCoupon
        .update({ where: { code }, data: { timesRedeemed } })
        .catch(() => {});
      res.status(409).json({ error: 'already_used', message: 'Este cupom já foi utilizado e não pode ser cancelado.' });
      return;
    }

    // Desativa o código (fail-soft) e apaga o coupon (invalida o resgate).
    await stripe.promotionCodes
      .update(row.stripePromotionCodeId, { active: false })
      .catch((e) => logger.warn('admin.coupons.deactivate_promo_failed', { code, err: String(e) }));
    await stripe.coupons
      .del(row.stripeCouponId)
      .catch((e) => logger.warn('admin.coupons.delete_coupon_failed', { code, err: String(e) }));

    await prisma.discountCoupon.update({ where: { code }, data: { active: false } });
    logger.info('admin.coupons.canceled', { code, by: req.user?.email });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
