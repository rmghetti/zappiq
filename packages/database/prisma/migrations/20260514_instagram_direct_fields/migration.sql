-- FASE 4 (#251) — Instagram Direct Messaging fields
--
-- Adds 3 fields to organizations (IG account binding) and 1 polymorphic
-- external message ID to messages (dedup + status callback correlation).
--
-- Conversation.channel já existe com default 'whatsapp' — só vamos passar
-- a usar 'instagram' como valor válido (sem schema change necessário).
--
-- Reversível: todos os campos são nullable, sem FK.

-- 1) organizations: campos para binding Meta IG Business
ALTER TABLE "organizations" ADD COLUMN "instagram_account_id" TEXT;
ALTER TABLE "organizations" ADD COLUMN "instagram_page_id" TEXT;
ALTER TABLE "organizations" ADD COLUMN "instagram_access_token" TEXT;

-- 2) messages: ID externo polimórfico (IG hoje, outros canais depois)
ALTER TABLE "messages" ADD COLUMN "external_message_id" TEXT;
CREATE UNIQUE INDEX "messages_external_message_id_key"
  ON "messages"("external_message_id")
  WHERE "external_message_id" IS NOT NULL;

-- 2.5) contacts: IGSID (Instagram-Scoped ID) por organização
ALTER TABLE "contacts" ADD COLUMN "instagram_scoped_id" TEXT;
-- Unique por (instagram_scoped_id, organizationId) só quando IGSID não-null
-- (mesmo padrão do whatsappId mas opcional pra orgs que ainda não usam IG)
CREATE UNIQUE INDEX "contacts_instagram_scoped_id_organizationId_key"
  ON "contacts"("instagram_scoped_id", "organizationId")
  WHERE "instagram_scoped_id" IS NOT NULL;

-- 3) Índice por organization+channel para queries eficientes no dashboard
-- (filtrar conversas por canal específico)
CREATE INDEX IF NOT EXISTS "conversations_organization_channel_idx"
  ON "conversations"("organizationId", "channel");
