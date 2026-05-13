-- V3.2 (task #237) — Persist eval runs in DB
-- Permite histórico de score por agent + UI dashboard + cron diário (V3.3).

CREATE TABLE "agent_eval_runs" (
  "id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "eval_set_version" TEXT NOT NULL,
  "core_rules_version" TEXT,
  "triggered_by" TEXT NOT NULL DEFAULT 'manual',
  "scenario_filter" JSONB,
  "total_scenarios" INTEGER,
  "passed" INTEGER,
  "partial" INTEGER,
  "failed" INTEGER,
  "critical_failed" INTEGER,
  "score_percent" INTEGER,
  "results" JSONB,
  "error" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "duration_ms" INTEGER,

  CONSTRAINT "agent_eval_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_eval_runs_agent_id_started_at_idx" ON "agent_eval_runs"("agent_id", "started_at" DESC);
CREATE INDEX "agent_eval_runs_status_idx" ON "agent_eval_runs"("status");

ALTER TABLE "agent_eval_runs"
  ADD CONSTRAINT "agent_eval_runs_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
