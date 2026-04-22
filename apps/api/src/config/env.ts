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
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),

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

  // Google
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Frontend
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),

  // RAG Service
  RAG_SERVICE_URL: z.string().default('http://localhost:8001'),
  RAG_SERVICE_SECRET: z.string().optional(),

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
