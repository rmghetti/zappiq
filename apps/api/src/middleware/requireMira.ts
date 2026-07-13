import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import {
  resolveMiraAccess,
  computeMiraQuota,
  MIRA_TRIAL_ALVOS,
  type MiraAccess,
  type MiraQuota,
  type PlanId,
} from '@zappiq/shared';
import { logger } from '../utils/logger.js';

/** Chave de mês reservada (nunca é um 'YYYY-MM' real) para o ledger vitalício do teste grátis. */
const TRIAL_LEDGER_KEY = 'TRIAL';

/*
 * ═════════════════════════════════════════════════════════════════
 * Mira Prospects — entitlement + cota + gate.
 * ─────────────────────────────────────────────────────────────────
 * Uma org tem acesso ao Mira quando:
 *   - settings.addons inclui uma faixa (MIRA_ESSENCIAL/PRO/SCALE), OU
 *   - o plano já inclui uma faixa (BUSINESS→PRO, ENTERPRISE→SCALE), OU
 *   - settings.miraAlpha === true (flag de beta interno).
 *
 * A fonte real de "add-on pago" é o webhook Stripe populando
 * settings.addons (mesmo array do SCHEDULING_AGENT/Impulso).
 * Gate fail-CLOSED (add-on pago não vaza por erro de leitura).
 *
 * Cota: MiraUsageMonthly (ledger por org+mês). used = Alvos que
 * viraram READY no mês; packExtra = packs one-shot comprados no mês
 * (não acumulam). computeMiraQuota é função pura do @zappiq/shared.
 * ═════════════════════════════════════════════════════════════════
 */

export interface MiraEntitlementView {
  access: MiraAccess & {
    source: 'addon' | 'included' | 'alpha' | 'trial' | null;
    /** Pode ativar o teste grátis agora (nunca ativou e não tem faixa/inclusão). */
    trialAvailable: boolean;
  };
  quota: MiraQuota;
  monthKey: string;
}

/** 'YYYY-MM' no fuso de São Paulo (virada de cota = virada do mês local). */
export function currentMonthKey(now = new Date()): string {
  const sp = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const y = sp.getFullYear();
  const m = String(sp.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function getMiraEntitlement(orgId: string): Promise<MiraEntitlementView> {
  const org = (await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, settings: true },
  })) as any;
  const settings = (org?.settings as any) ?? {};
  const addons: string[] = Array.isArray(settings.addons) ? settings.addons : [];
  const plan = ((org?.plan as string) || 'IZA_LITE') as PlanId;

  const base = resolveMiraAccess(plan, addons);
  const alpha = settings.miraAlpha === true;
  const trialActive = Boolean(settings.miraTrialActivatedAt);
  const entitled = base.entitled || alpha || trialActive;
  const source: 'addon' | 'included' | 'alpha' | 'trial' | null = base.entitled
    ? (base.reason as 'addon' | 'included')
    : alpha
      ? 'alpha'
      : trialActive
        ? 'trial'
        : null;
  // Alpha sem assinatura: opera na faixa de entrada para ter cota funcional.
  // Trial não tem faixa real (tier fica null; a cota é o teto vitalício).
  const tier = base.tier ?? (alpha ? 'MIRA_ESSENCIAL' : null);
  const trialAvailable = !base.entitled && !alpha && !trialActive;

  const monthKey = currentMonthKey();
  let quota: MiraQuota;
  if (source === 'trial') {
    // Cota vitalícia (nunca reseta): ledger com chave reservada 'TRIAL'.
    const ledger = await (prisma as any).miraUsageMonthly.findUnique({
      where: { organizationId_monthKey: { organizationId: orgId, monthKey: TRIAL_LEDGER_KEY } },
      select: { used: true },
    });
    const used = ledger?.used ?? 0;
    quota = {
      tierQuota: MIRA_TRIAL_ALVOS,
      packExtra: 0,
      total: MIRA_TRIAL_ALVOS,
      used,
      remaining: Math.max(0, MIRA_TRIAL_ALVOS - used),
      blocked: used >= MIRA_TRIAL_ALVOS,
    };
  } else {
    let used = 0;
    let packExtra = 0;
    if (entitled) {
      const ledger = await (prisma as any).miraUsageMonthly.findUnique({
        where: { organizationId_monthKey: { organizationId: orgId, monthKey } },
        select: { used: true, packExtra: true },
      });
      used = ledger?.used ?? 0;
      packExtra = ledger?.packExtra ?? 0;
    }
    quota = computeMiraQuota(tier, used, packExtra);
  }

  return {
    access: { ...base, entitled, tier, source, trialAvailable },
    quota,
    monthKey,
  };
}

/**
 * Consome 1 unidade de cota (Alvo virou READY). Atômico via upsert+increment.
 * Retorna a cota atualizada; lança MiraQuotaExceededError se bloqueado.
 */
export class MiraQuotaExceededError extends Error {
  constructor(public quota: MiraQuota) {
    super('mira_quota_exceeded');
  }
}

export async function consumeMiraQuota(orgId: string): Promise<MiraQuota> {
  const ent = await getMiraEntitlement(orgId);
  if (!ent.access.entitled) throw new MiraQuotaExceededError(ent.quota);
  if (ent.access.source !== 'trial' && !ent.access.tier) throw new MiraQuotaExceededError(ent.quota);
  if (ent.quota.blocked) throw new MiraQuotaExceededError(ent.quota);

  if (ent.access.source === 'trial') {
    const updated = await (prisma as any).miraUsageMonthly.upsert({
      where: { organizationId_monthKey: { organizationId: orgId, monthKey: TRIAL_LEDGER_KEY } },
      create: { organizationId: orgId, monthKey: TRIAL_LEDGER_KEY, used: 1 },
      update: { used: { increment: 1 } },
      select: { used: true },
    });
    const used = updated.used as number;
    return {
      tierQuota: MIRA_TRIAL_ALVOS,
      packExtra: 0,
      total: MIRA_TRIAL_ALVOS,
      used,
      remaining: Math.max(0, MIRA_TRIAL_ALVOS - used),
      blocked: used >= MIRA_TRIAL_ALVOS,
    };
  }

  const monthKey = ent.monthKey;
  const updated = await (prisma as any).miraUsageMonthly.upsert({
    where: { organizationId_monthKey: { organizationId: orgId, monthKey } },
    create: { organizationId: orgId, monthKey, used: 1 },
    update: { used: { increment: 1 } },
    select: { used: true, packExtra: true },
  });
  return computeMiraQuota(ent.access.tier, updated.used, updated.packExtra);
}

/** Credita um pack one-shot no mês corrente (chamado pelo billing/webhook). */
export async function creditMiraPack(
  orgId: string,
  pack: { key: string; alvos: number; priceBrl: number; stripeRef?: string }
): Promise<void> {
  const monthKey = currentMonthKey();
  const entry = { pack: pack.key, alvos: pack.alvos, priceBrl: pack.priceBrl, stripeRef: pack.stripeRef ?? null, at: new Date().toISOString() };
  const existing = await (prisma as any).miraUsageMonthly.findUnique({
    where: { organizationId_monthKey: { organizationId: orgId, monthKey } },
    select: { packPurchases: true },
  });
  const purchases = Array.isArray(existing?.packPurchases) ? existing.packPurchases : [];
  purchases.push(entry);
  await (prisma as any).miraUsageMonthly.upsert({
    where: { organizationId_monthKey: { organizationId: orgId, monthKey } },
    create: { organizationId: orgId, monthKey, packExtra: pack.alvos, packPurchases: purchases },
    update: { packExtra: { increment: pack.alvos }, packPurchases: purchases },
  });
  logger.info(`[Mira] pack ${pack.key} creditado (+${pack.alvos} alvos) org=${orgId} mes=${monthKey}`);
}

/**
 * Middleware factory: protege as rotas de FEATURE do Mira.
 * Uso: app.use('/api/mira', authMiddleware, rlsTenantMiddleware, requireMira(), routes)
 */
export function requireMira() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'organization context missing' });
        return;
      }
      const ent = await getMiraEntitlement(orgId);
      if (!ent.access.entitled) {
        res.status(403).json({
          error: 'addon_required',
          addon: 'MIRA',
          message: 'O Mira Prospects não está ativo nesta conta.',
          eligible: ent.access.eligible,
          upgradeUrl: '/mira',
        });
        return;
      }
      (req as any).miraTier = ent.access.tier;
      next();
    } catch (err: any) {
      logger.error(`[requireMira] gate error: ${err?.message ?? err}`);
      // Fail-CLOSED: add-on pago não deve liberar por erro de leitura.
      res.status(403).json({ error: 'addon_check_failed' });
    }
  };
}
