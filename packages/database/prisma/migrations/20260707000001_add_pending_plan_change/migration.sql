-- Troca de plano AGENDADA (downgrade mensal / anual travado).
-- Aditiva e idempotente: coluna JSONB nullable, nasce NULL em toda org.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "pendingPlanChange" JSONB;
