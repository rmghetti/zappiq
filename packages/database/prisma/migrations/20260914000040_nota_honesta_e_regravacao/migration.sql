-- ═════════════════════════════════════════════════════════════════
-- 20260914000040: nota honesta (arnês v3) e regravação das execuções
-- ─────────────────────────────────────────────────────────────────
-- POR QUE ESTA MIGRAÇÃO EXISTE
--
-- 1) agent_eval_runs.harness_version
--    eval_set_version diz DE QUEM é o gabarito (v1 era o da ZappIQ aplicado a
--    todo cliente; v2 é por tenant). Faltava dizer COMO se mede. A régua mudou
--    em 14/09/2026 (arnês v3: falha técnica fora da nota, juiz lido com
--    tolerância, cr5 alinhado ao CORE, prazo inventado reprovando). Sem esta
--    coluna, comparar a nota de agosto com a de setembro é comparar duas
--    réguas diferentes sem saber.
--
-- 2) agent_eval_runs.erros
--    Cenário que quebrou por falha do provedor deixou de contar como
--    reprovação. Eram 90 cenários "Scenario crashed" dentro da nota, e em
--    15/06 uma execução com 25 respostas vazias marcou nota 0. O número de
--    cenários não avaliáveis passa a ser gravado, porque é ele que explica
--    por que o denominador da nota é menor que o total.
--
-- 3) eval_regrades
--    Proposta P61. As respostas de 3.712 cenários v2 já estão gravadas em
--    agent_eval_runs.results. Regravar a nota sobre elas separa o erro do
--    GABARITO do erro do AGENTE, e dá o número antes e depois sem uma única
--    chamada paga. Cada linha é um cenário relido: veredito antigo, veredito
--    novo, motivo e a versão do arnês que releu.
--
-- COMO PROVAR DEPOIS DE APLICAR (produção, pelo MCP do Supabase):
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'agent_eval_runs'
--      AND column_name IN ('harness_version','erros');            -- 2 linhas
--   SELECT has_table_privilege('anon','public.eval_regrades','SELECT');           -- false
--   SELECT has_table_privilege('authenticated','public.eval_regrades','SELECT');  -- false
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'eval_regrades';          -- true
--
-- IDEMPOTENTE: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS,
-- CREATE INDEX IF NOT EXISTS, REVOKE condicional. Rodar duas vezes não muda
-- nada.
--
-- NÃO DESTRUTIVA: só acrescenta. Nenhuma coluna existente muda de tipo,
-- nenhum dado é apagado, nenhuma execução gravada é reescrita (a regravação
-- grava em tabela própria, e NUNCA por cima de agent_eval_runs).
--
-- REVERTER:
--   DROP TABLE IF EXISTS public.eval_regrades;
--   ALTER TABLE public.agent_eval_runs DROP COLUMN IF EXISTS harness_version;
--   ALTER TABLE public.agent_eval_runs DROP COLUMN IF EXISTS erros;
-- ═════════════════════════════════════════════════════════════════

-- ── 1. Versão do arnês e cenários não avaliáveis ─────────────────
ALTER TABLE public.agent_eval_runs
  ADD COLUMN IF NOT EXISTS "harness_version" INTEGER;

ALTER TABLE public.agent_eval_runs
  ADD COLUMN IF NOT EXISTS "erros" INTEGER;

-- ── 2. eval_regrades ─────────────────────────────────────────────
-- Uma linha por (execução, cenário) relido. run_id sem FK de domínio? Não:
-- a execução é o dono da regravação e apagar a execução apaga a leitura dela.
CREATE TABLE IF NOT EXISTS public.eval_regrades (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id"          TEXT NOT NULL,
    "agent_id"        TEXT NOT NULL,
    "scenario_id"     TEXT NOT NULL,
    -- 'critical' | 'high' | 'medium': a tela mostra os críticos primeiro
    "severity"        TEXT NOT NULL DEFAULT 'medium',
    -- 'pass' | 'partial' | 'fail' | 'erro' (o que a execução gravou na época)
    "veredito_antigo" TEXT NOT NULL,
    -- o mesmo vocabulário, relido pelo arnês desta linha
    "veredito_novo"   TEXT NOT NULL,
    -- em português, o que mudou e por quê (vai para a tela do fundador)
    "motivo"          TEXT NOT NULL,
    "harness_version" INTEGER NOT NULL,
    -- true quando a regra nova e o veredito gravado do juiz DISCORDAM. É o
    -- lote que o modo opcional --com-juiz reavalia, e o mesmo lote que o
    -- fundador rotula na calibração (P56).
    "discordante"     BOOLEAN NOT NULL DEFAULT false,
    -- true quando a regravação usou o juiz (modo --com-juiz), false quando foi
    -- só regra determinística. O padrão é sem juiz: custo zero.
    "com_juiz"        BOOLEAN NOT NULL DEFAULT false,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "eval_regrades_pkey" PRIMARY KEY ("id")
);

-- Uma leitura por (execução, cenário, versão do arnês): reexecutar a
-- regravação não duplica linha, substitui.
CREATE UNIQUE INDEX IF NOT EXISTS "eval_regrades_run_scenario_harness_key"
  ON public.eval_regrades("run_id", "scenario_id", "harness_version");

CREATE INDEX IF NOT EXISTS "eval_regrades_run_id_idx"
  ON public.eval_regrades("run_id");

CREATE INDEX IF NOT EXISTS "eval_regrades_agent_id_idx"
  ON public.eval_regrades("agent_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'eval_regrades_run_id_fkey'
  ) THEN
    ALTER TABLE public.eval_regrades
      ADD CONSTRAINT "eval_regrades_run_id_fkey"
      FOREIGN KEY ("run_id") REFERENCES public.agent_eval_runs("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── 3. RLS: nega tudo para quem não ignora RLS ───────────────────
-- Mesmo desenho da 20260715000004_rls_fecha_anon e da 20260914000030: RLS
-- LIGADA E SEM POLÍTICA. A API conecta como dono (rolbypassrls = true) e não
-- é afetada. A chave pública não tem uso legítimo nesta tabela.
ALTER TABLE public.eval_regrades ENABLE ROW LEVEL SECURITY;

-- REVOKE condicional: banco local de desenvolvimento não tem os papéis do
-- Supabase. Sem o IF, a migração quebraria fora do Supabase.
DO $$
DECLARE
  papel text;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated', 'app_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL ON public.eval_regrades FROM %I', papel);
    END IF;
  END LOOP;
END $$;
