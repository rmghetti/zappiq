#!/usr/bin/env ts-node
/*
 * ═════════════════════════════════════════════════════════════════
 * Stripe Products + Prices Bootstrap
 * ─────────────────────────────────────────────────────────────────
 * Cria no Stripe os produtos e prices correspondentes ao modelo
 * comercial 2026 (derivados de packages/shared/src/planConfig.ts).
 *
 * Uso:
 *   export STRIPE_SECRET_KEY=sk_live_...   # ou sk_test_... p/ sandbox
 *   pnpm tsx scripts/setup-stripe-products.ts
 *
 * Comportamento:
 * - Idempotente: procura por product com mesmo `metadata.plan_id`
 *   antes de criar. Nunca duplica.
 * - Cria dois prices por plano (mensal + anual) para self-serve.
 * - Cria prices separados para add-ons recorrentes.
 * - Ao final, imprime JSON com todos os price IDs — copie para a
 *   variável STRIPE_PRICE_IDS da API (ou guarde em vault).
 *
 * Enterprise NÃO recebe prices aqui — é sempre sales-led.
 * ═════════════════════════════════════════════════════════════════
 */

import Stripe from 'stripe';
import {
  PLAN_CONFIG,
  ADDONS,
  getAnnualPrice,
  type PlanConfig,
  type AddonConfig,
} from '@zappiq/shared';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) {
  console.error('✖ STRIPE_SECRET_KEY env var is required.');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_KEY);

const SELF_SERVE_PLANS: PlanConfig['id'][] = ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS'];

type PriceMap = Record<string, { monthly?: string; annual?: string; product: string }>;

async function findOrCreateProduct(
  planId: string,
  name: string,
  description: string,
): Promise<Stripe.Product> {
  const existing = await stripe.products.search({
    query: `metadata['plan_id']:'${planId}' AND active:'true'`,
  });
  if (existing.data.length > 0) {
    console.log(`  ✓ product already exists: ${planId} (${existing.data[0].id})`);
    return existing.data[0];
  }
  const p = await stripe.products.create({
    name,
    description,
    metadata: { plan_id: planId, source: 'zappiq-setup' },
  });
  console.log(`  + product created: ${planId} (${p.id})`);
  return p;
}

async function findOrCreatePrice(
  productId: string,
  amountBrlCents: number,
  interval: 'month' | 'year',
  lookupKey: string,
): Promise<Stripe.Price> {
  const existing = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });
  const match = existing.data.find(
    (p) =>
      p.unit_amount === amountBrlCents &&
      p.recurring?.interval === interval &&
      p.currency === 'brl',
  );
  if (match) {
    console.log(`    ✓ price exists: ${lookupKey} (${match.id})`);
    return match;
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: 'brl',
    unit_amount: amountBrlCents,
    recurring: { interval },
    lookup_key: lookupKey,
    metadata: { lookup_key: lookupKey },
  });
  console.log(`    + price created: ${lookupKey} (${price.id}) = R$ ${(amountBrlCents / 100).toFixed(2)}/${interval}`);
  return price;
}

async function setupPlan(planId: PlanConfig['id']): Promise<PriceMap[string]> {
  const plan = PLAN_CONFIG[planId];
  console.log(`\n▼ Plan ${plan.name} (${planId})`);

  const product = await findOrCreateProduct(
    planId,
    `ZappIQ ${plan.name}`,
    `${plan.tagline} — ${plan.description}`,
  );

  const entry: PriceMap[string] = { product: product.id };

  if (plan.priceMonthly !== null) {
    // Mensal
    const monthlyPrice = await findOrCreatePrice(
      product.id,
      plan.priceMonthly * 100,
      'month',
      `zappiq_${planId.toLowerCase()}_monthly`,
    );
    entry.monthly = monthlyPrice.id;

    // Anual — cobrança do valor equivalente ao desconto anual × 12.
    const annualMonthly = getAnnualPrice(plan);
    if (annualMonthly !== null) {
      const annualPrice = await findOrCreatePrice(
        product.id,
        annualMonthly * 12 * 100,
        'year',
        `zappiq_${planId.toLowerCase()}_annual`,
      );
      entry.annual = annualPrice.id;
    }
  }

  return entry;
}

async function setupAddon(addon: AddonConfig): Promise<{ product: string; monthly?: string } | null> {
  // Só registra no Stripe add-ons com preço fixo recorrente.
  if (addon.priceMonthly === null) return null;

  console.log(`\n▼ Add-on ${addon.name} (${addon.id})`);

  const product = await findOrCreateProduct(
    `addon_${addon.id}`,
    `ZappIQ Add-on: ${addon.name}`,
    addon.description,
  );
  const price = await findOrCreatePrice(
    product.id,
    addon.priceMonthly * 100,
    'month',
    `zappiq_addon_${addon.id.toLowerCase()}_monthly`,
  );
  return { product: product.id, monthly: price.id };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log(' ZappIQ — Stripe Products & Prices Bootstrap');
  console.log('═══════════════════════════════════════════════════════');

  const planPrices: PriceMap = {};
  for (const planId of SELF_SERVE_PLANS) {
    planPrices[planId] = await setupPlan(planId);
  }

  const addonPrices: Record<string, { product: string; monthly?: string }> = {};
  for (const addon of Object.values(ADDONS)) {
    const result = await setupAddon(addon);
    if (result) addonPrices[addon.id] = result;
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(' ✅ Setup complete. Price IDs (copie para seu .env):');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log(JSON.stringify({ plans: planPrices, addons: addonPrices }, null, 2));

  console.log('\n  # Sugestão: adicione ao apps/api/.env:');
  console.log(`  STRIPE_PRICE_IDS='${JSON.stringify({ plans: planPrices, addons: addonPrices })}'\n`);
}

main().catch((err) => {
  console.error('✖ Setup failed:', err);
  process.exit(1);
});
