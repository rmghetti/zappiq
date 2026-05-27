// ─────────────────────────────────────────────────────────
// Stripe IDs V4 — Pricing aprovado 2026-05-27
// GERADO automaticamente pelo .command. Nao editar manual.
//
// IZA_LITE: Trial 14 dias aplicado na criacao da Subscription
// via Stripe SDK (trial_period_days: 14), nao no Price.
// ─────────────────────────────────────────────────────────

export const STRIPE_V4_MODE: 'LIVE' | 'TEST' = 'LIVE';

export interface StripePriceMap {
  productId: string;
  monthly: string;
  annual: string;
  trialDays: number;
}

export const STRIPE_V4_PRICES: Record<'IZA_LITE' | 'GROWTH' | 'SCALE', StripePriceMap> = {
  IZA_LITE: {
    productId: 'prod_UaxMHfEx97YuWa',
    monthly:   'price_1TblSBKlp5SWv74XcFCNa1SH',
    annual:    'price_1TblSCKlp5SWv74X47jspnSM',
    trialDays: 14,
  },
  GROWTH: {
    productId: 'prod_UaxMhgBJ6c0HDl',
    monthly:   'price_1TblSEKlp5SWv74XFVYZn3ok',
    annual:    'price_1TblSFKlp5SWv74XDB6FG8yi',
    trialDays: 0,
  },
  SCALE: {
    productId: 'prod_UaxMAibR8xghtl',
    monthly:   'price_1TblSGKlp5SWv74XggHTroW5',
    annual:    'price_1TblSIKlp5SWv74XYr3e8cr1',
    trialDays: 0,
  },
};
