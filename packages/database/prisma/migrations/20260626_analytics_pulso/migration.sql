-- Analytics "Pulso" (Fase 2) — snapshot diário de métricas + insights narrados por org.
-- Aditivo e idempotente (CREATE IF NOT EXISTS). Segue o padrão de RLS + GRANT condicional
-- ao role app_user (prod Supabase baseline não tem esse role).

-- ─── 1) analytics_metric_daily ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "analytics_metric_daily" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "messagesIn" INTEGER NOT NULL DEFAULT 0,
  "messagesOut" INTEGER NOT NULL DEFAULT 0,
  "botMessages" INTEGER NOT NULL DEFAULT 0,
  "automationRate" INTEGER NOT NULL DEFAULT 0,
  "newContacts" INTEGER NOT NULL DEFAULT 0,
  "openConversations" INTEGER NOT NULL DEFAULT 0,
  "closedConversations" INTEGER NOT NULL DEFAULT 0,
  "avgFirstResponseMs" INTEGER,
  "csatAvg" DOUBLE PRECISION,
  "csatCount" INTEGER NOT NULL DEFAULT 0,
  "sentimentPos" INTEGER NOT NULL DEFAULT 0,
  "sentimentNeu" INTEGER NOT NULL DEFAULT 0,
  "sentimentNeg" INTEGER NOT NULL DEFAULT 0,
  "qualifiedLeads" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_metric_daily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_metric_daily_organizationId_date_key" ON "analytics_metric_daily"("organizationId","date");
CREATE INDEX IF NOT EXISTS "analytics_metric_daily_organizationId_date_idx" ON "analytics_metric_daily"("organizationId","date");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analytics_metric_daily_organizationId_fkey') THEN
    ALTER TABLE "analytics_metric_daily" ADD CONSTRAINT "analytics_metric_daily_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 2) analytics_insights ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "analytics_insights" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'daily_summary',
  "severity" TEXT NOT NULL DEFAULT 'info',
  "title" TEXT NOT NULL,
  "narrative" TEXT NOT NULL,
  "facts" JSONB NOT NULL DEFAULT '{}',
  "recommendedActions" JSONB NOT NULL DEFAULT '[]',
  "source" TEXT NOT NULL DEFAULT 'llm',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_insights_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "analytics_insights_organizationId_createdAt_idx" ON "analytics_insights"("organizationId","createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analytics_insights_organizationId_fkey') THEN
    ALTER TABLE "analytics_insights" ADD CONSTRAINT "analytics_insights_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── RLS + GRANTs — analytics_metric_daily ──────────────────────────────────
ALTER TABLE "analytics_metric_daily" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS analytics_metric_daily_tenant_isolation ON "analytics_metric_daily";
CREATE POLICY analytics_metric_daily_tenant_isolation ON "analytics_metric_daily"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

-- ─── RLS + GRANTs — analytics_insights ──────────────────────────────────────
ALTER TABLE "analytics_insights" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS analytics_insights_tenant_isolation ON "analytics_insights";
CREATE POLICY analytics_insights_tenant_isolation ON "analytics_insights"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

-- GRANT condicional: prod (Supabase baseline) não tem o role app_user;
-- em ambientes que o têm (dev/local RLS), o GRANT é aplicado normalmente.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "analytics_metric_daily" TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "analytics_insights" TO app_user;
  END IF;
END $$;
