-- Impulso: copy por canal editável pelo cliente na campanha.
-- Aditivo e nullable — campanhas existentes seguem com message=NULL e o disparo
-- cai no fallback (template.bodyText). Idempotente para o migrate deploy do Fly.
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "message" JSONB;
