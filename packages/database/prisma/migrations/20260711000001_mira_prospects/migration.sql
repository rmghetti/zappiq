-- Mira Prospects (2026-07-11) — ADITIVO e IDEMPOTENTE.
-- Add-on de inteligência e qualificação de oportunidades: Perfil (ICP),
-- Alvos + dossiê (decisores/demandas/oportunidades/incumbentes), Releases
-- semanais, ledger de cota e log de enriquecimento.
-- Padrão da casa: enums via DO-guard, CREATE TABLE IF NOT EXISTS, RLS por
-- tenant em "organizationId" (colunas camelCase, estilo deals/contacts) e
-- GRANT condicional ao role app_user (baseline prod não tem esse role).

-- ─── Enums ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "MiraAlvoStatus" AS ENUM ('DISCOVERED', 'QUALIFYING', 'READY', 'DELIVERED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "MiraAlvoKind" AS ENUM ('B2B', 'B2C');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "MiraMotor" AS ENUM ('BASE_INSTALADA', 'DESCOBERTA');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── Tabelas ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "mira_perfis" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "segmento" TEXT,
  "subsegmentos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "catalogo" JSONB NOT NULL DEFAULT '[]',
  "diferenciais" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "concorrentes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "icpFirmografia" JSONB NOT NULL DEFAULT '{}',
  "icpB2c" JSONB NOT NULL DEFAULT '{}',
  "areasCompradoras" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "modo" "MiraAlvoKind" NOT NULL DEFAULT 'B2B',
  "prontidao" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mira_perfis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mira_perfis_organizationId_key" ON "mira_perfis"("organizationId");

CREATE TABLE IF NOT EXISTS "mira_alvos" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "kind" "MiraAlvoKind" NOT NULL DEFAULT 'B2B',
  "motor" "MiraMotor" NOT NULL,
  "status" "MiraAlvoStatus" NOT NULL DEFAULT 'DISCOVERED',
  "nome" TEXT NOT NULL,
  "nomeFantasia" TEXT,
  "cnpj" TEXT,
  "cnae" TEXT,
  "porte" TEXT,
  "situacaoCadastral" TEXT,
  "municipio" TEXT,
  "uf" TEXT,
  "site" TEXT,
  "placeId" TEXT,
  "miraScore" INTEGER,
  "scoreBreakdown" JSONB,
  "confianca" INTEGER,
  "resumo" TEXT,
  "janelaEntrada" JSONB,
  "processoCompras" JSONB,
  "whiteSpace" JSONB,
  "contactId" TEXT,
  "dealId" TEXT,
  "countedInQuota" BOOLEAN NOT NULL DEFAULT false,
  "quotaMonth" TEXT,
  "custoCreditos" INTEGER NOT NULL DEFAULT 0,
  "fontes" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mira_alvos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mira_alvos_organizationId_cnpj_key" ON "mira_alvos"("organizationId", "cnpj");
CREATE INDEX IF NOT EXISTS "mira_alvos_organizationId_status_idx" ON "mira_alvos"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "mira_alvos_organizationId_miraScore_idx" ON "mira_alvos"("organizationId", "miraScore");
CREATE INDEX IF NOT EXISTS "mira_alvos_organizationId_quotaMonth_idx" ON "mira_alvos"("organizationId", "quotaMonth");

CREATE TABLE IF NOT EXISTS "mira_decisores" (
  "id" TEXT NOT NULL,
  "alvoId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "papel" TEXT NOT NULL,
  "arquetipo" TEXT,
  "senioridade" TEXT,
  "isChampion" BOOLEAN NOT NULL DEFAULT false,
  "vinculoQsa" BOOLEAN NOT NULL DEFAULT false,
  "contato" JSONB,
  "perfilPublico" JSONB,
  "fonte" TEXT,
  "baseLegal" TEXT NOT NULL DEFAULT 'legitimo_interesse',
  "lineage" JSONB NOT NULL DEFAULT '[]',
  "confianca" INTEGER NOT NULL DEFAULT 0,
  "contactId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mira_decisores_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mira_decisores_alvoId_idx" ON "mira_decisores"("alvoId");

CREATE TABLE IF NOT EXISTS "mira_demandas" (
  "id" TEXT NOT NULL,
  "alvoId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "descricao" TEXT NOT NULL,
  "evidencia" TEXT,
  "fonte" TEXT,
  "dataFonte" TIMESTAMP(3),
  "confianca" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mira_demandas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mira_demandas_alvoId_rank_idx" ON "mira_demandas"("alvoId", "rank");

CREATE TABLE IF NOT EXISTS "mira_oportunidades" (
  "id" TEXT NOT NULL,
  "alvoId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "produto" TEXT NOT NULL,
  "demandaRank" INTEGER,
  "racional" TEXT NOT NULL,
  "valorEstimado" DECIMAL(65,30),
  "roteiro" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mira_oportunidades_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mira_oportunidades_alvoId_rank_idx" ON "mira_oportunidades"("alvoId", "rank");

CREATE TABLE IF NOT EXISTS "mira_incumbentes" (
  "id" TEXT NOT NULL,
  "alvoId" TEXT NOT NULL,
  "fornecedor" TEXT NOT NULL,
  "categoria" TEXT,
  "evidencia" TEXT,
  "fonte" TEXT,
  "deslocabilidade" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mira_incumbentes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mira_incumbentes_alvoId_idx" ON "mira_incumbentes"("alvoId");

CREATE TABLE IF NOT EXISTS "mira_releases" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "alvoId" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "resumo" TEXT NOT NULL,
  "url" TEXT,
  "dataPublicacao" TIMESTAMP(3),
  "relevancia" TEXT NOT NULL,
  "anguloAbordagem" TEXT,
  "produtoRelacionado" TEXT,
  "confianca" INTEGER NOT NULL DEFAULT 0,
  "lida" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mira_releases_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mira_releases_organizationId_createdAt_idx" ON "mira_releases"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "mira_releases_alvoId_idx" ON "mira_releases"("alvoId");

CREATE TABLE IF NOT EXISTS "mira_usage_monthly" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "monthKey" TEXT NOT NULL,
  "used" INTEGER NOT NULL DEFAULT 0,
  "packExtra" INTEGER NOT NULL DEFAULT 0,
  "packPurchases" JSONB NOT NULL DEFAULT '[]',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mira_usage_monthly_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mira_usage_monthly_organizationId_monthKey_key" ON "mira_usage_monthly"("organizationId", "monthKey");

CREATE TABLE IF NOT EXISTS "mira_enriquecimento_log" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "alvoId" TEXT,
  "fonte" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "resultado" TEXT NOT NULL,
  "custoCreditos" INTEGER NOT NULL DEFAULT 0,
  "latenciaMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mira_enriquecimento_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mira_enriquecimento_log_organizationId_createdAt_idx" ON "mira_enriquecimento_log"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "mira_enriquecimento_log_fonte_resultado_idx" ON "mira_enriquecimento_log"("fonte", "resultado");

-- ─── Foreign keys (DO-guard: ADD CONSTRAINT não aceita IF NOT EXISTS) ───────
DO $$ BEGIN
  ALTER TABLE "mira_perfis" ADD CONSTRAINT "mira_perfis_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "mira_alvos" ADD CONSTRAINT "mira_alvos_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "mira_decisores" ADD CONSTRAINT "mira_decisores_alvoId_fkey"
    FOREIGN KEY ("alvoId") REFERENCES "mira_alvos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "mira_demandas" ADD CONSTRAINT "mira_demandas_alvoId_fkey"
    FOREIGN KEY ("alvoId") REFERENCES "mira_alvos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "mira_oportunidades" ADD CONSTRAINT "mira_oportunidades_alvoId_fkey"
    FOREIGN KEY ("alvoId") REFERENCES "mira_alvos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "mira_incumbentes" ADD CONSTRAINT "mira_incumbentes_alvoId_fkey"
    FOREIGN KEY ("alvoId") REFERENCES "mira_alvos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "mira_releases" ADD CONSTRAINT "mira_releases_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "mira_releases" ADD CONSTRAINT "mira_releases_alvoId_fkey"
    FOREIGN KEY ("alvoId") REFERENCES "mira_alvos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "mira_usage_monthly" ADD CONSTRAINT "mira_usage_monthly_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── RLS + policies de isolamento por tenant ────────────────────────────────
-- Tabelas com organizationId: policy direta. Filhas do Alvo (sem a coluna):
-- policy via EXISTS no pai (mesmo isolamento, um join).
ALTER TABLE "mira_perfis" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mira_perfis_tenant_isolation ON "mira_perfis";
CREATE POLICY mira_perfis_tenant_isolation ON "mira_perfis"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "mira_alvos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mira_alvos_tenant_isolation ON "mira_alvos";
CREATE POLICY mira_alvos_tenant_isolation ON "mira_alvos"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "mira_decisores" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mira_decisores_tenant_isolation ON "mira_decisores";
CREATE POLICY mira_decisores_tenant_isolation ON "mira_decisores"
  USING (EXISTS (SELECT 1 FROM "mira_alvos" a WHERE a."id" = "alvoId" AND a."organizationId" = current_setting('app.current_organization_id', true)))
  WITH CHECK (EXISTS (SELECT 1 FROM "mira_alvos" a WHERE a."id" = "alvoId" AND a."organizationId" = current_setting('app.current_organization_id', true)));

ALTER TABLE "mira_demandas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mira_demandas_tenant_isolation ON "mira_demandas";
CREATE POLICY mira_demandas_tenant_isolation ON "mira_demandas"
  USING (EXISTS (SELECT 1 FROM "mira_alvos" a WHERE a."id" = "alvoId" AND a."organizationId" = current_setting('app.current_organization_id', true)))
  WITH CHECK (EXISTS (SELECT 1 FROM "mira_alvos" a WHERE a."id" = "alvoId" AND a."organizationId" = current_setting('app.current_organization_id', true)));

ALTER TABLE "mira_oportunidades" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mira_oportunidades_tenant_isolation ON "mira_oportunidades";
CREATE POLICY mira_oportunidades_tenant_isolation ON "mira_oportunidades"
  USING (EXISTS (SELECT 1 FROM "mira_alvos" a WHERE a."id" = "alvoId" AND a."organizationId" = current_setting('app.current_organization_id', true)))
  WITH CHECK (EXISTS (SELECT 1 FROM "mira_alvos" a WHERE a."id" = "alvoId" AND a."organizationId" = current_setting('app.current_organization_id', true)));

ALTER TABLE "mira_incumbentes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mira_incumbentes_tenant_isolation ON "mira_incumbentes";
CREATE POLICY mira_incumbentes_tenant_isolation ON "mira_incumbentes"
  USING (EXISTS (SELECT 1 FROM "mira_alvos" a WHERE a."id" = "alvoId" AND a."organizationId" = current_setting('app.current_organization_id', true)))
  WITH CHECK (EXISTS (SELECT 1 FROM "mira_alvos" a WHERE a."id" = "alvoId" AND a."organizationId" = current_setting('app.current_organization_id', true)));

ALTER TABLE "mira_releases" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mira_releases_tenant_isolation ON "mira_releases";
CREATE POLICY mira_releases_tenant_isolation ON "mira_releases"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "mira_usage_monthly" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mira_usage_monthly_tenant_isolation ON "mira_usage_monthly";
CREATE POLICY mira_usage_monthly_tenant_isolation ON "mira_usage_monthly"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "mira_enriquecimento_log" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mira_enriquecimento_log_tenant_isolation ON "mira_enriquecimento_log";
CREATE POLICY mira_enriquecimento_log_tenant_isolation ON "mira_enriquecimento_log"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

-- ─── GRANT condicional (prod baseline não tem app_user) ─────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "mira_perfis" TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "mira_alvos" TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "mira_decisores" TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "mira_demandas" TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "mira_oportunidades" TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "mira_incumbentes" TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "mira_releases" TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "mira_usage_monthly" TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "mira_enriquecimento_log" TO app_user;
  END IF;
END $$;
