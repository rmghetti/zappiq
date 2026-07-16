-- Mira Prospects — Campanhas de prospecção (2026-07-15). ADITIVA e IDEMPOTENTE.
--
-- Cada disparo dos motores (mapear carteira / descobrir novos) vira uma
-- campanha NOMEADA: agrupa os Alvos criados e guarda parâmetros e resultado
-- para a gestão no hub. Alvos antigos ficam com campanhaId nulo, sem backfill.
-- Padrão da casa: enum via DO-guard, CREATE TABLE IF NOT EXISTS, RLS por
-- tenant em "organizationId" e GRANT condicional ao role app_user.

-- ─── Enum ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "MiraCampanhaStatus" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDA', 'FALHOU');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── Tabela ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "mira_campanhas" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "tipo" "MiraMotor" NOT NULL,
  "status" "MiraCampanhaStatus" NOT NULL DEFAULT 'EM_ANDAMENTO',
  "parametros" JSONB NOT NULL DEFAULT '{}',
  "resultado" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mira_campanhas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mira_campanhas_organizationId_createdAt_idx"
  ON "mira_campanhas"("organizationId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "mira_campanhas" ADD CONSTRAINT "mira_campanhas_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── Vínculo no Alvo ─────────────────────────────────────────────────────
ALTER TABLE "mira_alvos" ADD COLUMN IF NOT EXISTS "campanhaId" TEXT;
CREATE INDEX IF NOT EXISTS "mira_alvos_campanhaId_idx" ON "mira_alvos"("campanhaId");
DO $$ BEGIN
  ALTER TABLE "mira_alvos" ADD CONSTRAINT "mira_alvos_campanhaId_fkey"
    FOREIGN KEY ("campanhaId") REFERENCES "mira_campanhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── RLS por tenant (mesmo padrão das demais tabelas do Mira) ────────────
ALTER TABLE "mira_campanhas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mira_campanhas_tenant_isolation ON "mira_campanhas";
CREATE POLICY mira_campanhas_tenant_isolation ON "mira_campanhas"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

-- ─── GRANT condicional (prod baseline não tem app_user) ──────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "mira_campanhas" TO app_user;
  END IF;
END $$;
