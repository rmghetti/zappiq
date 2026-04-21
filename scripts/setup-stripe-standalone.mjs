#!/usr/bin/env node
/**
 * ZappIQ — Stripe Products & Prices Bootstrap (standalone, no deps)
 * Uses Node.js native https to call Stripe REST API directly.
 */
import https from 'https';
import { URL, URLSearchParams } from 'url';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) {
  console.error('✖ STRIPE_SECRET_KEY env var is required.');
  process.exit(1);
}

// ── Plan definitions ──
const PLANS = [
  { id: 'STARTER',  name: 'Starter',  priceMonthly: 247,  annualDiscount: 0.20, tagline: 'Para começar a automatizar', description: 'Profissionais liberais, solopreneurs e micro-operações validando o canal WhatsApp com IA.' },
  { id: 'GROWTH',   name: 'Growth',   priceMonthly: 797,  annualDiscount: 0.20, tagline: 'Para equipes em crescimento', description: 'PMEs com equipe de atendimento, pipeline de leads ativo e necessidade de integrações.' },
  { id: 'SCALE',    name: 'Scale',    priceMonthly: 1697, annualDiscount: 0.20, tagline: 'Para operações em escala', description: 'Redes, franquias e operações multi-time com volume alto e exigência de uptime.' },
  { id: 'BUSINESS', name: 'Business', priceMonthly: 3997, annualDiscount: 0.15, tagline: 'Para operações críticas com SLA formal', description: 'Operações de missão crítica que precisam de SLA contratual, observabilidade avançada e governança LGPD madura.' },
];

const ADDONS = [
  { id: 'RADAR_360',            name: 'Radar 360° Observabilidade',      priceMonthly: 397,  description: 'Observabilidade avançada com dashboards, alertas e métricas em tempo real.' },
  { id: 'EXTRA_WHATSAPP_NUMBER', name: 'Número WhatsApp adicional',      priceMonthly: 147,  description: 'Número WhatsApp Business adicional para sua operação.' },
  { id: 'EXTRA_AI_MESSAGES',    name: 'Pacote 10k mensagens IA extras',  priceMonthly: 197,  description: 'Pacote de 10.000 mensagens IA extras por mês.' },
  { id: 'EXTRA_BROADCASTS',     name: 'Pacote 10k disparos extras',      priceMonthly: 247,  description: 'Pacote de 10.000 disparos de broadcast extras por mês.' },
  { id: 'EXTRA_AGENT_SEAT',     name: 'Seat adicional de atendente',     priceMonthly: 89,   description: 'Seat adicional para atendente humano.' },
  { id: 'DEDICATED_INFRA',      name: 'Infraestrutura isolada (pool dedicado)', priceMonthly: 2200, description: 'Pool de infraestrutura dedicado e isolado.' },
  { id: 'SOC_NOC_24X7',         name: 'SOC / NOC dedicado 24/7',         priceMonthly: 3800, description: 'Centro de operações de segurança e rede dedicado 24/7.' },
  { id: 'EXTENDED_LOG_RETENTION', name: 'Retenção estendida de logs (5 anos)', priceMonthly: 490, description: 'Retenção de logs estendida para 5 anos.' },
];

// ── Stripe API helper ──
function stripeRequest(method, path, params) {
  return new Promise((resolve, reject) => {
    const body = params ? new URLSearchParams(flattenParams(params)).toString() : '';
    const options = {
      hostname: 'api.stripe.com',
      port: 443,
      path: `/v1${path}`,
      method,
      headers: {
        'Authorization': `Bearer ${STRIPE_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) reject(new Error(`Stripe ${json.error.type}: ${json.error.message}`));
          else resolve(json);
        } catch (e) { reject(new Error(`Parse error: ${data.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function flattenParams(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenParams(value, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

// ── Idempotent helpers ──
async function findOrCreateProduct(planId, name, description) {
  const search = await stripeRequest('GET', `/products/search?query=metadata['plan_id']:'${planId}'+AND+active:'true'`);
  if (search.data && search.data.length > 0) {
    console.log(`  ✓ product exists: ${planId} (${search.data[0].id})`);
    return search.data[0];
  }
  const p = await stripeRequest('POST', '/products', {
    name,
    description,
    metadata: { plan_id: planId, source: 'zappiq-setup' },
  });
  console.log(`  + product created: ${planId} (${p.id})`);
  return p;
}

async function findOrCreatePrice(productId, amountCents, interval, lookupKey) {
  const list = await stripeRequest('GET', `/prices?product=${productId}&active=true&limit=100`);
  const match = list.data?.find(
    (p) => p.unit_amount === amountCents && p.recurring?.interval === interval && p.currency === 'brl'
  );
  if (match) {
    console.log(`    ✓ price exists: ${lookupKey} (${match.id})`);
    return match;
  }
  const price = await stripeRequest('POST', '/prices', {
    product: productId,
    currency: 'brl',
    unit_amount: String(amountCents),
    recurring: { interval },
    lookup_key: lookupKey,
    metadata: { lookup_key: lookupKey },
  });
  console.log(`    + price created: ${lookupKey} (${price.id}) = R$ ${(amountCents / 100).toFixed(2)}/${interval}`);
  return price;
}

// ── Main ──
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log(' ZappIQ — Stripe Products & Prices Bootstrap');
  console.log('═══════════════════════════════════════════════════════');

  const planPrices = {};

  for (const plan of PLANS) {
    console.log(`\n▼ Plan ${plan.name} (${plan.id})`);
    const product = await findOrCreateProduct(plan.id, `ZappIQ ${plan.name}`, `${plan.tagline} — ${plan.description}`);
    const entry = { product: product.id };

    // Monthly
    const monthly = await findOrCreatePrice(product.id, plan.priceMonthly * 100, 'month', `zappiq_${plan.id.toLowerCase()}_monthly`);
    entry.monthly = monthly.id;

    // Annual (monthly × 12 × (1 - discount))
    const annualMonthly = Math.round(plan.priceMonthly * (1 - plan.annualDiscount));
    const annualTotal = annualMonthly * 12;
    const annual = await findOrCreatePrice(product.id, annualTotal * 100, 'year', `zappiq_${plan.id.toLowerCase()}_annual`);
    entry.annual = annual.id;

    planPrices[plan.id] = entry;
  }

  const addonPrices = {};

  for (const addon of ADDONS) {
    console.log(`\n▼ Add-on ${addon.name} (${addon.id})`);
    const product = await findOrCreateProduct(`addon_${addon.id}`, `ZappIQ Add-on: ${addon.name}`, addon.description);
    const price = await findOrCreatePrice(product.id, addon.priceMonthly * 100, 'month', `zappiq_addon_${addon.id.toLowerCase()}_monthly`);
    addonPrices[addon.id] = { product: product.id, monthly: price.id };
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(' ✅ Setup complete. Price IDs:');
  console.log('═══════════════════════════════════════════════════════\n');

  const result = { plans: planPrices, addons: addonPrices };
  console.log(JSON.stringify(result, null, 2));

  console.log('\n  # Sugestão: adicione ao apps/api/.env:');
  console.log(`  STRIPE_PRICE_IDS='${JSON.stringify(result)}'`);
}

main().catch((err) => {
  console.error('✖ Setup failed:', err);
  process.exit(1);
});
