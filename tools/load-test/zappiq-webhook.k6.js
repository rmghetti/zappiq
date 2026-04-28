/* ══════════════════════════════════════════════════════════════════════
 * V2-026 · Load test k6 — webhook WhatsApp (Sprint 0 Onda 3)
 * --------------------------------------------------------------------
 * Simula tráfego de webhook Meta WhatsApp pra validar o caminho real
 * de produção da Iza (com BullMQ ai-process).
 *
 * O QUE TESTA:
 *   - Webhook responde 200 em <300ms mesmo sob carga
 *   - HMAC SHA-256 validado corretamente em cada request
 *   - BullMQ ai-process não satura (queue depth p95 < 20)
 *   - Pipeline LLM aguenta 100 msg/s × 60s (target Plano §2.1 Blocker 2)
 *
 * ANTES DE RODAR:
 *   1. Instalar k6 (macOS): brew install k6
 *   2. Configurar variáveis de ambiente:
 *        export K6_TARGET_URL="https://zappiq-api.fly.dev"  # ou staging
 *        export K6_META_APP_SECRET="<segredo HMAC do Meta>"
 *        export K6_PHONE_NUMBER_ID="1134116473116268"       # Iza prod
 *        export K6_TEST_FROM="5511999999999"                # número fictício
 *
 *   IMPORTANTE: NÃO rodar contra prod com volume alto sem coordenar
 *   com CSM. Os webhooks vão criar contacts/conversations reais no DB
 *   da org cujo phoneNumberId corresponde ao Phone ID configurado.
 *   Recomendado: criar org TEST_LOAD no Supabase + phone fake.
 *
 * COMO RODAR:
 *   k6 run tools/load-test/zappiq-webhook.k6.js
 *
 * INTERPRETAR:
 *   - http_req_duration p95 < 300ms (200 ao Meta + sync DB writes)
 *   - http_req_failed rate < 1% (target Plano §8.3)
 *   - DURANTE o teste: `fly logs -a zappiq-api | grep "AI job enqueued"`
 *     deve mostrar ~100 logs/s
 *   - APÓS o teste: query Supabase pra checar fila completou:
 *       SELECT COUNT(*), AVG(latency_ms) FROM llm_call_logs
 *       WHERE created_at > NOW() - INTERVAL '5 minutes';
 *     Esperado: ~6000 chamadas LLM (100 msg/s × 60s) + avg latency 1-3s.
 * ══════════════════════════════════════════════════════════════════════ */

import http from 'k6/http';
import crypto from 'k6/crypto';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ─── Configuração ────────────────────────────────────────────────────
const TARGET_URL       = __ENV.K6_TARGET_URL       || 'https://zappiq-api.fly.dev';
const META_APP_SECRET  = __ENV.K6_META_APP_SECRET  || '';
const PHONE_NUMBER_ID  = __ENV.K6_PHONE_NUMBER_ID  || '1134116473116268';
const TEST_FROM_BASE   = __ENV.K6_TEST_FROM        || '5511999999999';
const TARGET_RPS       = parseInt(__ENV.K6_TARGET_RPS || '100', 10);
const DURATION_SECONDS = parseInt(__ENV.K6_DURATION_SECONDS || '60', 10);

if (!META_APP_SECRET) {
  throw new Error(
    'K6_META_APP_SECRET ausente. Configure: export K6_META_APP_SECRET="<segredo>"',
  );
}

// ─── Custom metrics ──────────────────────────────────────────────────
const enqueuedCounter = new Counter('zappiq_webhook_enqueued');
const hmacRejected    = new Counter('zappiq_webhook_hmac_rejected');
const webhookLatency  = new Trend('zappiq_webhook_latency_ms');

// ─── k6 stages ───────────────────────────────────────────────────────
// Constant arrival rate: target_rps por DURATION_SECONDS, sustained.
export const options = {
  scenarios: {
    constant_load: {
      executor: 'constant-arrival-rate',
      rate: TARGET_RPS,
      timeUnit: '1s',
      duration: `${DURATION_SECONDS}s`,
      preAllocatedVUs: Math.max(50, TARGET_RPS),
      maxVUs: TARGET_RPS * 4,
    },
  },
  thresholds: {
    // Critério Plano §2.1 Blocker 2: queue depth p95 < 20 medido externamente;
    // aqui medimos só o webhook (parte síncrona).
    'http_req_duration': ['p(95)<300', 'p(99)<800'],
    'http_req_failed':   ['rate<0.01'],
    'zappiq_webhook_hmac_rejected': ['count==0'],
  },
};

// ─── Payload helpers ─────────────────────────────────────────────────
function makeWebhookPayload(messageId, fromPhone, messageText) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: '2723969931308778',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '5511926160159',
            phone_number_id: PHONE_NUMBER_ID,
          },
          contacts: [{
            profile: { name: `LoadTest-${fromPhone.slice(-4)}` },
            wa_id: fromPhone,
          }],
          messages: [{
            from: fromPhone,
            id: messageId,
            timestamp: String(Math.floor(Date.now() / 1000)),
            text: { body: messageText },
            type: 'text',
          }],
        },
        field: 'messages',
      }],
    }],
  };
}

// HMAC SHA-256 do payload usando META_APP_SECRET (mesma lógica do
// verifyWhatsAppSignature em apps/api/src/routes/webhook.ts).
function signPayload(rawBody) {
  return 'sha256=' + crypto.hmac('sha256', META_APP_SECRET, rawBody, 'hex');
}

// Pool de mensagens de teste — variedade pra exercitar diferentes intents
const TEST_MESSAGES = [
  'Olá, gostaria de saber mais sobre os planos',
  'Quanto custa o plano Growth?',
  'Vocês atendem clínica de odontologia?',
  'Tem trial gratuito?',
  'Quero falar com um atendente',
  'Bom dia! Vi o anúncio de vocês',
  'Posso ver uma demonstração?',
  'Como funciona a integração com WhatsApp?',
  'Vocês cobram setup fee?',
  'Quero contratar agora',
];

// ─── Execução por VU iteration ───────────────────────────────────────
export default function () {
  // wamid único pra evitar dedup do BullMQ (jobId = "wamid:${id}")
  const messageId = `wamid.${uuidv4().replace(/-/g, '').toUpperCase()}`;

  // Telefone único por VU — evita criar UM contact congestionado
  const fromPhone = `${TEST_FROM_BASE.slice(0, -4)}${String(__VU).padStart(4, '0')}`;

  const messageText = TEST_MESSAGES[Math.floor(Math.random() * TEST_MESSAGES.length)];
  const payload = makeWebhookPayload(messageId, fromPhone, messageText);
  const rawBody = JSON.stringify(payload);
  const signature = signPayload(rawBody);

  const t0 = Date.now();
  const res = http.post(`${TARGET_URL}/api/webhook/whatsapp`, rawBody, {
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': signature,
      'User-Agent': 'k6-zappiq-load-test/V2-026',
    },
    timeout: '10s',
  });
  webhookLatency.add(Date.now() - t0);

  const ok200 = check(res, {
    'webhook 200': (r) => r.status === 200,
    'response time < 1s': (r) => r.timings.duration < 1000,
  });

  if (res.status === 200) {
    enqueuedCounter.add(1);
  } else if (res.status === 403) {
    hmacRejected.add(1);
  }

  if (!ok200) {
    console.warn(`[k6] webhook falhou: status=${res.status} body=${res.body}`);
  }
}

// ─── Setup/teardown ──────────────────────────────────────────────────
export function setup() {
  console.log('========================================');
  console.log(`Load test ZappIQ Webhook — V2-026`);
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Rate:   ${TARGET_RPS} req/s × ${DURATION_SECONDS}s`);
  console.log(`Total:  ${TARGET_RPS * DURATION_SECONDS} requests esperados`);
  console.log('========================================');
  console.log('');
  console.log('PRÉ-CHECK MANUAL ANTES DE PROSSEGUIR:');
  console.log('  1. fly status -a zappiq-api  → 2+ machines healthy');
  console.log('  2. Grafana dashboard aberto pra acompanhar em tempo real');
  console.log('  3. Coordenar com CSM (test contacts vão pro DB real)');
  console.log('');
  return {};
}

export function teardown() {
  console.log('');
  console.log('========================================');
  console.log('Load test concluído.');
  console.log('PRÓXIMOS PASSOS:');
  console.log('  1. Validar queue depth via /api/admin/llm-status');
  console.log('  2. SQL: SELECT COUNT(*) FROM llm_call_logs');
  console.log('          WHERE created_at > NOW() - INTERVAL \'5 minutes\'');
  console.log('  3. Cleanup: deletar contacts criados pelo teste');
  console.log('     DELETE FROM contacts WHERE name LIKE \'LoadTest-%\';');
  console.log('========================================');
}
