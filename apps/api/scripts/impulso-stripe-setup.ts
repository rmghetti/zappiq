/*
 * Impulso — cria os produtos/preços do add-on de campanhas no Stripe.
 * AUTO-CONTIDO de propósito: vive em apps/api (onde `stripe` resolve) e NÃO
 * importa @zappiq/shared (evita depender do dist rebuildado). Os 3 tiers estão
 * inline; se mudar o preço no planConfig.ts, atualize aqui também.
 *
 * Uso (o .command comandos/impulso-2-stripe-setup.command faz isto):
 *   export STRIPE_SECRET_KEY=sk_test_...   # ou sk_live_...
 *   apps/api/node_modules/.bin/tsx apps/api/scripts/impulso-stripe-setup.ts
 *
 * Idempotente: procura produto por metadata.addon_key antes de criar.
 */
import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('✖ STRIPE_SECRET_KEY é obrigatória (export STRIPE_SECRET_KEY=sk_test_...).');
  process.exit(1);
}
const stripe = new Stripe(KEY);

const IMPULSO_TIERS = [
  { key: 'IMPULSO_START', name: 'Impulso Start — campanhas com a Iza', amountBrl: 197 },
  { key: 'IMPULSO_PRO', name: 'Impulso Pro — campanhas + loop de anúncios', amountBrl: 497 },
  { key: 'IMPULSO_SCALE', name: 'Impulso Scale — performance sem limite', amountBrl: 997 },
];

async function findOrCreateProduct(key: string, name: string): Promise<Stripe.Product> {
  const found = await stripe.products.search({
    query: `metadata['addon_key']:'${key}' AND active:'true'`,
  });
  if (found.data.length > 0) {
    console.log(`  ✓ produto já existe: ${key} (${found.data[0].id})`);
    return found.data[0];
  }
  const p = await stripe.products.create({
    name,
    metadata: { addon_key: key, source: 'zappiq-impulso' },
  });
  console.log(`  + produto criado: ${key} (${p.id})`);
  return p;
}

async function findOrCreatePrice(productId: string, cents: number, key: string): Promise<Stripe.Price> {
  const list = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const match = list.data.find(
    (p) => p.unit_amount === cents && p.recurring?.interval === 'month' && p.currency === 'brl',
  );
  if (match) {
    console.log(`    ✓ preço já existe: ${key} (${match.id})`);
    return match;
  }
  const lookup = `zappiq_addon_${key.toLowerCase()}_monthly`;
  const price = await stripe.prices.create({
    product: productId,
    currency: 'brl',
    unit_amount: cents,
    recurring: { interval: 'month' },
    lookup_key: lookup,
    metadata: { lookup_key: lookup },
  });
  console.log(`    + preço criado: ${key} (${price.id}) = R$ ${(cents / 100).toFixed(2)}/mês`);
  return price;
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════');
  console.log(' ZappIQ Impulso — Stripe Products & Prices');
  console.log('═══════════════════════════════════════════════');
  const out: Record<string, { product: string; monthly: string }> = {};
  for (const tier of IMPULSO_TIERS) {
    console.log(`\n▼ ${tier.name} (${tier.key})`);
    const product = await findOrCreateProduct(tier.key, `ZappIQ ${tier.name}`);
    const price = await findOrCreatePrice(product.id, Math.round(tier.amountBrl * 100), tier.key);
    out[tier.key] = { product: product.id, monthly: price.id };
  }
  console.log('\n═══════════════════════════════════════════════');
  console.log(' ✅ Pronto. Price IDs do Impulso (copie/guarde):');
  console.log('═══════════════════════════════════════════════\n');
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error('✖ Falhou:', err instanceof Error ? err.message : err);
  process.exit(1);
});
