-- FEATURE 5b.2 (gestão de templates + reengajamento 24h) — flag durável no template.
-- Aditivo e idempotente. isReengagement marca templates aprováveis usados pra REABRIR
-- a janela de 24h da Meta: fora dessa janela a Meta rejeita mensagem free-form, então
-- só templates (idealmente estes) passam. Default false = comportamento atual preservado.
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "isReengagement" BOOLEAN NOT NULL DEFAULT false;
