-- Tarefas — link com Conversa e Campanha (Kanban + integrações)
--
-- Duas lacunas que o Rodrigo pediu para fechar:
--   1. O TaskPanel já tinha o link "ver a conversa" pronto na intenção
--      (crmAutomationService recebe conversationId e já o usa nas Activity
--      vizinhas), o dado só nunca foi persistido na própria Task.
--   2. O Co-Piloto do Zap Impulso (autonomyLevel padrão 2, "a IA propõe e o
--      humano aprova") nunca teve onde pedir essa aprovação de verdade — a
--      campanha nascia DRAFT/SCHEDULED sem nenhum artefato notificável.
--
-- Tudo aditivo: colunas nullable, valor de enum novo. Nenhuma linha existente
-- muda de valor nem de comportamento.

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "conversationId" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;

CREATE INDEX IF NOT EXISTS "tasks_conversationId_idx" ON "tasks"("conversationId");
CREATE INDEX IF NOT EXISTS "tasks_campaignId_idx" ON "tasks"("campaignId");

-- SetNull nas duas: LGPD pode anonimizar/apagar a conversa, e apagar a
-- campanha não deveria apagar o registro de que alguém precisou revisar algo.
-- A tarefa (o trabalho humano) sobrevive à origem que a gerou — mesmo
-- raciocínio já aplicado em miraAlvoId e dealId.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_conversationId_fkey'
  ) THEN
    ALTER TABLE "tasks"
      ADD CONSTRAINT "tasks_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "conversations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_campaignId_fkey'
  ) THEN
    ALTER TABLE "tasks"
      ADD CONSTRAINT "tasks_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- IMPULSO: a tarefa de aprovação de campanha não é "responder quem chamou"
-- (CONVERSA) nem "prospectar quem nem te conhece" (MIRA) — é revisar o que a
-- IA vai enviar em nome da conta antes de sair.
ALTER TYPE "TaskOrigem" ADD VALUE IF NOT EXISTS 'IMPULSO';
