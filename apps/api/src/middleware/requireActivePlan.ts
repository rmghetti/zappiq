/* ══════════════════════════════════════════════════════════════════════
 * requireActivePlan — gate de trial vencido (fronteira de SEGURANÇA).
 * --------------------------------------------------------------------
 * Montado após authMiddleware + rlsTenantMiddleware nas rotas de PRODUTO.
 * NÃO montar em: /api/billing, /api/onboarding, /api/auth, /api/dsr (LGPD),
 * /api/admin/* (já superadmin-gated), webhooks.
 *
 * Regra vem de computeAccessState (fonte única). paywall 'hard' → 402.
 * 'soft'/'past_due'/'none' passam (o banner é responsabilidade do web).
 *
 * Kill-switch: TRIAL_PAYWALL_ENFORCE=0 desliga sem redeploy (mesma convenção
 * dos crons — process.env direto). Fail-OPEN: erro no gate nunca derruba a
 * plataforma (prefere servir a bloquear indevidamente um cliente pago).
 * ══════════════════════════════════════════════════════════════════════ */
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { cache } from '../services/cloud/index.js';
import { logger } from '../utils/logger.js';
import { computeAccessState } from '../services/accountAccess.js';

// Campos mínimos pra decisão (PK indexada, select enxuto).
const ACCESS_SELECT = {
  plan: true,
  trialEndsAt: true,
  isTrialActive: true,
  trialConverted: true,
  paidAt: true,
  churnedAt: true,
  stripeSubscriptionId: true,
  subscriptionStatus: true,
  paywallGraceUntil: true,
} as const;

const CACHE_TTL_SECONDS = 60;
const cacheKey = (orgId: string): string => `zappiq:access:${orgId}`;

async function loadOrgAccess(orgId: string): Promise<Record<string, unknown> | null> {
  const cached = await cache.get(cacheKey(orgId));
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      /* cache corrompido — recarrega do banco */
    }
  }
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: ACCESS_SELECT,
  });
  if (org) {
    await cache.set(cacheKey(orgId), JSON.stringify(org), CACHE_TTL_SECONDS);
  }
  return org as Record<string, unknown> | null;
}

/** Invalida o cache de acesso da org (chamar quando o estado de billing muda). */
export async function invalidateOrgAccessCache(orgId: string): Promise<void> {
  await cache.del(cacheKey(orgId));
}

export async function requireActivePlan(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Kill-switch (convenção dos crons: process.env direto).
    if (process.env.TRIAL_PAYWALL_ENFORCE === '0') {
      next();
      return;
    }
    // Superadmin nunca é barrado (nem toca no banco).
    if ((req as any).user?.role === 'SUPERADMIN') {
      next();
      return;
    }
    const orgId = (req as any).organizationId as string | undefined;
    if (!orgId) {
      next(); // sem contexto de org — camadas anteriores decidem
      return;
    }
    const org = await loadOrgAccess(orgId);
    if (!org) {
      next(); // org não encontrada — não é papel deste gate barrar
      return;
    }
    // Enterprise é faturado sob consulta (invoiced), fora do self-serve.
    if (org.plan === 'ENTERPRISE') {
      next();
      return;
    }
    const { stage, paywall } = computeAccessState(org as any);
    if (paywall === 'hard') {
      res.status(402).json({
        error: 'Seu período de teste terminou. Escolha um plano para continuar.',
        reason: stage === 'CHURNED' ? 'subscription_canceled' : 'trial_expired',
        redirectTo: '/billing',
      });
      return;
    }
    (req as any).paywall = paywall; // 'none' | 'soft' | 'past_due'
    next();
  } catch (err) {
    // Fail-open deliberado: um erro no gate não pode derrubar a plataforma.
    logger.error({ msg: 'requireActivePlan_error', err: String(err) });
    next();
  }
}
