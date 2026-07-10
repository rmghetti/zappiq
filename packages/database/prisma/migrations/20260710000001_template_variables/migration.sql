-- Preenchimento de variáveis {{1}}, {{2}}... dos templates por contato.
-- Aditivo e nullable — templates existentes seguem com variables=NULL; sem mapa
-- o disparo cai em texto (comportamento anterior). Idempotente pro migrate do Fly.
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "variables" JSONB;
