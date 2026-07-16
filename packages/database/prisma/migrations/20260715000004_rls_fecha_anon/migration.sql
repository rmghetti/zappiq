-- ═════════════════════════════════════════════════════════════════
-- 20260715000004 — RLS: fechar o acesso da chave anon
-- ─────────────────────────────────────────────────────────────────
-- POR QUE ESTA MIGRAÇÃO EXISTE
--
-- A migração 20260417_rls_multi_tenant CONSTA como aplicada em produção
-- (20/04/2026, sem rollback) e mesmo assim nenhuma tabela dela tinha RLS.
-- A primeira coisa que ela faz é `CREATE ROLE app_user`; esse papel NÃO
-- existe em produção — e a migração 20260611_maestro_v2_versions_timers
-- falhou justamente com `42704: role "app_user" does not exist`.
-- Ou seja: alguém marcou aquela migração como aplicada sem executá-la
-- (`prisma migrate resolve --applied`) e o SQL da RLS nunca rodou.
--
-- Consequência medida em produção em 15/07/2026: com a chave `anon` (que é
-- PÚBLICA, vai no bundle do frontend), qualquer pessoa lia via PostgREST:
--   contacts → 38 linhas (nome, telefone, e-mail)   ← dado pessoal, LGPD
--   pipeline_stages → 105 · activities → 49 · tasks → 6
-- E o `anon` tem grant de INSERT/UPDATE/DELETE/TRUNCATE nessas tabelas
-- (default do Supabase: GRANT ALL ... TO anon — por isso RLS é obrigatória).
--
-- POR QUE ISTO NÃO QUEBRA A API
--
-- A API conecta como `postgres`, que é DONO das tabelas e tem
-- rolbypassrls=true → ignora RLS. `mira_alvos` é o grupo de controle: já
-- estava com RLS+política e, no mesmo dia, a API lia seus 17 alvos
-- normalmente enquanto o anon via 0. Não há uso legítimo do anon em
-- tabela pública: o único cliente anon do front (auth/callback) só chama
-- exchangeCodeForSession (schema `auth`); todo acesso a `signups` usa a
-- chave de serviço (service_role, que também bypassa).
--
-- DUAS FORMAS AQUI, DE PROPÓSITO
--
-- 1) Tabelas com `organizationId` direto → RLS + política de tenant
--    (mesmo desenho já provado em mira_alvos).
-- 2) Tabelas sem `organizationId` (messages, kb_chunks, ...) → RLS LIGADA
--    E SEM POLÍTICA = nega tudo para quem não bypassa. Deliberado: escrever
--    política via join hoje seria código NÃO VERIFICÁVEL (não existe papel
--    sujeito a RLS para testar contra). Nega-tudo é verificável agora
--    (anon → 0 linhas) e é o mesmo estado em que stripe_invoices e
--    crm_accounts já rodam em produção sem problema.
--
-- ATENÇÃO PARA QUEM UM DIA LIGAR O `app_user`:
--    As tabelas do grupo (2) vão NEGAR TUDO para ele. Antes de apontar a
--    connection string para um papel sujeito a RLS, escreva as políticas
--    via join dessas tabelas — e teste, agora que dá.
--
-- Idempotente: IF EXISTS / DROP POLICY IF EXISTS em tudo.
-- ═════════════════════════════════════════════════════════════════

-- ── 1. Tabelas com organizationId direto: RLS + política de tenant ──
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'activities', 'audit_logs', 'campaigns', 'contacts', 'conversations',
    'data_subject_requests', 'deals', 'flows', 'knowledge_bases',
    'message_templates', 'pipeline_stages', 'qa_pairs', 'tasks',
    'tenant_usage_monthly', 'users'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "org_isolation" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "org_isolation" ON public.%I USING ("organizationId" = current_setting(''app.current_organization_id'', true))',
        t
      );
    END IF;
  END LOOP;
END
$$;

-- ── 2. organizations: o tenant é a própria linha ───────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON public.organizations;
CREATE POLICY "org_isolation" ON public.organizations
  USING ("id" = current_setting('app.current_organization_id', true));

-- ── 3. Sem organizationId → RLS ligada, sem política (nega o anon) ──
-- `agents` já tinha política criada (20260427_agent_model) mas com a RLS
-- DESLIGADA — a política existia sem valer nada. Aqui ela passa a valer.
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'agent_eval_fix_decisions', 'agent_eval_runs', 'agents', 'consents',
    'discount_coupons', 'flow_templates', 'internal_notes', 'iza_facts',
    'kb_chunks', 'kb_documents', 'llm_call_logs', 'messages',
    'mira_cnpj_index', 'onboarding_journey_state', 'rag_chunks'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END
$$;
