-- ═════════════════════════════════════════════════════════════════
-- 20260914000020: a chave pública deixa de ter qualquer privilégio no schema public
-- ─────────────────────────────────────────────────────────────────
-- Estado medido em 14/09/2026 (auditoria do Treinar IA e da Qualidade):
--   994 grants de tabela para anon e authenticated no schema public,
--   8 grants de função, 2 de sequência, e ALTER DEFAULT PRIVILEGES de
--   postgres e supabase_admin que dão tudo (arwdDxtm) a anon e authenticated
--   em toda tabela nova. A RLS segura hoje (toda tabela está com RLS ligada),
--   mas uma tabela nova sem RLS volta a ficar aberta, como aconteceu com
--   meta_billing_events e agent_prompt_backup (migração 20260913000001).
--
-- Aqui fechamos na camada de baixo: REVOKE de tudo o que existe e mudança
-- dos privilégios padrão, para tabela nova nascer sem grant. A API conecta
-- como postgres (dona) e o web usa service_role nas rotas de servidor;
-- nenhum dos dois é afetado. A view dsr_requests_overdue passa a
-- security_invoker: hoje ela pertence a postgres e atravessa a RLS de
-- dsr_requests para quem consultar a view.
--
-- Idempotente e tolerante: REVOKE em objeto sem grant não faz nada; o
-- ALTER DEFAULT PRIVILEGES para supabase_admin pode exigir privilégio que a
-- conexão da migração não tem, então fica num bloco que só avisa.
--
-- Prova: SELECT count(*) FROM information_schema.role_table_grants
--        WHERE grantee IN ('anon','authenticated') AND table_schema='public' = 0.
-- Reverter: GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated
--           (não recomendado; a RLS continua ligada de qualquer forma).
-- ═════════════════════════════════════════════════════════════════

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

DO $$
BEGIN
  BEGIN
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
    RAISE NOTICE 'privilégios padrão de supabase_admin não alterados: %', SQLERRM;
  END;
END $$;

DO $$
BEGIN
  IF to_regclass('public.dsr_requests_overdue') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.dsr_requests_overdue SET (security_invoker = true)';
  END IF;
END $$;
