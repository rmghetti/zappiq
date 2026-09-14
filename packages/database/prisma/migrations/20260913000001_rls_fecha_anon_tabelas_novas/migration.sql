-- ═════════════════════════════════════════════════════════════════
-- 20260913000001: RLS nas tabelas criadas depois da 20260715000004
-- ─────────────────────────────────────────────────────────────────
-- A 20260715000004_rls_fecha_anon ligou a RLS numa lista FIXA de tabelas.
-- Tabelas criadas depois nasceram sem RLS e, com o GRANT padrão do Supabase
-- ao papel anon, ficaram acessíveis pela chave pública via PostgREST.
-- Encontrado na auditoria do Treinar IA e da Qualidade da IA (13/09/2026)
-- e aplicado em produção no mesmo dia pelo MCP do Supabase; esta migração
-- registra a mudança no repositório. É idempotente (ligar a RLS de novo não
-- faz nada) e ignora tabela que não existe: agent_prompt_backup e
-- iza_facts_backup foram criadas à mão em produção e não estão no
-- schema.prisma, então não existem num banco novo.
--
-- Mesmo desenho da 20260715000004: RLS LIGADA E SEM POLÍTICA = nega tudo
-- para quem não ignora RLS. A API conecta como postgres (dono das tabelas,
-- rolbypassrls=true) e não é afetada.
--
-- Prova depois de aplicar: HEAD /rest/v1/<tabela> com a chave pública e
-- Prefer: count=exact devolve content-range */0 nas cinco.
-- Reverter: ALTER TABLE ... DISABLE ROW LEVEL SECURITY.
-- ═════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    '_prisma_migrations',
    'agent_prompt_backup',
    'iza_facts_backup',
    'channel_health_checks',
    'meta_billing_events'
  ]
  LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;
