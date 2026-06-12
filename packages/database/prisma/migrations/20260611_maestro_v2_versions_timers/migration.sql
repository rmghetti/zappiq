ALTER TABLE "flows" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "flow_versions" (
  "id" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "nodes" JSONB NOT NULL,
  "edges" JSONB NOT NULL,
  "triggerType" "FlowTriggerType" NOT NULL,
  "triggerConfig" JSONB,
  "source" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "flow_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "flow_versions_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "flow_versions_flowId_version_key" ON "flow_versions"("flowId", "version");
CREATE INDEX IF NOT EXISTS "flow_versions_organizationId_idx" ON "flow_versions"("organizationId");

CREATE TABLE IF NOT EXISTS "flow_timers" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "flowVersion" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "resumeNodeId" TEXT NOT NULL,
  "stateSnapshot" JSONB NOT NULL,
  "runAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "statusReason" TEXT,
  "jobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "firedAt" TIMESTAMP(3),
  CONSTRAINT "flow_timers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "flow_timers_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "flow_timers_status_runAt_idx" ON "flow_timers"("status", "runAt");
CREATE INDEX IF NOT EXISTS "flow_timers_organizationId_conversationId_status_idx" ON "flow_timers"("organizationId", "conversationId", "status");

-- ─── RLS + GRANTs — flow_versions ────────────────────────────────────────────
ALTER TABLE "flow_versions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flow_versions_tenant_isolation ON "flow_versions";
CREATE POLICY flow_versions_tenant_isolation ON "flow_versions"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "flow_versions" TO app_user;

-- ─── RLS + GRANTs — flow_timers ──────────────────────────────────────────────
ALTER TABLE "flow_timers" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flow_timers_tenant_isolation ON "flow_timers";
CREATE POLICY flow_timers_tenant_isolation ON "flow_timers"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "flow_timers" TO app_user;
