-- Tarefas — de mural de recados a cabine de comando
--
-- O módulo Tarefas nasceu como VITRINE: a IA criava a tarefa por dentro
-- (crmAutomationService, Mira) e a tela só listava e concluía. Não havia rota
-- de criação, o cliente não conseguia criar tarefa nenhuma, e `assignedToId`
-- era coluna MORTA — TEXT solto, sem FK, sem include, sem ninguém escrevendo
-- (só o seed). Toda tarefa em produção nascia sem dono.
--
-- Tudo aqui é aditivo (coluna nova nullable, tabela nova, valor novo de enum):
-- nenhuma linha existente muda de valor nem de comportamento.

-- 1) Status intermediário para o quadro.
--    Sem ele o quadro teria só "a fazer" e "feito", e a pessoa não teria onde
--    dizer que pegou a tarefa. IN_PROGRESS não conclui nada → completedAt segue
--    null (ver resolveCompletedAt em tasks.util.ts).
--    ADD VALUE roda em transação no PG 12+ desde que o valor não seja USADO na
--    mesma migração — e não é.
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS' AFTER 'PENDING';

-- 2) Observação do humano.
--    Separada de `description` DE PROPÓSITO: aquela é o texto que a IA escreveu
--    (o plano de ação, o alerta de release). Deixar o vendedor anotar por cima
--    apagaria a instrução original.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- 3) A FK que faltava desde sempre em assignedToId.
--    ON DELETE SET NULL: se o usuário sai da empresa, a tarefa continua viva e
--    sem dono (é trabalho da org, não dele) — quem sair não leva a tarefa junto.
--    Seguro: conferido em produção antes de criar (6 tarefas, 0 com responsável,
--    0 órfã), então nenhuma linha viola a constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_assignedToId_fkey'
  ) THEN
    ALTER TABLE "tasks"
      ADD CONSTRAINT "tasks_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- 4) Catálogo de etiquetas, por org.
--    Decisão do Rodrigo: etiqueta é CATÁLOGO, não texto livre. Texto livre
--    viraria "Urgente", "urgente" e "URGENTE" na mesma conta, e o filtro por
--    etiqueta — que é o motivo de a etiqueta existir — não acharia nada.
CREATE TABLE IF NOT EXISTS "task_tags" (
  "id"             TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "color"          TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_tags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "task_tags_organizationId_idx" ON "task_tags"("organizationId");
-- O nome É a identidade da etiqueta dentro da org: duas "Urgente" na mesma
-- conta derrotariam o propósito do catálogo.
CREATE UNIQUE INDEX IF NOT EXISTS "task_tags_organizationId_name_key"
  ON "task_tags"("organizationId", "name");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_tags_organizationId_fkey'
  ) THEN
    ALTER TABLE "task_tags"
      ADD CONSTRAINT "task_tags_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- 5) Ligação tarefa ↔ etiqueta.
--    Tabela explícita (e não m2m implícita do Prisma) para o join ter nome
--    previsível: a RLS precisa escrever política nele.
CREATE TABLE IF NOT EXISTS "task_tags_on_tasks" (
  "taskId"    TEXT NOT NULL,
  "tagId"     TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_tags_on_tasks_pkey" PRIMARY KEY ("taskId", "tagId")
);

CREATE INDEX IF NOT EXISTS "task_tags_on_tasks_tagId_idx" ON "task_tags_on_tasks"("tagId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_tags_on_tasks_taskId_fkey'
  ) THEN
    ALTER TABLE "task_tags_on_tasks"
      ADD CONSTRAINT "task_tags_on_tasks_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "tasks"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_tags_on_tasks_tagId_fkey'
  ) THEN
    ALTER TABLE "task_tags_on_tasks"
      ADD CONSTRAINT "task_tags_on_tasks_tagId_fkey"
      FOREIGN KEY ("tagId") REFERENCES "task_tags"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- 6) RLS nas tabelas novas, no mesmo desenho de 20260715000004_rls_fecha_anon.
--    Sem isto elas nasceriam legíveis pela chave anon PÚBLICA — o buraco que
--    aquela migração acabou de fechar. Tabela nova entra fechada.
ALTER TABLE "task_tags" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "task_tags";
CREATE POLICY "org_isolation" ON "task_tags"
  USING ("organizationId" = current_setting('app.current_organization_id', true));

-- Sem coluna de tenant (o dono é a task) → RLS sem política: nega o anon, e a
-- API não sente porque conecta como postgres, que bypassa.
ALTER TABLE "task_tags_on_tasks" ENABLE ROW LEVEL SECURITY;
