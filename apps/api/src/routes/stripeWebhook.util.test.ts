import { describe, it, expect } from 'vitest';
import { STRIPE_V4_PRICES } from '@zappiq/shared';
import {
  resolvePlanFromPriceId,
  planToOrgEnum,
  mrrCentsForPlan,
  normalizeSubscriptionStatus,
  isActiveSubscriptionStatus,
  isPastDueStatus,
  mergeSettings,
  stripeEpochToDate,
} from './stripeWebhook.util.js';

describe('resolvePlanFromPriceId', () => {
  it('resolve priceId mensal/anual do V4 para plano + ciclo', () => {
    expect(resolvePlanFromPriceId(STRIPE_V4_PRICES.IZA_LITE.monthly)).toEqual({
      plan: 'IZA_LITE',
      billingCycle: 'monthly',
    });
    expect(resolvePlanFromPriceId(STRIPE_V4_PRICES.GROWTH.annual)).toEqual({
      plan: 'GROWTH',
      billingCycle: 'annual',
    });
    expect(resolvePlanFromPriceId(STRIPE_V4_PRICES.SCALE.monthly)).toEqual({
      plan: 'SCALE',
      billingCycle: 'monthly',
    });
  });

  it('retorna null para priceId desconhecido, vazio ou nulo', () => {
    expect(resolvePlanFromPriceId('price_desconhecido')).toBeNull();
    expect(resolvePlanFromPriceId('')).toBeNull();
    expect(resolvePlanFromPriceId(null)).toBeNull();
    expect(resolvePlanFromPriceId(undefined)).toBeNull();
  });
});

describe('planToOrgEnum', () => {
  it('IZA_LITE mapeia para STARTER (enum PlanType do banco)', () => {
    expect(planToOrgEnum('IZA_LITE')).toBe('STARTER');
    expect(planToOrgEnum('iza_lite')).toBe('STARTER');
  });

  it('planos que existem no enum passam direto', () => {
    expect(planToOrgEnum('GROWTH')).toBe('GROWTH');
    expect(planToOrgEnum('SCALE')).toBe('SCALE');
    expect(planToOrgEnum('BUSINESS')).toBe('BUSINESS');
    expect(planToOrgEnum('ENTERPRISE')).toBe('ENTERPRISE');
  });

  it('retorna null para plano desconhecido (não grava lixo no enum)', () => {
    expect(planToOrgEnum('LIXO')).toBeNull();
    expect(planToOrgEnum(null)).toBeNull();
    expect(planToOrgEnum(undefined)).toBeNull();
  });
});

describe('mrrCentsForPlan', () => {
  it('mensal usa priceMonthly * 100', () => {
    expect(mrrCentsForPlan('IZA_LITE', 'monthly')).toBe(24700); // R$247,00
    expect(mrrCentsForPlan('GROWTH', 'monthly')).toBe(49700); // R$497,00
    expect(mrrCentsForPlan('SCALE', 'monthly')).toBe(149700); // R$1497,00
  });

  it('anual normaliza para mensal equivalente com desconto (20%)', () => {
    // IZA_LITE 247 * 0.8 = 197.60 → 19760 centavos
    expect(mrrCentsForPlan('IZA_LITE', 'annual')).toBe(19760);
  });

  it('plano sem preço (ENTERPRISE custom) ou desconhecido → 0', () => {
    expect(mrrCentsForPlan('ENTERPRISE', 'monthly')).toBe(0);
    expect(mrrCentsForPlan('DESCONHECIDO', 'monthly')).toBe(0);
    expect(mrrCentsForPlan(null)).toBe(0);
  });
});

describe('status helpers', () => {
  it('normalizeSubscriptionStatus faz trim/lowercase e trata vazio', () => {
    expect(normalizeSubscriptionStatus('  ACTIVE ')).toBe('active');
    expect(normalizeSubscriptionStatus('')).toBeNull();
    expect(normalizeSubscriptionStatus(null)).toBeNull();
  });

  it('isActiveSubscriptionStatus só para active/trialing', () => {
    expect(isActiveSubscriptionStatus('active')).toBe(true);
    expect(isActiveSubscriptionStatus('trialing')).toBe(true);
    expect(isActiveSubscriptionStatus('past_due')).toBe(false);
    expect(isActiveSubscriptionStatus('canceled')).toBe(false);
  });

  it('isPastDueStatus para past_due/unpaid', () => {
    expect(isPastDueStatus('past_due')).toBe(true);
    expect(isPastDueStatus('unpaid')).toBe(true);
    expect(isPastDueStatus('active')).toBe(false);
  });
});

describe('mergeSettings — corrige o bug §0.4 (não sobrescrever settings inteiro)', () => {
  it('preserva chaves existentes (niche/agentName/billing) e sobrescreve só o patch', () => {
    const existing = { niche: 'imobiliaria', agentName: 'Iza', billing: { plan: 'x' } };
    const merged = mergeSettings(existing, {
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
    });
    expect(merged).toEqual({
      niche: 'imobiliaria',
      agentName: 'Iza',
      billing: { plan: 'x' },
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
    });
  });

  it('sobrescreve chave existente quando presente no patch', () => {
    const merged = mergeSettings({ stripeCustomerId: 'antigo', niche: 'x' }, { stripeCustomerId: 'novo' });
    expect(merged).toEqual({ stripeCustomerId: 'novo', niche: 'x' });
  });

  it('ignora chaves undefined no patch (não apaga)', () => {
    const merged = mergeSettings({ niche: 'x' }, { stripeCustomerId: undefined });
    expect(merged).toEqual({ niche: 'x' });
  });

  it('trata settings inexistente/não-objeto como {} base', () => {
    expect(mergeSettings(null, { a: 1 })).toEqual({ a: 1 });
    expect(mergeSettings(undefined, { a: 1 })).toEqual({ a: 1 });
    expect(mergeSettings('lixo', { a: 1 })).toEqual({ a: 1 });
    expect(mergeSettings([1, 2], { a: 1 })).toEqual({ a: 1 });
  });
});

describe('stripeEpochToDate', () => {
  it('converte epoch em segundos para Date', () => {
    const d = stripeEpochToDate(1_700_000_000);
    expect(d?.getTime()).toBe(1_700_000_000_000);
  });

  it('null/undefined/NaN → null', () => {
    expect(stripeEpochToDate(null)).toBeNull();
    expect(stripeEpochToDate(undefined)).toBeNull();
    expect(stripeEpochToDate(NaN)).toBeNull();
  });
});
