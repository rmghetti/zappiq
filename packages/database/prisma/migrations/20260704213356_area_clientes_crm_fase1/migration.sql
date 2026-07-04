-- Área "Clientes" (Superadmin) — Fase 1: estado canônico de conta + CRM de plataforma.
-- 100% ADITIVA e idempotente: CREATE TABLE novas + ADD COLUMN nullable.
-- NUNCA altera tipo de coluna existente, dropa coluna ou apaga dado.
-- Segue o padrão de RLS + GRANT condicional ao role app_user (prod Supabase
-- baseline não tem esse role) do 20260626_analytics_pulso/migration.sql.
--
-- ATENÇÃO: crm_accounts / crm_account_activity são entidades de PLATAFORMA
-- (1 linha por org/signup, geridas pelo Superadmin da ZappIQ). NÃO recebem
-- policy de isolamento por tenant (org_isolation) porque não pertencem ao
-- cliente — expor via RLS por tenant vazaria a base instalada da ZappIQ.
-- RLS é habilitado com policy restritiva (nega acesso ao role app_user
-- tenant-scoped); o acesso é feito pela conexão de serviço (owner/migrator).

-- ─── 1) ADD COLUMN nullable em organizations (ciclo de vida + Stripe) ────────
-- Tudo nullable / sem default destrutivo. Não altera colunas existentes.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "churnedAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "cardAddedAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "accountLifecycleStage" TEXT;

-- ─── 2) crm_accounts — espelho de conta (1 por org/signup) ───────────────────
CREATE TABLE IF NOT EXISTS "crm_accounts" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "signupId" TEXT,
  "email" TEXT NOT NULL,
  "company" TEXT,
  "cnpj" TEXT,
  "plan" TEXT,
  "lifecycleStage" TEXT NOT NULL DEFAULT 'NOVO',
  "ownerUserId" TEXT,
  "mrrCents" INTEGER NOT NULL DEFAULT 0,
  "healthScore" INTEGER,
  "trialEndsAt" TIMESTAMP(3),
  "lastActivityAt" TIMESTAMP(3),
  "pqlScore" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_accounts_pkey" PRIMARY KEY ("id")
);
-- organizationId é único quando presente (1 conta CRM por org). Índice único
-- parcial permite múltiplos NULL (signups ainda sem org).
CREATE UNIQUE INDEX IF NOT EXISTS "crm_accounts_organizationId_key"
  ON "crm_accounts"("organizationId") WHERE "organizationId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "crm_accounts_email_idx" ON "crm_accounts"("email");
CREATE INDEX IF NOT EXISTS "crm_accounts_lifecycleStage_idx" ON "crm_accounts"("lifecycleStage");
CREATE INDEX IF NOT EXISTS "crm_accounts_signupId_idx" ON "crm_accounts"("signupId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_accounts_organizationId_fkey') THEN
    ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 3) crm_account_activity — timeline da conta ─────────────────────────────
CREATE TABLE IF NOT EXISTS "crm_account_activity" (
  "id" TEXT NOT NULL,
  "crmAccountId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_account_activity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_account_activity_crmAccountId_createdAt_idx"
  ON "crm_account_activity"("crmAccountId","createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_account_activity_crmAccountId_fkey') THEN
    ALTER TABLE "crm_account_activity" ADD CONSTRAINT "crm_account_activity_crmAccountId_fkey"
      FOREIGN KEY ("crmAccountId") REFERENCES "crm_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── RLS — entidades de plataforma (NÃO isoladas por tenant) ─────────────────
-- Habilita RLS sem policy permissiva para app_user: garante que nenhuma
-- conexão tenant-scoped (que roda como app_user) leia/escreva a base instalada.
-- O acesso legítimo é feito pela role owner/serviço (BYPASSRLS ou dona da tabela).
ALTER TABLE "crm_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_account_activity" ENABLE ROW LEVEL SECURITY;

-- GRANT condicional: prod (Supabase baseline) não tem o role app_user.
-- Em ambientes que o têm, NÃO concedemos acesso ao app_user (tenant-scoped)
-- a estas tabelas de plataforma — só a leitura via role de serviço.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    REVOKE ALL ON "crm_accounts" FROM app_user;
    REVOKE ALL ON "crm_account_activity" FROM app_user;
  END IF;
END $$;
