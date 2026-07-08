// Read-only: lista cupons e promotion codes do Stripe live e mostra se são
// RESTRITOS a produto (applies_to.products) — o que impede o cupom de vazar
// para outros itens (plano/addon) no mesmo checkout. NÃO cria/altera nada.
import Stripe from 'stripe';
import fs from 'node:fs';
const ENV_PATH =
  '/Users/rodrigoghetti/Documents/Documentos - MacBook Air de Rodrigo/Pessoal/ZappIQ/PROJETO ZAPPIQ 2026/zappiq/apps/api/.env';
const key = (fs.readFileSync(ENV_PATH, 'utf8').match(/STRIPE_SECRET_KEY=(.+)/) || [])[1]?.trim();
const stripe = new Stripe(key);

console.log('=== COUPONS ===');
const coupons = await stripe.coupons.list({ limit: 100 });
for (const c of coupons.data) {
  const scope = c.applies_to?.products?.length
    ? `RESTRITO a ${c.applies_to.products.length} produto(s): ${c.applies_to.products.join(',')}`
    : 'SEM RESTRICAO (aplica a fatura inteira!)';
  const off = c.percent_off ? `${c.percent_off}% off` : `R$ ${(c.amount_off ?? 0) / 100} off`;
  console.log(`- ${c.id} | ${c.name ?? ''} | ${off} | ${c.duration} | valid=${c.valid} | ${scope}`);
}
console.log(`\ntotal coupons: ${coupons.data.length}`);

console.log('\n=== PROMOTION CODES ===');
const promos = await stripe.promotionCodes.list({ limit: 100 });
for (const p of promos.data) {
  console.log(
    `- code="${p.code}" | coupon=${p.coupon.id} | active=${p.active} | restr.products=${p.restrictions?.currency_options ? 'currency-opts' : (p.coupon.applies_to?.products?.join(',') ?? 'nenhuma')}`,
  );
}
console.log(`\ntotal promo codes: ${promos.data.length}`);
