-- Mira Prospects — plano de ação vira tarefa em /tasks
--
-- O plano de ação é o próximo passo concreto que a IA sugere para o Alvo, e
-- ele nasce como Task PENDING. Até aqui TODA Task vinha das Conversas, então
-- a origem era implícita; agora a tela precisa distinguir os dois trabalhos.
--
-- Tudo aditivo e com default: nenhuma linha existente muda de comportamento
-- (Task antiga = CONVERSA, que é a verdade histórica).

-- Origem da tarefa
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskOrigem') THEN
    CREATE TYPE "TaskOrigem" AS ENUM ('CONVERSA', 'MIRA');
  END IF;
END
$$;

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "origem" "TaskOrigem" NOT NULL DEFAULT 'CONVERSA';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "miraAlvoId" TEXT;
CREATE INDEX IF NOT EXISTS "tasks_miraAlvoId_idx" ON "tasks"("miraAlvoId");

-- Plano de ação no Alvo
ALTER TABLE "mira_alvos" ADD COLUMN IF NOT EXISTS "planoAcao" TEXT;
ALTER TABLE "mira_alvos" ADD COLUMN IF NOT EXISTS "planoAcaoTaskId" TEXT;
