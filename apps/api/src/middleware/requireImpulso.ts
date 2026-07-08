import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';

/*
 * ═════════════════════════════════════════════════════════════════
 * Impulso (add-on de campanhas premium) — entitlement + gate.
 * ─────────────────────────────────────────────────────────────────
 * Uma org tem acesso ao Impulso quando:
 *   - settings.addons inclui um tier do Impulso (assinatura paga), OU
 *   - settings.impulsoAlpha === true (flag de beta interno), OU
 *   - settings.impulsoTrial está ativo (teste de 7 dias, endsAt > agora).
 *
 * O teste de 7 dias é do PRÓPRIO add-on (independe do trial de 14 dias
 * da plataforma). Pode ser ativado por qualquer conta que ainda não
 * usou o teste — esteja ela no trial da plataforma ou já pagante.
 *
 * A fonte real de "add-on pago" é o webhook Stripe populando
 * settings.addons. Gate fail-CLOSED (add-on pago não vaza por erro).
 * ═════════════════════════════════════════════════════════════════
 */

export const IMPULSO_ADDON_KEYS = ['IMPULSO_START', 'IMPULSO_PRO', 'IMPULSO_SCALE'] as const;
export type ImpulsoTier = (typeof IMPULSO_ADDON_KEYS)[number];
export const IMPULSO_TRIAL_DAYS = 7;

export interface ImpulsoEntitlement {
  enabled: boolean;
  source: 'addon' | 'alpha' | 'trial' | null;
  tier: ImpulsoTier | null;
  /** Teste de 7 dias ativo (se houver). */
  trial: { endsAt: string; daysLeft: number } | null;
  /** Pode iniciar um teste de 7 dias (nunca iniciou e não é assinante/alpha). */
  trialAvailable: boolean;
  /** Teste de 7 dias já foi usado e acabou, sem add-on/alpha — serviço bloqueado. */
  trialExpired: boolean;
  /** Org tem Instagram conectado (organization.instagramAccountId) — libera o canal Instagram. */
  hasInstagram: boolean;
}

export async function getImpulsoEntitlement(orgId: string): Promise<ImpulsoEntitlement> {
  const org = (await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true, instagramAccountId: true },
  })) as any;
  const settings = (org?.settings as any) ?? {};
  const hasInstagram = Boolean(org?.instagramAccountId);
  const addons: string[] = Array.isArray(settings.addons) ? settings.addons : [];
  const tier = (IMPULSO_ADDON_KEYS.find((k) => addons.includes(k)) ?? null) as ImpulsoTier | null;
  const alpha = settings.impulsoAlpha === true;

  // Teste de 7 dias
  const trialRaw = settings.impulsoTrial;
  let trial: { endsAt: string; daysLeft: number } | null = null;
  let trialActive = false;
  let trialEverStarted = false;
  if (trialRaw && typeof trialRaw.endsAt === 'string') {
    trialEverStarted = true;
    const endsAtMs = new Date(trialRaw.endsAt).getTime();
    if (!Number.isNaN(endsAtMs) && endsAtMs > Date.now()) {
      trialActive = true;
      const daysLeft = Math.max(1, Math.ceil((endsAtMs - Date.now()) / (1000 * 60 * 60 * 24)));
      trial = { endsAt: trialRaw.endsAt, daysLeft };
    }
  }

  const source: ImpulsoEntitlement['source'] = tier ? 'addon' : alpha ? 'alpha' : trialActive ? 'trial' : null;
  const enabled = Boolean(tier) || alpha || trialActive;
  const trialAvailable = !trialEverStarted && !tier && !alpha;
  // Teste começou, já venceu e a org não virou assinante/alpha: serviço bloqueado.
  const trialExpired = trialEverStarted && !trialActive && !tier && !alpha;

  return { enabled, source, tier, trial, trialAvailable, trialExpired, hasInstagram };
}

/**
 * Ativa o teste de 7 dias do Impulso para a org, se disponível.
 * Não bloqueia por estado do trial de 14 dias da plataforma nem por
 * plano — qualquer conta que ainda não usou o teste pode ativá-lo.
 */
export async function startImpulsoTrial(orgId: string): Promise<{
  ok: boolean;
  reason?: 'already_active' | 'trial_active' | 'trial_used';
  entitlement: ImpulsoEntitlement;
}> {
  const ent = await getImpulsoEntitlement(orgId);
  if (ent.tier || ent.source === 'alpha') {
    return { ok: false, reason: 'already_active', entitlement: ent };
  }
  if (!ent.trialAvailable) {
    return { ok: false, reason: ent.trial ? 'trial_active' : 'trial_used', entitlement: ent };
  }
  const org = (await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  })) as any;
  const settings = (org?.settings as any) ?? {};
  const now = new Date();
  const endsAt = new Date(now.getTime() + IMPULSO_TRIAL_DAYS * 24 * 60 * 60 * 1000);
  settings.impulsoTrial = { startedAt: now.toISOString(), endsAt: endsAt.toISOString() };
  await prisma.organization.update({ where: { id: orgId }, data: { settings } });
  logger.info(`[Impulso] Teste de ${IMPULSO_TRIAL_DAYS} dias ativado para org=${orgId} (ate ${endsAt.toISOString()})`);
  return { ok: true, entitlement: await getImpulsoEntitlement(orgId) };
}

/** Compat: checagem booleana simples usada pelo gate. */
export async function orgHasImpulso(orgId: string): Promise<{ enabled: boolean; tier: ImpulsoTier | null }> {
  const ent = await getImpulsoEntitlement(orgId);
  return { enabled: ent.enabled, tier: ent.tier };
}

/**
 * Middleware factory: protege as rotas de FEATURE do Impulso.
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
      const ent = await getImpulsoEntitlement(orgId);
      if (!ent.enabled) {
        res.status(403).json({
          error: 'addon_required',
          addon: 'IMPULSO',
          message: 'O modulo Impulso (campanhas) nao esta ativo nesta conta.',
          trialAvailable: ent.trialAvailable,
          upgradeUrl: '/campaigns',
        });
        return;
      }
      (req as any).impulsoTier = ent.tier ?? ent.source;
      next();
    } catch (err: any) {
      logger.error(`[requireImpulso] gate error: ${err?.message ?? err}`);
      // Fail-CLOSED: add-on pago nao deve liberar por erro de leitura.
      res.status(403).json({ error: 'addon_check_failed' });
    }
  };
}
