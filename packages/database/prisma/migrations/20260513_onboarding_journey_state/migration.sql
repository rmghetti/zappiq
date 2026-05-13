-- FASE 1.B task #240 — Onboarding journey state (idempotência D+1/D+3/D+7)

CREATE TABLE "onboarding_journey_state" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "email_provider_id" TEXT,
  "template_id" TEXT NOT NULL,
  "org_snapshot" JSONB,

  CONSTRAINT "onboarding_journey_state_pkey" PRIMARY KEY ("id")
);

-- Idempotência: 1 row por (org, stage). Evita duplicar D+1 numa retry.
CREATE UNIQUE INDEX "onboarding_journey_state_organization_id_stage_key"
  ON "onboarding_journey_state"("organization_id", "stage");

CREATE INDEX "onboarding_journey_state_sent_at_idx"
  ON "onboarding_journey_state"("sent_at" DESC);

ALTER TABLE "onboarding_journey_state"
  ADD CONSTRAINT "onboarding_journey_state_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
