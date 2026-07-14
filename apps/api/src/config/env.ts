import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Carrega .env do root do monorepo
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
// Fallback para .env local
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),

  // Database
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),

  // App URLs
  APP_URL: z.string().default('https://app.zappiq.com.br'),
  FRONTEND_URL: z.string().default('http://localhost:3003'),
  CORS_ORIGINS: z.string().default('http://localhost:3003,http://localhost:3000'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),

  // Google (V4 #V4-001 — Gemini 2.5 Flash via Generative Language API)
  GOOGLE_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  // Mira Prospects — busca pública (descoberta B2B + decisores por pegada
  // pública). Provedores pluggáveis, escolhidos por chave presente. Nenhum
  // é obrigatório: sem chave, os motores que dependem de busca respondem
  // "fonte_indisponivel" de forma honesta (o resto do Mira funciona).
  //   - Google Programmable Search (Custom Search JSON API): 100 buscas/dia
  //     grátis, SEM cartão. Recomendado. Precisa da chave + do ID do
  //     mecanismo (cx) criado em programmablesearchengine.google.com.
  //   - Brave Search API (2.000/mês grátis) e Firecrawl (pago) como upgrades.
  MIRA_SEARCH_PROVIDER: z.enum(['auto', 'google_cse', 'brave', 'firecrawl', 'off']).default('auto'),
  GOOGLE_CSE_KEY: z.string().optional(),
  GOOGLE_CSE_CX: z.string().optional(),
  BRAVE_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),

  // Mira Prospects — descoberta B2B via BigQuery (base de CNPJ da Base dos
  // Dados: basedosdados.br_me_cnpj.estabelecimentos). Fonte confiável que não
  // depende do servidor de download da Receita. Opcional: sem a service
  // account, a descoberta cai para índice local/busca. Custo protegido por
  // BIGQUERY_MAX_GB (teto de bytes por consulta; ver doc 10 do estudo).
  //   - GOOGLE_APPLICATION_CREDENTIALS_JSON: JSON da service account (secret)
  //   - BIGQUERY_PROJECT_ID: projeto de cobrança/consulta (ex.: zappiq-prod)
  GOOGLE_APPLICATION_CREDENTIALS_JSON: z.string().optional(),
  BIGQUERY_PROJECT_ID: z.string().optional(),
  BIGQUERY_MAX_GB: z.coerce.number().default(8), // teto duro de GB varridos por consulta na descoberta (tabela espelho, barata)
  // Espelho mensal da base de CNPJ. A tabela pública da Base dos Dados exige
  // assinatura BD Pro e cada consulta direta varre a partição inteira (~50-76 GB,
  // por causa da row access policy do BD Pro). Por isso materializamos 1x/mês só
  // as empresas ATIVAS numa tabela NOSSA (BIGQUERY_MIRROR_TABLE), corretamente
  // clusterizada, e a descoberta consulta ESSA tabela (fração de centavo). Ver doc 10.
  BIGQUERY_MIRROR_TABLE: z.string().default('mira.cnpj_ativos'),
  BIGQUERY_MIRROR_MAX_GB: z.coerce.number().default(120), // teto do job mensal de materialização (varre a partição inteira)

  // WhatsApp
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().default('zappiq-webhook-secret-2026'),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  // Meta App Secret — usado para verificar assinatura X-Hub-Signature-256 dos webhooks.
  // ATENCAO: e diferente do WHATSAPP_ACCESS_TOKEN. Pegar em
  // Meta for Developers > seu App > Settings > Basic > App Secret.
  META_APP_SECRET: z.string().optional(),

  // Embedded Signup (2026-05-20): App ID público da ZappIQ na Meta. Usado com
  // META_APP_SECRET pra trocar o `code` do popup por token (oauth/access_token).
  META_APP_ID: z.string().default('1603310040738671'),

  // FASE 4 (#251) Instagram Direct: verify token específico (opcional — fallback
  // pra WHATSAPP_WEBHOOK_VERIFY_TOKEN). Recomendado configurar dedicado pra
  // poder revogar IG independente do WhatsApp em caso de incidente.
  IG_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  // Google
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Quota Overage Mode (#147 — Onda 1.A)
  //   - audit_only (default): bloqueia em 100% (comportamento atual)
  //   - enforce: respeita settings.billing.autoOverage + hardCeilingBrl
  //              permite excedente quando opt-in + dispara Stripe meter_event
  // Flipar via: fly secrets set QUOTA_OVERAGE_MODE=enforce -a zappiq-api
  QUOTA_OVERAGE_MODE: z.enum(['audit_only', 'enforce']).default('audit_only'),

  // Camada 2 — enforcement de limite de RECURSOS COM ESTADO (contatos, fluxos,
  // docs, atendentes) por COUNT(*) real vs limite efetivo (plano + addons).
  //   - audit_only (default): NUNCA bloqueia, só loga quem estouraria (rollout
  //     seguro; nenhum cliente atual é travado de surpresa).
  //   - enforce: bloqueia a criação além do limite (429).
  // Flipar quando validado via: fly secrets set RESOURCE_LIMITS_MODE=enforce -a zappiq-api
  RESOURCE_LIMITS_MODE: z.enum(['audit_only', 'enforce']).default('audit_only'),

  // Frontend
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),

  // RAG Service
  RAG_SERVICE_URL: z.string().default('http://localhost:8001'),
  RAG_SERVICE_SECRET: z.string().optional(),
  // Piso de similaridade do retrieval (0..1). Abaixo disso o chunk não entra no prompt.
  RAG_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.25),

  // Agendamento — OAuth do Google Calendar (cada cliente conecta a agenda dele).
  // Um único app ZappIQ; muitos clientes autorizam a própria conta.
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().default('https://zappiq.com.br/api/integrations/google/callback'),

  // Email provider (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('ZappIQ <hello@zappiq.com.br>'),
  EMAIL_REPLY_TO: z.string().default('founders@zappiq.com.br'),

  // Sentry
  SENTRY_DSN: z.string().optional(),
  GIT_SHA: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('\u274c Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
}

export const env = validateEnv();
