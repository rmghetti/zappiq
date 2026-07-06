import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';

/*
 * ═════════════════════════════════════════════════════════════════
 * Impulso (add-on de campanhas premium) — gate de entitlement.
 * ─────────────────────────────────────────────────────────────────
 * Uma org tem acesso ao Impulso quando:
 *   - settings.addons inclui um dos tiers do Impulso, OU
 *   - settings.impulsoAlpha === true (flag de soft-launch/beta), OU
 *   - (futuro) subscriptionStatus ativo com o item do add-on no Stripe.
 *
 * A fonte real de "add-on pago" é o webhook Stripe populando
 * settings.addons; impulsoAlpha libera beta sem cobrança. Gate
 * fail-CLOSED (add-on pago não deve vazar por erro de leitura).
 * ═════════════════════════════════════════════════════════════════
 */

export const IMPULSO_ADDON_KEYS = ['IMPULSO_START', 'IMPULSO_PRO', 'IMPULSO_SCALE'] as const;
export type ImpulsoTier = (typeof IMPULSO_ADDON_KEYS)[number];

export async function orgHasImpulso(
  orgId: string,
): Promise<{ enabled: boolean; tier: ImpulsoTier | null; alpha: boolean }> {
  const org = (await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  })) as any;
  const settings = (org?.settings as any) ?? {};
  const addons: string[] = Array.isArray(settings.addons) ? settings.addons : [];
  const tier = (IMPULSO_ADDON_KEYS.find((k) => addons.includes(k)) ?? null) as ImpulsoTier | null;
  const alpha = settings.impulsoAlpha === true;
  return { enabled: Boolean(tier) || alpha, tier, alpha };
}

/**
 * Middleware factory: protege as rotas do módulo Impulso.
 * Uso: app.use('/api/impulso', authMiddleware, rlsTenantMiddleware, requireImpulso(), routes)
 */
export function requireImpulso() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'organization context missing' });
        return;
      }
      const { enabled, tier, alpha } = await orgHasImpulso(orgId);
      if (!enabled) {
        res.status(403).json({
          error: 'addon_required',
          addon: 'IMPULSO',
          message: 'O modulo Impulso (campanhas) nao esta ativo nesta conta. Ative em /billing.',
          upgradeUrl: '/billing',
        });
        return;
      }
      // Disponibiliza o tier do add-on pro handler (limites de contatos etc.).
      (req as any).impulsoTier = tier ?? (alpha ? 'IMPULSO_ALPHA' : null);
      next();
    } catch (err: any) {
      logger.error(`[requireImpulso] gate error: ${err?.message ?? err}`);
      // Fail-CLOSED: add-on pago nao deve liberar por erro de leitura.
      res.status(403).json({ error: 'addon_check_failed' });
    }
  };
}
