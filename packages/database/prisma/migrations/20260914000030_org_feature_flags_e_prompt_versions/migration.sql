-- ═════════════════════════════════════════════════════════════════
-- 20260914000030: interruptores por organização e versões do prompt
-- ─────────────────────────────────────────────────────────────────
-- POR QUE ESTA MIGRAÇÃO EXISTE
--
-- 1) org_feature_flags
--    Fundir na main publica a API (Fly) e o web (Vercel) na hora. Sem um
--    interruptor por organização, todo comportamento novo estreia ligado
--    para 100% dos clientes no minuto do merge. Esta tabela é o interruptor:
--    linha ausente = desligado, e `remove_by` é o prazo para tirar o
--    interruptor do código (o teste featureFlags.test.ts falha se vencer).
--
-- 2) agent_prompt_versions + gatilho em agents
--    Achado A083 da auditoria de 13/09/2026: `agents.system_prompt` era
--    sobrescrito em cinco lugares do produto, sem histórico. Reverter uma
--    correção restaurava o texto de antes sem olhar o que existia no agente
--    naquele momento, apagando tudo o que veio depois (caso real: o prompt
--    da Vera tem 6.506 chars e o promptBefore de uma decisão de 16/07 tem
--    3.978, e reverter hoje apagaria a seção do curso).
--
--    A numeração fica no BANCO, não na aplicação, de propósito: escrita
--    feita fora do produto (psql, script, migração) também vira versão,
--    marcada com source 'fora_do_app'. É o que torna o histórico confiável.
--
-- COMO PROVAR DEPOIS DE APLICAR (em produção, pelo MCP do Supabase):
--   -- não gera versão (texto idêntico):
--   UPDATE agents SET system_prompt = system_prompt WHERE id = '<id>';
--   -- gera versão com source 'fora_do_app':
--   UPDATE agents SET system_prompt = system_prompt || ' ' WHERE id = '<id>';
--   SELECT version, source, hash, created_at
--     FROM agent_prompt_versions WHERE agent_id = '<id>' ORDER BY version DESC;
--   -- a chave pública não enxerga as tabelas novas:
--   SELECT has_table_privilege('anon','public.org_feature_flags','SELECT');      -- false
--   SELECT has_table_privilege('anon','public.agent_prompt_versions','SELECT');  -- false
--
-- IDEMPOTENTE: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
-- DROP TRIGGER IF EXISTS antes do CREATE TRIGGER, backfill com WHERE NOT
-- EXISTS. Rodar duas vezes não duplica nada.
--
-- NÃO DESTRUTIVA: só cria. Nenhuma coluna existente muda de tipo, nenhum
-- dado é apagado.
--
-- REVERTER:
--   DROP TRIGGER IF EXISTS agents_versiona_prompt ON public.agents;
--   DROP FUNCTION IF EXISTS public.zappiq_registra_versao_do_prompt();
--   DROP TABLE IF EXISTS public.agent_prompt_versions;
--   DROP TABLE IF EXISTS public.org_feature_flags;
-- ═════════════════════════════════════════════════════════════════

-- ── 1. org_feature_flags ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_feature_flags (
    "organization_id" TEXT NOT NULL,
    "flag"            TEXT NOT NULL,
    "enabled"         BOOLEAN NOT NULL DEFAULT false,
    "value"           JSONB,
    "remove_by"       DATE,
    "updated_by"      TEXT,
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "org_feature_flags_pkey" PRIMARY KEY ("organization_id", "flag")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'org_feature_flags_organization_id_fkey'
  ) THEN
    ALTER TABLE public.org_feature_flags
      ADD CONSTRAINT "org_feature_flags_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES public.organizations("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── 2. agent_prompt_versions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_prompt_versions (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id"      TEXT NOT NULL,
    "version"       INTEGER NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "hash"          TEXT NOT NULL,
    "source"        TEXT NOT NULL,
    "decision_id"   TEXT,
    "created_by"    TEXT,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "agent_prompt_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_prompt_versions_agent_id_version_key"
  ON public.agent_prompt_versions("agent_id", "version");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_prompt_versions_agent_id_fkey'
  ) THEN
    ALTER TABLE public.agent_prompt_versions
      ADD CONSTRAINT "agent_prompt_versions_agent_id_fkey"
      FOREIGN KEY ("agent_id") REFERENCES public.agents("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── 3. Gatilho: toda escrita em agents.system_prompt vira versão ──
-- Lock consultivo por agente (escopo da transação): duas gravações
-- simultâneas no MESMO agente entram em fila em vez de colidirem no
-- unique (agent_id, version) e derrubarem o apply-fix do cliente.
-- Agentes diferentes não se bloqueiam.
CREATE OR REPLACE FUNCTION public.zappiq_registra_versao_do_prompt()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  proxima integer;
BEGIN
  -- IF aninhado de propósito: o Postgres não garante curto-circuito num
  -- `TG_OP = 'UPDATE' AND OLD....`, e ler OLD num gatilho de INSERT é erro.
  IF TG_OP = 'UPDATE' THEN
    IF NOT (OLD.system_prompt IS DISTINCT FROM NEW.system_prompt) THEN
      RETURN NULL;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('zappiq_prompt_version'), hashtext(NEW.id));

  SELECT COALESCE(MAX(version), 0) + 1
    INTO proxima
    FROM public.agent_prompt_versions
   WHERE agent_id = NEW.id;

  INSERT INTO public.agent_prompt_versions
    (agent_id, version, system_prompt, hash, source, decision_id, created_by)
  VALUES (
    NEW.id,
    proxima,
    NEW.system_prompt,
    md5(NEW.system_prompt),
    COALESCE(NULLIF(current_setting('zappiq.prompt_source', true), ''), 'fora_do_app'),
    NULLIF(current_setting('zappiq.prompt_decision', true), ''),
    NULLIF(current_setting('zappiq.prompt_actor', true), '')
  );

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS agents_versiona_prompt ON public.agents;
CREATE TRIGGER agents_versiona_prompt
AFTER INSERT OR UPDATE OF system_prompt ON public.agents
FOR EACH ROW
EXECUTE FUNCTION public.zappiq_registra_versao_do_prompt();

-- ── 4. Backfill: versão 1 de cada agente que já existe ────────────
-- source 'migracao' = "o texto já estava assim quando o histórico começou".
INSERT INTO public.agent_prompt_versions
  (agent_id, version, system_prompt, hash, source, created_by)
SELECT a.id, 1, a.system_prompt, md5(a.system_prompt), 'migracao', NULL
  FROM public.agents a
 WHERE NOT EXISTS (
   SELECT 1 FROM public.agent_prompt_versions v WHERE v.agent_id = a.id
 );

-- ── 5. RLS: nega tudo para quem não ignora RLS ────────────────────
-- Mesmo desenho da 20260715000004_rls_fecha_anon: RLS LIGADA E SEM
-- POLÍTICA. A API conecta como postgres (dono, rolbypassrls=true) e não é
-- afetada. As duas tabelas são de plataforma, não têm uso legítimo pela
-- chave pública.
ALTER TABLE public.org_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_prompt_versions ENABLE ROW LEVEL SECURITY;

-- REVOKE condicional: banco local de desenvolvimento não tem os papéis do
-- Supabase (anon, authenticated, app_user). Sem o IF, a migração quebraria
-- em qualquer ambiente que não seja o Supabase.
DO $$
DECLARE
  papel text;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated', 'app_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL ON public.org_feature_flags FROM %I', papel);
      EXECUTE format('REVOKE ALL ON public.agent_prompt_versions FROM %I', papel);
    END IF;
  END LOOP;
END $$;
