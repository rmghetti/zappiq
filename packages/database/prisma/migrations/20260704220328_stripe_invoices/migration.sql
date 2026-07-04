-- Área "Clientes" (Superadmin) — Fase 3: financeiro real / persistência de faturas Stripe.
-- 100% ADITIVA e idempotente: CREATE TABLE novas. NUNCA altera tipo de coluna
-- existente, dropa coluna ou apaga dado.
--
-- Segue o padrão de RLS + GRANT condicional ao role app_user (prod Supabase
-- baseline não tem esse role) do 20260626_analytics_pulso/migration.sql, mas
-- como estas são tabelas de PLATAFORMA (faturamento da ZappIQ, geridas pelo
-- Superadmin — NÃO pertencem ao cliente), seguem o mesmo tratamento das
-- crm_accounts (Fase 1): RLS habilitado sem policy permissiva para app_user
-- + REVOKE do app_user tenant-scoped. O acesso legítimo é pela role de serviço.

-- ─── 1) stripe_invoices — faturas pagas/emitidas persistidas pelo webhook ─────
-- amountBrlCents: valor da fatura em centavos de BRL (amount_paid do Stripe).
-- stripeInvoiceId: único → idempotência natural de invoice.paid/succeeded.
CREATE TABLE IF NOT EXISTS "stripe_invoices" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "stripeInvoiceId" TEXT NOT NULL,
  "amountBrlCents" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stripe_invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "stripe_invoices_stripeInvoiceId_key"
  ON "stripe_invoices"("stripeInvoiceId");
CREATE INDEX IF NOT EXISTS "stripe_invoices_organizationId_paidAt_idx"
  ON "stripe_invoices"("organizationId","paidAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stripe_invoices_organizationId_fkey') THEN
    ALTER TABLE "stripe_invoices" ADD CONSTRAINT "stripe_invoices_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 2) stripe_webhook_events — idempotência por event id ─────────────────────
-- Garante que cada evento do Stripe seja processado uma única vez (Stripe pode
-- reentregar o mesmo evento). O id do evento (evt_...) é a PK; a presença da
-- linha significa "já processado". Aditiva, low-risk.
CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- ─── RLS — entidades de plataforma (NÃO isoladas por tenant) ─────────────────
-- Mesmo tratamento das crm_accounts (Fase 1): habilita RLS sem policy
-- permissiva para app_user, garantindo que nenhuma conexão tenant-scoped leia
-- o faturamento da ZappIQ. Acesso legítimo pela role owner/serviço.
ALTER TABLE "stripe_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stripe_webhook_events" ENABLE ROW LEVEL SECURITY;

-- GRANT condicional: prod (Supabase baseline) não tem o role app_user.
-- Em ambientes que o têm, NÃO concedemos acesso ao app_user (tenant-scoped)
-- a estas tabelas de plataforma — só a leitura via role de serviço.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    REVOKE ALL ON "stripe_invoices" FROM app_user;
    REVOKE ALL ON "stripe_webhook_events" FROM app_user;
  END IF;
END $$;
