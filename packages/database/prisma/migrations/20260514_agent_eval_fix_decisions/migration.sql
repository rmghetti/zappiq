-- FASE 2.2a task #243 — Apply/Reject/Edit fix sugestões IA + Slack instrumentation

-- 1) Instrumentação Slack na agent_eval_runs
ALTER TABLE "agent_eval_runs" ADD COLUMN "slack_alert_status" TEXT;
ALTER TABLE "agent_eval_runs" ADD COLUMN "slack_alert_error" TEXT;
ALTER TABLE "agent_eval_runs" ADD COLUMN "slack_alert_sent_at" TIMESTAMP(3);

-- 2) Audit log de decisões de aplicar/recusar sugestões IA
CREATE TABLE "agent_eval_fix_decisions" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "scenario_id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  -- 'applied' | 'rejected' | 'reverted'
  "decision" TEXT NOT NULL,
  -- Sugestão original (JSONB: { summary, patches, confidence })
  "original_suggestion" JSONB,
  -- Diff final aplicado (possivelmente editado pelo user)
  "final_diff" TEXT,
  -- Snapshots do system_prompt antes/depois (rollback)
  "prompt_before" TEXT,
  "prompt_after" TEXT,
  -- Audit: quem decidiu (snapshot dos dados pra histórico mesmo se user deletado)
  "decided_by_id" TEXT,
  "decided_by_email" TEXT NOT NULL,
  "decided_by_name" TEXT,
  "decided_by_role" TEXT,
  "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Motivo opcional (recusa) ou nota (aplicação)
  "notes" TEXT,
  -- Se decision='reverted', aponta pra decisão original revertida
  "reverted_from_id" TEXT,

  CONSTRAINT "agent_eval_fix_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_eval_fix_decisions_run_id_idx" ON "agent_eval_fix_decisions"("run_id");
CREATE INDEX "agent_eval_fix_decisions_agent_id_decided_at_idx"
  ON "agent_eval_fix_decisions"("agent_id", "decided_at" DESC);
CREATE INDEX "agent_eval_fix_decisions_scenario_id_idx" ON "agent_eval_fix_decisions"("scenario_id");

ALTER TABLE "agent_eval_fix_decisions"
  ADD CONSTRAINT "agent_eval_fix_decisions_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "agent_eval_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
