-- CRM sinérgico (Onda 0) — pipeline estruturado + timeline de atividades + tarefas
--
-- Cria PipelineStage (estágios por org), Activity (feed unificado da timeline) e
-- Task (próximos passos). Adiciona campos de CRM em deals/contacts (origem,
-- dono, desfecho). Backfill: semeia 7 estágios default para TODA org existente.
--
-- Tudo aditivo e reversível: colunas novas nullable; tabelas novas; o campo
-- legado deals.stage (texto) é mantido para back-compat.

-- ── Enums ────────────────────────────────────────────────────────
CREATE TYPE "ActivityType" AS ENUM (
  'CONTACT_CREATED','MESSAGE','STAGE_CHANGE','NOTE','TASK_CREATED','TASK_COMPLETED',
  'CAMPAIGN_EVENT','AI_SUMMARY','FIELD_UPDATE','LEAD_SCORE_CHANGE','DEAL_CREATED','DEAL_WON','DEAL_LOST'
);
CREATE TYPE "ActorType" AS ENUM ('HUMAN','AI','SYSTEM');
CREATE TYPE "TaskStatus" AS ENUM ('PENDING','DONE','CANCELLED');
CREATE TYPE "LossReason" AS ENUM ('PRICE','COMPETITOR','TIMING','NO_DECISION','NO_BUDGET','NO_RESPONSE','OTHER');

-- ── pipeline_stages ──────────────────────────────────────────────
CREATE TABLE "pipeline_stages" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "color" TEXT,
  "isWon" BOOLEAN NOT NULL DEFAULT false,
  "isLost" BOOLEAN NOT NULL DEFAULT false,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pipeline_stages_organizationId_idx" ON "pipeline_stages"("organizationId");
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── activities (timeline) ────────────────────────────────────────
CREATE TABLE "activities" (
  "id" TEXT NOT NULL,
  "type" "ActivityType" NOT NULL,
  "actor" "ActorType" NOT NULL DEFAULT 'SYSTEM',
  "actorUserId" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "metadata" JSONB,
  "contactId" TEXT,
  "dealId" TEXT,
  "conversationId" TEXT,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "activities_organizationId_idx" ON "activities"("organizationId");
CREATE INDEX "activities_contactId_idx" ON "activities"("contactId");
CREATE INDEX "activities_dealId_idx" ON "activities"("dealId");
CREATE INDEX "activities_conversationId_idx" ON "activities"("conversationId");
CREATE INDEX "activities_createdAt_idx" ON "activities"("createdAt");
ALTER TABLE "activities" ADD CONSTRAINT "activities_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── tasks ────────────────────────────────────────────────────────
CREATE TABLE "tasks" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
  "dueDate" TIMESTAMP(3),
  "assignedToId" TEXT,
  "completedAt" TIMESTAMP(3),
  "contactId" TEXT,
  "dealId" TEXT,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tasks_organizationId_idx" ON "tasks"("organizationId");
CREATE INDEX "tasks_contactId_idx" ON "tasks"("contactId");
CREATE INDEX "tasks_dealId_idx" ON "tasks"("dealId");
CREATE INDEX "tasks_status_idx" ON "tasks"("status");
CREATE INDEX "tasks_assignedToId_idx" ON "tasks"("assignedToId");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── deals: novos campos de CRM ───────────────────────────────────
ALTER TABLE "deals" ADD COLUMN "stageId" TEXT;
ALTER TABLE "deals" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "deals" ADD COLUMN "expectedCloseDate" TIMESTAMP(3);
ALTER TABLE "deals" ADD COLUMN "lossReason" "LossReason";
ALTER TABLE "deals" ADD COLUMN "sourceCampaignId" TEXT;
ALTER TABLE "deals" ADD COLUMN "sourceAgentId" TEXT;
ALTER TABLE "deals" ADD COLUMN "wonAt" TIMESTAMP(3);
ALTER TABLE "deals" ADD COLUMN "lostAt" TIMESTAMP(3);
CREATE INDEX "deals_stageId_idx" ON "deals"("stageId");
ALTER TABLE "deals" ADD CONSTRAINT "deals_stageId_fkey"
  FOREIGN KEY ("stageId") REFERENCES "pipeline_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── contacts: atribuição de origem ───────────────────────────────
ALTER TABLE "contacts" ADD COLUMN "sourceCampaignId" TEXT;
ALTER TABLE "contacts" ADD COLUMN "firstTouchAt" TIMESTAMP(3);
ALTER TABLE "contacts" ADD COLUMN "lastTouchAt" TIMESTAMP(3);

-- ── Backfill: 7 estágios default para TODA org existente ─────────
INSERT INTO "pipeline_stages" ("id","name","order","color","isWon","isLost","organizationId")
SELECT gen_random_uuid()::text, s.name, s.ord, s.color, s.iswon, s.islost, o.id
FROM "organizations" o
CROSS JOIN (VALUES
  ('Novo lead',   0, '#64748b', false, false),
  ('Contatado',   1, '#0ea5e9', false, false),
  ('Qualificado', 2, '#6366f1', false, false),
  ('Proposta',    3, '#f59e0b', false, false),
  ('Negociacao',  4, '#a855f7', false, false),
  ('Ganho',       5, '#22c55e', true,  false),
  ('Perdido',     6, '#ef4444', false, true)
) AS s(name, ord, color, iswon, islost);
