-- Trial Enforcement Fase 1: carência de paywall (aditiva, nullable).
-- Setada só nas orgs já vencidas no go-live (cortesia de migração de 7 dias).
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "paywallGraceUntil" TIMESTAMP(3);
