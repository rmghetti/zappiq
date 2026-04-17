-- ═════════════════════════════════════════════════════════════════
-- Migration 20260417 — Row Level Security (multi-tenant isolation)
-- ─────────────────────────────────────────────────────────────────
-- Objetivo:
--   Garantir isolamento de dados entre organizações via RLS no
--   PostgreSQL. Cada request da API seta a variável de sessão
--   app.current_organization_id e o banco filtra automaticamente.
--
-- Estratégia:
--   1. Tabelas com organizationId direto → policy simples
--   2. Tabelas filhas (messages, kb_documents, etc.) → policy via JOIN
--   3. Tabela organizations → policy por id = current_org_id
--   4. Consents → policy via contactId → contacts.organizationId
--
-- Segurança:
--   - RLS é aplicado para o role "app_user" (role da aplicação).
--   - O superuser/migration role (postgres) BYPASSA RLS naturalmente.
--   - IF NOT EXISTS em tudo — idempotente.
--
-- Como usar na API:
--   await prisma.$executeRawUnsafe(
--     `SET LOCAL app.current_organization_id = '${orgId}'`
--   );
--   // Todas as queries subsequentes na mesma transação são filtradas.
-- ═════════════════════════════════════════════════════════════════

-- ── 0. Criar role da aplicação se não existir ──────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;

-- ── 1. Habilitar RLS nas tabelas com organizationId direto ────────

-- organizations
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "organizations";
CREATE POLICY "org_isolation" ON "organizations"
  USING ("id" = current_setting('app.current_organization_id', true));

-- users
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "users";
CREATE POLICY "org_isolation" ON "users"
  USING ("organizationId" = current_setting('app.current_organization_id', true));

-- contacts
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "contacts";
CREATE POLICY "org_isolation" ON "contacts"
  USING ("organizationId" = current_setting('app.current_organization_id', true));

-- conversations
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "conversations";
CREATE POLICY "org_isolation" ON "conversations"
  USING ("organizationId" = current_setting('app.current_organization_id', true));

-- campaigns
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "campaigns";
CREATE POLICY "org_isolation" ON "campaigns"
  USING ("organizationId" = current_setting('app.current_organization_id', true));

-- flows
ALTER TABLE "flows" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "flows";
CREATE POLICY "org_isolation" ON "flows"
  USING ("organizationId" = current_setting('app.current_organization_id', true));

-- knowledge_bases
ALTER TABLE "knowledge_bases" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "knowledge_bases";
CREATE POLICY "org_isolation" ON "knowledge_bases"
  USING ("organizationId" = current_setting('app.current_organization_id', true));

-- deals
ALTER TABLE "deals" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "deals";
CREATE POLICY "org_isolation" ON "deals"
  USING ("organizationId" = current_setting('app.current_organization_id', true));

-- message_templates
ALTER TABLE "message_templates" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "message_templates";
CREATE POLICY "org_isolation" ON "message_templates"
  USING ("organizationId" = current_setting('app.current_organization_id', true));

-- audit_logs
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "audit_logs";
CREATE POLICY "org_isolation" ON "audit_logs"
  USING ("organizationId" = current_setting('app.current_organization_id', true));

-- data_subject_requests
ALTER TABLE "data_subject_requests" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "data_subject_requests";
CREATE POLICY "org_isolation" ON "data_subject_requests"
  USING ("organizationId" = current_setting('app.current_organization_id', true));

-- tenant_usage_monthly (se existir — criada na migration anterior)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'tenant_usage_monthly') THEN
    EXECUTE 'ALTER TABLE "tenant_usage_monthly" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "org_isolation" ON "tenant_usage_monthly"';
    EXECUTE $p$
      CREATE POLICY "org_isolation" ON "tenant_usage_monthly"
        USING ("organizationId" = current_setting('app.current_organization_id', true))
    $p$;
  END IF;
END
$$;

-- ── 2. Tabelas filhas (isolamento via JOIN ao parent) ──────────────

-- messages → via conversations.organizationId
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "messages";
CREATE POLICY "org_isolation" ON "messages"
  USING (
    EXISTS (
      SELECT 1 FROM "conversations" c
      WHERE c."id" = "messages"."conversationId"
        AND c."organizationId" = current_setting('app.current_organization_id', true)
    )
  );

-- internal_notes → via conversations.organizationId
ALTER TABLE "internal_notes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "internal_notes";
CREATE POLICY "org_isolation" ON "internal_notes"
  USING (
    EXISTS (
      SELECT 1 FROM "conversations" c
      WHERE c."id" = "internal_notes"."conversationId"
        AND c."organizationId" = current_setting('app.current_organization_id', true)
    )
  );

-- kb_documents → via knowledge_bases.organizationId
ALTER TABLE "kb_documents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "kb_documents";
CREATE POLICY "org_isolation" ON "kb_documents"
  USING (
    EXISTS (
      SELECT 1 FROM "knowledge_bases" kb
      WHERE kb."id" = "kb_documents"."knowledgeBaseId"
        AND kb."organizationId" = current_setting('app.current_organization_id', true)
    )
  );

-- kb_chunks → via kb_documents → knowledge_bases.organizationId
ALTER TABLE "kb_chunks" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "kb_chunks";
CREATE POLICY "org_isolation" ON "kb_chunks"
  USING (
    EXISTS (
      SELECT 1 FROM "kb_documents" d
      JOIN "knowledge_bases" kb ON kb."id" = d."knowledgeBaseId"
      WHERE d."id" = "kb_chunks"."documentId"
        AND kb."organizationId" = current_setting('app.current_organization_id', true)
    )
  );

-- consents → via contacts.organizationId
ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON "consents";
CREATE POLICY "org_isolation" ON "consents"
  USING (
    EXISTS (
      SELECT 1 FROM "contacts" ct
      WHERE ct."id" = "consents"."contactId"
        AND ct."organizationId" = current_setting('app.current_organization_id', true)
    )
  );

-- ── 3. Conceder permissões ao role da aplicação ────────────────────
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'organizations', 'users', 'contacts', 'conversations',
      'messages', 'campaigns', 'flows', 'knowledge_bases',
      'kb_documents', 'kb_chunks', 'deals', 'message_templates',
      'internal_notes', 'audit_logs', 'data_subject_requests', 'consents'
    ])
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_user', tbl);
  END LOOP;
END
$$;

-- Conceder tenant_usage_monthly se existir
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'tenant_usage_monthly') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_usage_monthly" TO app_user';
  END IF;
END
$$;

-- ── 4. Nota sobre qa_pairs (se existir) ────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'qa_pairs') THEN
    EXECUTE 'ALTER TABLE "qa_pairs" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "org_isolation" ON "qa_pairs"';
    EXECUTE $p$
      CREATE POLICY "org_isolation" ON "qa_pairs"
        USING ("organizationId" = current_setting('app.current_organization_id', true))
    $p$;
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "qa_pairs" TO app_user';
  END IF;
END
$$;
