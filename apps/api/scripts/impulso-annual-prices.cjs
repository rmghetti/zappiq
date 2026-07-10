/*
 * impulso-annual-prices.cjs — cria os preços ANUAIS (−20%) do Zap Impulso nos
 * produtos existentes e preenche os placeholders *_ANNUAL_PENDING em
 * packages/shared/src/addonStripeIds.ts. Anual = mensal × 12 × 0,8, cobrado 1x/ano.
 * Idempotente: reaproveita preço anual BRL existente com o valor certo.
 *
 * Uso: STRIPE_SECRET_KEY=sk_live_... node apps/api/scripts/impulso-annual-prices.cjs
 * (o .command passa a chave via env, sem ecoar). Chave NUNCA é impressa.
 */
const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

const key = process.env.STRIPE_SECRET_KEY;
if (!key || !key.startsWith('sk_')) { console.error('❌ STRIPE_SECRET_KEY ausente ou inválida.'); process.exit(1); }
const stripe = new Stripe(key);

// mensal (centavos) → anual = mensal*12*0.8 (centavos).
const ANNUAL = [
  { tier: 'IMPULSO_START', product: 'prod_Upxg7QwSAF4AwV', amount: Math.round(19700 * 12 * 0.8), placeholder: 'IMPULSO_START_ANNUAL_PENDING' },   // 189120 = R$ 1.891,20/ano
  { tier: 'IMPULSO_PRO', product: 'prod_Upxg2WAOdMB7NN', amount: Math.round(59700 * 12 * 0.8), placeholder: 'IMPULSO_PRO_ANNUAL_PENDING' },       // 573120 = R$ 5.731,20/ano
  { tier: 'IMPULSO_SCALE', product: 'prod_UpxguUhshUR7wM', amount: Math.round(129700 * 12 * 0.8), placeholder: 'IMPULSO_SCALE_ANNUAL_PENDING' },  // 1245120 = R$ 12.451,20/ano
];

const IDS_FILE = path.resolve(__dirname, '../../../packages/shared/src/addonStripeIds.ts');

(async () => {
  console.log('==> Modo:', key.startsWith('sk_live_') ? 'LIVE (produção)' : 'TESTE');
  const result = {};
  for (const r of ANNUAL) {
    const existing = await stripe.prices.list({ product: r.product, active: true, limit: 100 });
    let price = existing.data.find(
      (p) => p.unit_amount === r.amount && p.currency === 'brl' && p.recurring && p.recurring.interval === 'year',
    );
    if (price) {
      console.log(`   ${r.tier}: já existe preço anual ${price.id} (R$ ${(r.amount / 100).toFixed(2)}/ano) — reaproveitando.`);
    } else {
      price = await stripe.prices.create({
        product: r.product,
        currency: 'brl',
        unit_amount: r.amount,
        recurring: { interval: 'year' },
        nickname: `${r.tier} anual -20% (R$ ${(r.amount / 100).toFixed(2)}/ano)`,
      });
      console.log(`   ${r.tier}: CRIADO anual ${price.id} (R$ ${(r.amount / 100).toFixed(2)}/ano).`);
    }
    result[r.tier] = { priceId: price.id, placeholder: r.placeholder };
  }

  if (!fs.existsSync(IDS_FILE)) {
    console.error('⚠ addonStripeIds.ts não encontrado — atualize manualmente:', JSON.stringify(result, null, 2));
    process.exit(1);
  }
  let src = fs.readFileSync(IDS_FILE, 'utf8');
  let changed = 0;
  for (const t of Object.keys(result)) {
    const { priceId, placeholder } = result[t];
    if (src.includes(placeholder)) { src = src.split(placeholder).join(priceId); changed++; }
    else if (!src.includes(priceId)) { console.error(`⚠ placeholder ${placeholder} não encontrado e id novo ausente — verifique manualmente.`); }
  }
  fs.writeFileSync(IDS_FILE, src);
  console.log(`==> addonStripeIds.ts atualizado (${changed} preço(s) anual(is) preenchido(s)).`);
})().catch((e) => { console.error('❌ ERRO:', e.message); process.exit(1); });
