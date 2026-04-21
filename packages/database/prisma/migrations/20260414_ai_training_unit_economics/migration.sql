-- ═════════════════════════════════════════════════════════════════
-- Migration 20260414 — AI Training self-service + Unit Economics (H10)
-- ─────────────────────────────────────────────────────────────────
-- Objetivo:
--   1. Colunas de trial + gestão de ciclo de vida em organizations.
--   2. Colunas de AI Readiness Score em organizations.
--   3. Nova tabela tenant_usage_monthly (unit economics H10).
--   4. Nova tabela qa_pairs (Q&A self-service editável).
--
-- Característica: tudo é IF NOT EXISTS / CREATE ... IF NOT EXISTS.
-- Roda múltiplas vezes sem erro. Seguro para staging e produção.
-- ═════════════════════════════════════════════════════════════════

-- ── 1. Trial + billing lifecycle em organizations ─────────────────
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "trialStartedAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trialEndsAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trialCostCapUsd"    DOUBLE PRECISION NOT NULL DEFAULT 15.0,
  ADD COLUMN IF NOT EXISTS "trialConverted"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isTrialActive"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "billingCycle"       TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT;

-- ── 2. AI Readiness em organizations ───────────────────────────────
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "aiReadinessScore"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "aiReadinessUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "aiTrainingReadyAt"    TIMESTAMP(3);

-- Index por score para ranking e segmentação rápida no dashboard admin.
CREATE INDEX IF NOT EXISTS "organizations_aiReadinessScore_idx"
  ON "organizations"("aiReadinessScore");

-- ── 3. tenant_usage_monthly (H10) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS "tenant_usage_monthly" (
  "id"                          TEXT NOT NULL,
  "organizationId"              TEXT NOT NULL,
  "periodYearMonth"             TEXT NOT NULL,
  "llmCostUsd"                  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "llmInputTokens"              BIGINT NOT NULL DEFAULT 0,
  "llmOutputTokens"             BIGINT NOT NULL DEFAULT 0,
  "aiMessagesProcessed"         INTEGER NOT NULL DEFAULT 0,
  "broadcastsSent"              INTEGER NOT NULL DEFAULT 0,
  "conversationsOpened"         INTEGER NOT NULL DEFAULT 0,
  "conversationsClosed"         INTEGER NOT NULL DEFAULT 0,
  "conversationsAiResolved"     INTEGER NOT NULL DEFAULT 0,
  "conversationsHumanResolved"  INTEGER NOT NULL DEFAULT 0,
  "handoffsCount"               INTEGER NOT NULL DEFAULT 0,
  "revenueBrlCents"             INTEGER NOT NULL DEFAULT 0,
  "infraCostUsd"                DOUBLE PRECISION NOT NULL DEFAULT 0,
  "grossMarginPercent"          DOUBLE PRECISION,
  "computedAt"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_usage_monthly_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_usage_monthly_orgId_period_unique"
  ON "tenant_usage_monthly"("organizationId", "periodYearMonth");

CREATE INDEX IF NOT EXISTS "tenant_usage_monthly_period_idx"
  ON "tenant_usage_monthly"("periodYearMonth");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tenant_usage_monthly_organizationId_fkey'
  ) THEN
    ALTER TABLE "tenant_usage_monthly"
      ADD CONSTRAINT "tenant_usage_monthly_organizationId_fkey"
      FOREIGN KEY ("organizationId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── 4. qa_pairs (Q&A self-service) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS "qa_pairs" (
  "id"              TEXT NOT NULL,
  "question"        TEXT NOT NULL,
  "answer"          TEXT NOT NULL,
  "category"        TEXT,
  "priority"        INTEGER NOT NULL DEFAULT 0,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "organizationId"  TEXT NOT NULL,
  "ragChunkId"      TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "qa_pairs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "qa_pairs_ragChunkId_unique"
  ON "qa_pairs"("ragChunkId") WHERE "ragChunkId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "qa_pairs_organizationId_idx"
  ON "qa_pairs"("organizationId");

CREATE INDEX IF NOT EXISTS "qa_pairs_organizationId_isActive_idx"
  ON "qa_pairs"("organizationId", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'qa_pairs_organizationId_fkey'
  ) THEN
    ALTER TABLE "qa_pairs"
      ADD CONSTRAINT "qa_pairs_organizationId_fkey"
      FOREIGN KEY ("organizationId")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Fim da migration ───────────────────────────────────────────────
