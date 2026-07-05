-- Área "Clientes" — hotfix pós-deploy: o índice único de crm_accounts.organizationId
-- foi criado como PARCIAL (WHERE organizationId IS NOT NULL). Postgres não aceita
-- ON CONFLICT (que prisma.crmAccount.upsert() gera) contra índice parcial —
-- erro 42P10 "no unique or exclusion constraint matching the ON CONFLICT
-- specification". Descoberto ao rodar o backfill (0 linhas gravadas, seguro).
--
-- Correção: índice único COMUM. No Postgres um índice único normal já permite
-- múltiplos NULL por padrão (NULL != NULL), então o mesmo comportamento
-- desejado (várias contas CRM com organizationId NULL, para signups sem org)
-- é preservado sem precisar de índice parcial.

DROP INDEX IF EXISTS "crm_accounts_organizationId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "crm_accounts_organizationId_key"
  ON "crm_accounts"("organizationId");
