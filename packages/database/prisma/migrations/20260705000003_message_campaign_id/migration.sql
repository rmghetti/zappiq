-- W2.4 (fechar loop de campanhas) — vínculo mensagem→campanha.
-- Aditivo e idempotente. Permite rastrear qual campanha originou cada
-- Message OUTBOUND (antes só ficava em metadata), habilitando contadores
-- reais (sent/delivered/read/replied) via webhook de status da Meta.
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;

CREATE INDEX IF NOT EXISTS "messages_campaignId_idx" ON "messages"("campaignId");

-- FK ON DELETE SET NULL: apagar a campanha não apaga o histórico de mensagens,
-- apenas desfaz o vínculo. Idempotente via checagem em pg_constraint.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_campaignId_fkey') THEN
    ALTER TABLE "messages"
      ADD CONSTRAINT "messages_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
