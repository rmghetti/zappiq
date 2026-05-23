-- Self-serve "traga seu token" — app secret do app Meta DO CLIENTE.
--
-- Usado pra verificar a assinatura (x-hub-signature-256) dos webhooks WhatsApp
-- e Instagram que chegam assinados pelo app Meta do cliente. Sem isso o webhook
-- cai no META_APP_SECRET global (Iza dogfood / clientes sob o app da ZappIQ).
--
-- Nullable, sem FK, reversível. Backfill desnecessário (null = usa global).

ALTER TABLE "organizations" ADD COLUMN "meta_app_secret" TEXT;
