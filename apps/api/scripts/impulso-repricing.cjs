/*
 * impulso-repricing.cjs — cria os NOVOS preços LIVE do Zap Impulso (Pro R$597,
 * Scale R$1.297) nos produtos existentes e atualiza packages/shared/src/addonStripeIds.ts.
 * Start segue R$197 (preço atual continua válido). Idempotente: se já existir um preço
 * mensal BRL com o valor certo, reaproveita em vez de duplicar.
 *
 * Uso: STRIPE_SECRET_KEY=sk_live_... node apps/api/scripts/impulso-repricing.cjs
 * (o .command passa a chave via env, sem ecoar). Chave NUNCA é impressa.
 */
const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

const key = process.env.STRIPE_SECRET_KEY;
if (!key || !key.startsWith('sk_')) {
  console.error('❌ STRIPE_SECRET_KEY ausente ou inválida.');
  process.exit(1);
}
const LIVE = key.startsWith('sk_live_');
const stripe = new Stripe(key);

// Produtos LIVE existentes + novos valores (em centavos, BRL). Start inalterado.
const REPRICE = [
  { tier: 'IMPULSO_PRO', product: 'prod_Upxg2WAOdMB7NN', amount: 59700, oldPriceId: 'price_1TqHl4Klp5SWv74XCR9JRVxk', oldLabel: 'R$ 497/mes', newLabel: 'R$ 597/mes' },
  { tier: 'IMPULSO_SCALE', product: 'prod_UpxguUhshUR7wM', amount: 129700, oldPriceId: 'price_1TqHl5Klp5SWv74X2yjIAWSs', oldLabel: 'R$ 997/mes', newLabel: 'R$ 1.297/mes' },
];

const IDS_FILE = path.resolve(__dirname, '../../../packages/shared/src/addonStripeIds.ts');

(async () => {
  console.log('==> Modo:', LIVE ? 'LIVE (produção)' : 'TESTE');
  const result = {};
  for (const r of REPRICE) {
    const existing = await stripe.prices.list({ product: r.product, active: true, limit: 100 });
    let price = existing.data.find(
      (p) => p.unit_amount === r.amount && p.currency === 'brl' && p.recurring && p.recurring.interval === 'month',
    );
    if (price) {
      console.log(`   ${r.tier}: já existe preço ${price.id} (${r.newLabel}) — reaproveitando.`);
    } else {
      price = await stripe.prices.create({
        product: r.product,
        currency: 'brl',
        unit_amount: r.amount,
        recurring: { interval: 'month' },
        nickname: `${r.tier} mensal — repricing 2026 (${r.newLabel})`,
      });
      console.log(`   ${r.tier}: CRIADO ${price.id} (${r.newLabel}).`);
    }
    result[r.tier] = { newPriceId: price.id, oldPriceId: r.oldPriceId, oldLabel: r.oldLabel, newLabel: r.newLabel };
  }

  // Atualiza addonStripeIds.ts por substituição literal (robusto contra churn de estrutura).
  if (!fs.existsSync(IDS_FILE)) {
    console.error('⚠ addonStripeIds.ts não encontrado em', IDS_FILE, '— atualize os IDs manualmente:');
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  let src = fs.readFileSync(IDS_FILE, 'utf8');
  let changed = 0;
  for (const t of Object.keys(result)) {
    const { newPriceId, oldPriceId, oldLabel, newLabel } = result[t];
    if (src.includes(oldPriceId)) { src = src.split(oldPriceId).join(newPriceId); changed++; }
    if (src.includes(oldLabel)) { src = src.split(oldLabel).join(newLabel); }
  }
  fs.writeFileSync(IDS_FILE, src);
  console.log(`==> addonStripeIds.ts atualizado (${changed} preço(s) trocado(s)).`);
  console.log('==> Resumo:', JSON.stringify(result, null, 2));
})().catch((e) => { console.error('❌ ERRO:', e.message); process.exit(1); });
