/**
 * criar-catalogo-v5 — cria no Stripe o catálogo v5 do plano Resposta Meta (20/08/2026).
 *
 * O que cria (idempotente por lookup_key; rodar 2x não duplica nada):
 *   1. Product novo "ZappIQ Essencial" (metadata zappiq_plan=ESSENCIAL)
 *      + prices mensal R$ 147,00 e anual R$ 1.411,20 (12 × 0,8, padrão da casa).
 *   2. Prices v5 para Lite, Growth e Scale SOB OS MESMOS Products atuais
 *      (nominais idênticos aos v4: 247/497/1.497 e anuais -20%). Motivo de não
 *      criar Products novos: descontos "forever" são escopados por Product;
 *      mover cliente de Product destruiria desconto contratual existente
 *      (parecer Stripe da validação S2).
 *   3. NADA de assinatura é tocado; nenhum cliente muda de price aqui.
 *      A grade nova só entra em vigor com o gate D4 aprovado (decisão D4).
 *
 * Uso (via .command, que injeta a chave sem passar pelo chat):
 *   STRIPE_SECRET_KEY=... npx tsx apps/api/scripts/stripe-v5/criar-catalogo-v5.ts [--aplicar]
 *   Sem --aplicar: dry-run, só mostra o que faria.
 *
 * Saída: tabela sem segredos + arquivo ./v5-catalogo.json (ids de product/price
 * para colar em packages/shared/src/planStripeIds.ts no mapa v5).
 */

import Stripe from 'stripe';
import { writeFileSync } from 'node:fs';

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('STRIPE_SECRET_KEY ausente no ambiente. Rode pelo .command.');
  process.exit(1);
}
if (!/^(sk|rk)_(live|test)_/.test(KEY)) {
  console.error('A chave não tem prefixo sk_/rk_ esperado. Abortando sem chamar a API.');
  process.exit(1);
}

const APLICAR = process.argv.includes('--aplicar');
const stripe = new Stripe(KEY);

// Nominais em centavos, iguais aos v4 (fonte: packages/shared/src/planConfig.ts).
const PLANOS: Array<{
  plan: 'ESSENCIAL' | 'IZA_LITE' | 'GROWTH' | 'SCALE';
  nome: string;
  mensalCents: number;
  anualCents: number; // mensal × 12 × 0,8
  novoProduct: boolean;
}> = [
  { plan: 'ESSENCIAL', nome: 'ZappIQ Essencial', mensalCents: 14700, anualCents: 141120, novoProduct: true },
  { plan: 'IZA_LITE', nome: 'ZappIQ Lite', mensalCents: 24700, anualCents: 237120, novoProduct: false },
  { plan: 'GROWTH', nome: 'ZappIQ Growth', mensalCents: 49700, anualCents: 477120, novoProduct: false },
  { plan: 'SCALE', nome: 'ZappIQ Scale', mensalCents: 149700, anualCents: 1437120, novoProduct: false },
];

const lookupKey = (plan: string, cycle: 'monthly' | 'annual') =>
  `zappiq_v5_${plan.toLowerCase()}_${cycle}`;

async function priceByLookup(key: string): Promise<Stripe.Price | null> {
  const found = await stripe.prices.list({ lookup_keys: [key], limit: 1 });
  return found.data[0] ?? null;
}

/** Product existente do plano: resolvido pelo price v4 ativo com o nominal do plano. */
async function productForExistingPlan(nome: string, mensalCents: number): Promise<string | null> {
  // Busca products ativos pelo nome (os 3 products v4 têm nomes estáveis no dashboard).
  const products = await stripe.products.search({ query: `active:'true' AND name~'${nome.replace("ZappIQ ", '')}'`, limit: 10 });
  for (const p of products.data) {
    const prices = await stripe.prices.list({ product: p.id, active: true, limit: 20 });
    if (prices.data.some((pr) => pr.unit_amount === mensalCents && pr.currency === 'brl' && pr.recurring?.interval === 'month')) {
      return p.id;
    }
  }
  return null;
}

async function main() {
  // Prova de acesso barata antes de criar qualquer coisa.
  const acct = await stripe.accounts.retrieve();
  console.log(`Conectado à conta ${acct.id} (${acct.settings?.dashboard?.display_name ?? 'sem nome'})${APLICAR ? '' : ' [DRY-RUN]'}`);

  const saida: Record<string, { productId: string; monthly: string; annual: string }> = {};

  for (const cfg of PLANOS) {
    let productId: string | null = null;

    if (cfg.novoProduct) {
      const jaExiste = await stripe.products.search({ query: `active:'true' AND metadata['zappiq_plan']:'${cfg.plan}'`, limit: 1 });
      if (jaExiste.data[0]) {
        productId = jaExiste.data[0].id;
        console.log(`Product ${cfg.nome}: já existe (${productId})`);
      } else if (APLICAR) {
        const p = await stripe.products.create({ name: cfg.nome, metadata: { zappiq_plan: cfg.plan, zappiq_catalog: 'v5' } });
        productId = p.id;
        console.log(`Product ${cfg.nome}: CRIADO (${productId})`);
      } else {
        console.log(`Product ${cfg.nome}: seria criado [dry-run]`);
        productId = 'prod_DRYRUN';
      }
    } else {
      productId = await productForExistingPlan(cfg.nome, cfg.mensalCents);
      if (!productId) {
        console.error(`NÃO ACHEI o Product existente de ${cfg.nome} pelo nominal ${cfg.mensalCents}. Pulei (verifique no dashboard e rode de novo).`);
        continue;
      }
      console.log(`Product ${cfg.nome}: existente (${productId})`);
    }

    const ids: { productId: string; monthly: string; annual: string } = { productId, monthly: '', annual: '' };

    for (const cycle of ['monthly', 'annual'] as const) {
      const lk = lookupKey(cfg.plan, cycle);
      const cents = cycle === 'monthly' ? cfg.mensalCents : cfg.anualCents;
      const existente = await priceByLookup(lk);
      if (existente) {
        ids[cycle] = existente.id;
        console.log(`  ${lk}: já existe (${existente.id})`);
        continue;
      }
      if (!APLICAR) {
        console.log(`  ${lk}: seria criado com R$ ${(cents / 100).toFixed(2)} [dry-run]`);
        ids[cycle] = 'price_DRYRUN';
        continue;
      }
      const price = await stripe.prices.create({
        product: productId,
        currency: 'brl',
        unit_amount: cents,
        recurring: { interval: cycle === 'monthly' ? 'month' : 'year' },
        lookup_key: lk,
        transfer_lookup_key: false,
        metadata: { zappiq_plan: cfg.plan, zappiq_catalog: 'v5', entitlement_version: 'v5' },
      });
      ids[cycle] = price.id;
      console.log(`  ${lk}: CRIADO (${price.id})`);
    }

    saida[cfg.plan] = ids;
  }

  writeFileSync('v5-catalogo.json', JSON.stringify(saida, null, 2));
  console.log('\nResumo gravado em v5-catalogo.json (ids não são segredo).');
  console.log('Próximo passo de código: colar os ids no mapa v5 de packages/shared/src/planStripeIds.ts (tarefa do loop de garantia).');
}

main().catch((e) => {
  console.error('Falhou:', e?.message ?? e);
  process.exit(1);
});
