-- Maestro 1B-analytics — contadores por nó/dia (funil/drop-off)
CREATE TABLE IF NOT EXISTS "flow_node_stats" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "nodeType" TEXT NOT NULL,
  "nodeLabel" TEXT,
  "period" TEXT NOT NULL,
  "entries" INTEGER NOT NULL DEFAULT 0,
  "ends" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "flow_node_stats_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "flow_node_stats_flowId_nodeId_period_key" ON "flow_node_stats"("flowId","nodeId","period");
CREATE INDEX IF NOT EXISTS "flow_node_stats_organizationId_flowId_idx" ON "flow_node_stats"("organizationId","flowId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flow_node_stats_flowId_fkey') THEN
    ALTER TABLE "flow_node_stats" ADD CONSTRAINT "flow_node_stats_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── RLS + GRANTs — flow_node_stats ─────────────────────────────────────────
ALTER TABLE "flow_node_stats" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flow_node_stats_tenant_isolation ON "flow_node_stats";
CREATE POLICY flow_node_stats_tenant_isolation ON "flow_node_stats"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

-- GRANT condicional: prod (Supabase baseline) não tem o role app_user;
-- em ambientes que o têm (dev/local RLS), o GRANT é aplicado normalmente.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "flow_node_stats" TO app_user;
  END IF;
END $$;
