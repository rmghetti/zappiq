-- ZappIQ — Row-Level Security (RLS) — FASE 4
-- ADR: docs/adr/0001-rls-multitenancy.md
--
-- ⚠️⚠️⚠️ NÃO APLICAR EM PRODUÇÃO SEM REVISÃO HUMANA + SHADOW TEST EM STAGING
--
-- Este arquivo existe para:
--   1. Servir de referência executável para a decisão da ADR-0001
--   2. Ser revisado pelo time de plataforma antes de qualquer rollout
--   3. Documentar exatamente quais roles e policies serão criados
--
-- Plano de aplicação (ver ADR-0001 §2.4):
--   Sprint 1 — roles + RLS em AuditLog, DataSubjectRequest
--   Sprint 2 — Contact, Conversation, Message (shadow)
--   Sprint 3 — rollout produção com feature flag RLS_ENABLED
--   Sprint 4 — demais tabelas
--
-- Testar em staging:
--   BEGIN;
--     \i rls.sql
--     SET LOCAL app.org_id = '<uuid de tenant A>';
--     SELECT count(*) FROM "Contact";           -- deve retornar só A
--     SELECT count(*) FROM "AuditLog";          -- deve retornar só A
--     SET LOCAL app.org_id = '<uuid de tenant B>';
--     SELECT count(*) FROM "Contact";           -- deve retornar só B
--   ROLLBACK;

-- ═══════════════════════════════════════════════════════════════════
-- 1. ROLES
-- ═══════════════════════════════════════════════════════════════════

-- Role usado pela aplicação (API + workers). SEM BYPASSRLS.
-- DATABASE_URL aponta para este role em produção após rollout.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zappiq_app') THEN
    CREATE ROLE zappiq_app LOGIN PASSWORD 'CHANGE_ME_IN_SUPABASE';
  END IF;
END$$;

-- Role usado por prisma migrate / db push. COM BYPASSRLS.
-- Usado apenas no release_command do Fly, nunca pela API em runtime.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zappiq_migrator') THEN
    CREATE ROLE zappiq_migrator LOGIN PASSWORD 'CHANGE_ME_IN_SUPABASE' BYPASSRLS;
  END IF;
END$$;

-- Role read-only para analytics / BI. COM BYPASSRLS mas apenas SELECT.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zappiq_analyst') THEN
    CREATE ROLE zappiq_analyst LOGIN PASSWORD 'CHANGE_ME_IN_SUPABASE' BYPASSRLS;
  END IF;
END$$;

-- Permissões básicas
GRANT USAGE ON SCHEMA public TO zappiq_app, zappiq_migrator, zappiq_analyst;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zappiq_app, zappiq_migrator;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO zappiq_analyst;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zappiq_app, zappiq_migrator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO zappiq_app, zappiq_migrator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO zappiq_analyst;

-- ═══════════════════════════════════════════════════════════════════
-- 2. HELPER: current_org_id()
-- ═══════════════════════════════════════════════════════════════════
-- Encapsula o SET LOCAL, retorna NULL quando não setado (bloqueia tudo).

CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.org_id', true), ''),
    '00000000-0000-0000-0000-000000000000'
  )::uuid;
$$ LANGUAGE sql STABLE;

-- ═══════════════════════════════════════════════════════════════════
-- 3. POLICIES — SPRINT 1 (baixo risco)
-- ═══════════════════════════════════════════════════════════════════
-- Começamos por tabelas onde o risco de bloquear query legítima é baixo,
-- porque todas as leituras já passam por middleware auth + filtro explícito.

-- ─── AuditLog ─────────────────────────────────────
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_tenant_isolation ON "AuditLog";
CREATE POLICY audit_log_tenant_isolation ON "AuditLog"
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ─── DataSubjectRequest ───────────────────────────
ALTER TABLE "DataSubjectRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataSubjectRequest" FORCE ROW LEVEL SECURITY;

-- Exceção: POST público de criação de DSR não tem sessão de tenant setada.
-- Solução: endpoint público insere usando zappiq_migrator (BYPASSRLS),
-- OU policy permissiva apenas para INSERT quando app.dsr_public = 'true'.
-- Optamos pela 2ª (mais seguro que expor zappiq_migrator na API):
DROP POLICY IF EXISTS dsr_tenant_read ON "DataSubjectRequest";
CREATE POLICY dsr_tenant_read ON "DataSubjectRequest"
  FOR SELECT
  USING ("organizationId" = current_org_id());

DROP POLICY IF EXISTS dsr_tenant_write ON "DataSubjectRequest";
CREATE POLICY dsr_tenant_write ON "DataSubjectRequest"
  FOR UPDATE
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- INSERT público: app seta SET LOCAL app.dsr_public = 'true' antes do insert.
-- Isso é checado no route handler antes de chamar prisma.create.
DROP POLICY IF EXISTS dsr_public_insert ON "DataSubjectRequest";
CREATE POLICY dsr_public_insert ON "DataSubjectRequest"
  FOR INSERT
  WITH CHECK (
    current_setting('app.dsr_public', true) = 'true'
    OR "organizationId" = current_org_id()
  );

-- ═══════════════════════════════════════════════════════════════════
-- 4. POLICIES — SPRINT 2 (core de negócio — shadow primeiro!)
-- ═══════════════════════════════════════════════════════════════════
-- ANTES DE APLICAR: rodar por 48h em staging com log_statement=mod
-- Analisar logs para queries que seriam bloqueadas.

-- ─── Contact ──────────────────────────────────────
-- ALTER TABLE "Contact" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Contact" FORCE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS contact_tenant_isolation ON "Contact";
-- CREATE POLICY contact_tenant_isolation ON "Contact"
--   USING ("organizationId" = current_org_id())
--   WITH CHECK ("organizationId" = current_org_id());

-- ─── Conversation ─────────────────────────────────
-- ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Conversation" FORCE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS conversation_tenant_isolation ON "Conversation";
-- CREATE POLICY conversation_tenant_isolation ON "Conversation"
--   USING ("organizationId" = current_org_id())
--   WITH CHECK ("organizationId" = current_org_id());

-- ─── Message ──────────────────────────────────────
-- Message não tem organizationId direto — vai via conversationId.
-- Precisa de policy com JOIN, que é mais lenta. Avaliar denormalizar
-- organizationId em Message ANTES de aplicar RLS (menor custo).
-- ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Message" FORCE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS message_tenant_isolation ON "Message";
-- CREATE POLICY message_tenant_isolation ON "Message"
--   USING (
--     EXISTS (
--       SELECT 1 FROM "Conversation" c
--       WHERE c.id = "Message"."conversationId"
--         AND c."organizationId" = current_org_id()
--     )
--   );

-- ═══════════════════════════════════════════════════════════════════
-- 5. POLICIES — SPRINT 3+ (demais tabelas)
-- ═══════════════════════════════════════════════════════════════════
-- Campaign, Template, Flow, Deal, Pipeline, KnowledgeBase, KBDocument,
-- ApiKey, Integration, Subscription, Invoice — mesmo padrão de Contact.
-- Deixar comentado até Sprint 3.

-- ═══════════════════════════════════════════════════════════════════
-- 6. SMOKE TEST
-- ═══════════════════════════════════════════════════════════════════
-- Após aplicar em staging, rodar:
--
--   SET ROLE zappiq_app;
--   SET LOCAL app.org_id = '<uuid real do tenant A>';
--   SELECT count(*) FROM "AuditLog";          -- só do tenant A
--
--   SET LOCAL app.org_id = '00000000-0000-0000-0000-000000000000';
--   SELECT count(*) FROM "AuditLog";          -- zero (sentinela)
--
--   RESET ROLE;
--   SET ROLE zappiq_migrator;
--   SELECT count(*) FROM "AuditLog";          -- total (bypass)
--
--   RESET ROLE;
