-- Fase B (atribuição IA) — vínculo conversa→deal. Aditivo e idempotente.
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "sourceConversationId" TEXT;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "aiLinkReviewed" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "deals_sourceConversationId_idx" ON "deals"("sourceConversationId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_sourceConversationId_fkey') THEN
    ALTER TABLE "deals"
      ADD CONSTRAINT "deals_sourceConversationId_fkey"
      FOREIGN KEY ("sourceConversationId") REFERENCES "conversations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
