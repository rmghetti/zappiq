-- Impulso (add-on de campanhas premium, 2026-07-06) — ADITIVO e IDEMPOTENTE.
-- Estende `campaigns` + cria 4 tabelas de suporte (variantes/bandit, funil por nó,
-- atribuição com BSUID/ctwa_clid, consentimento LGPD). Segue o padrão de RLS +
-- GRANT condicional ao role app_user (prod Supabase baseline não tem esse role).
-- SQL do DDL derivado de `prisma migrate diff` (offline, sem shadow DB).

-- ─── campaigns: colunas Impulso (aditivas) ──────────────────────────────────
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "isImpulso" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "objective" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "channels" JSONB;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "autonomyLevel" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "journey" JSONB;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "audienceSegment" JSONB;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "budgetPlan" JSONB;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "optimization" JSONB;
CREATE INDEX IF NOT EXISTS "campaigns_organizationId_isImpulso_idx" ON "campaigns"("organizationId", "isImpulso");

-- ─── campaign_variants (braços de bandit) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "campaign_variants" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaign_variants_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "campaign_variants_campaignId_idx" ON "campaign_variants"("campaignId");
CREATE INDEX IF NOT EXISTS "campaign_variants_organizationId_idx" ON "campaign_variants"("organizationId");

-- ─── campaign_node_stats (funil por nó da jornada) ──────────────────────────
CREATE TABLE IF NOT EXISTS "campaign_node_stats" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "nodeLabel" TEXT,
    "period" TEXT NOT NULL,
    "entries" INTEGER NOT NULL DEFAULT 0,
    "ends" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaign_node_stats_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "campaign_node_stats_organizationId_campaignId_idx" ON "campaign_node_stats"("organizationId", "campaignId");
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_node_stats_campaignId_nodeId_period_key" ON "campaign_node_stats"("campaignId", "nodeId", "period");

-- ─── campaign_attributions (ad -> conversa -> venda; BSUID/ctwa_clid) ────────
CREATE TABLE IF NOT EXISTS "campaign_attributions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT,
    "contactId" TEXT,
    "source" TEXT NOT NULL,
    "ctwaClid" TEXT,
    "bsuid" TEXT,
    "metaCampaignId" TEXT,
    "adId" TEXT,
    "fepWindowEndsAt" TIMESTAMP(3),
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "convertedAt" TIMESTAMP(3),
    "capiSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaign_attributions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "campaign_attributions_organizationId_campaignId_idx" ON "campaign_attributions"("organizationId", "campaignId");
CREATE INDEX IF NOT EXISTS "campaign_attributions_bsuid_idx" ON "campaign_attributions"("bsuid");
CREATE INDEX IF NOT EXISTS "campaign_attributions_ctwaClid_idx" ON "campaign_attributions"("ctwaClid");

-- ─── campaign_consents (trilha LGPD por contato/campanha) ────────────────────
CREATE TABLE IF NOT EXISTS "campaign_consents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT,
    "contactId" TEXT NOT NULL,
    "legalBasis" "LegalBasis" NOT NULL DEFAULT 'CONSENT',
    "optIn" BOOLEAN NOT NULL DEFAULT false,
    "optInAt" TIMESTAMP(3),
    "optOutAt" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_consents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "campaign_consents_organizationId_contactId_idx" ON "campaign_consents"("organizationId", "contactId");

-- ─── Foreign keys (idempotentes) ────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_variants_campaignId_fkey') THEN
    ALTER TABLE "campaign_variants" ADD CONSTRAINT "campaign_variants_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_variants_organizationId_fkey') THEN
    ALTER TABLE "campaign_variants" ADD CONSTRAINT "campaign_variants_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_node_stats_organizationId_fkey') THEN
    ALTER TABLE "campaign_node_stats" ADD CONSTRAINT "campaign_node_stats_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_node_stats_campaignId_fkey') THEN
    ALTER TABLE "campaign_node_stats" ADD CONSTRAINT "campaign_node_stats_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_attributions_organizationId_fkey') THEN
    ALTER TABLE "campaign_attributions" ADD CONSTRAINT "campaign_attributions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_attributions_campaignId_fkey') THEN
    ALTER TABLE "campaign_attributions" ADD CONSTRAINT "campaign_attributions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_consents_organizationId_fkey') THEN
    ALTER TABLE "campaign_consents" ADD CONSTRAINT "campaign_consents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_consents_campaignId_fkey') THEN
    ALTER TABLE "campaign_consents" ADD CONSTRAINT "campaign_consents_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── RLS + policies de isolamento por tenant (4 tabelas novas) ───────────────
ALTER TABLE "campaign_variants" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_variants_tenant_isolation ON "campaign_variants";
CREATE POLICY campaign_variants_tenant_isolation ON "campaign_variants"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "campaign_node_stats" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_node_stats_tenant_isolation ON "campaign_node_stats";
CREATE POLICY campaign_node_stats_tenant_isolation ON "campaign_node_stats"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "campaign_attributions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_attributions_tenant_isolation ON "campaign_attributions";
CREATE POLICY campaign_attributions_tenant_isolation ON "campaign_attributions"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "campaign_consents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_consents_tenant_isolation ON "campaign_consents";
CREATE POLICY campaign_consents_tenant_isolation ON "campaign_consents"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

-- GRANT condicional: prod (Supabase baseline) não tem o role app_user;
-- em ambientes que o têm (dev/local RLS), o GRANT é aplicado normalmente.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "campaign_variants" TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "campaign_node_stats" TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "campaign_attributions" TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "campaign_consents" TO app_user;
  END IF;
END $$;
