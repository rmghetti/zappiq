-- ═════════════════════════════════════════════════════════════════
-- 20260914000060: as correções aprovadas viram REGISTRO, não texto colado
-- ─────────────────────────────────────────────────────────────────
-- POR QUE ESTA MIGRAÇÃO EXISTE
--
-- O fundador aprova a correção e o mesmo erro volta na execução seguinte.
-- A causa está no lugar onde a correção mora hoje: um trecho de texto colado
-- dentro de agents.system_prompt, por heurística.
--
--   A079  O trecho cai no lugar errado ("REGRA 13" foi parar dentro do bloco
--         da REGRA 1, oito vezes no prompt da Iza). Nos prompts de cliente
--         nenhum cabeçalho casa e tudo vira "# PATCH MANUAL" no fim.
--   A081  Nada impede aplicar de novo o MESMO cenário: a trava é por
--         execução, então toda semana o cliente pode colar outra versão da
--         mesma regra. A Iza foi de 16.302 para 26.898 caracteres em 30
--         aplicações, com cinco regras "#14" diferentes.
--   A083  Reverter regravava o prompt inteiro de antes e apagava tudo o que
--         veio depois.
--   A188  Metade das sugestões chegava cortada no meio e era colada assim.
--
-- Com a correção como REGISTRO:
--   • uma regra ATIVA por cenário (índice único parcial, é o banco que
--     garante, não a aplicação);
--   • aplicar de novo o mesmo cenário SUBSTITUI (a anterior vira
--     'substituida'), então o prompt não incha;
--   • reverter desativa SÓ aquele registro ('revertida'), sem tocar no
--     prompt nem nas outras regras;
--   • o bloco "# Regras aprovadas pelo dono" é montado a cada turno a partir
--     das regras ativas, atrás do interruptor `regrasComoRegistros`.
--
-- agent_eval_runs.fix_decision_id: o re-teste passa a ser execução GRAVADA
-- (A049: hoje ele roda 1 amostra e não deixa rastro nenhum), com 3 amostras
-- e ligada à decisão que motivou o re-teste.
--
-- COMO PROVAR DEPOIS DE APLICAR (produção, pelo MCP do Supabase):
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'agent_rules';            -- true
--   SELECT has_table_privilege('anon','public.agent_rules','SELECT');             -- false
--   SELECT has_table_privilege('authenticated','public.agent_rules','SELECT');    -- false
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'agent_eval_runs' AND column_name = 'fix_decision_id';    -- 1 linha
--   -- duas regras ativas para o mesmo cenário têm de ser IMPOSSÍVEIS:
--   SELECT agent_id, scenario_id, count(*) FROM agent_rules
--    WHERE status = 'ativa' AND scenario_id IS NOT NULL
--    GROUP BY 1,2 HAVING count(*) > 1;                                            -- 0 linhas
--
-- IDEMPOTENTE: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- CREATE INDEX IF NOT EXISTS, REVOKE condicional. Rodar duas vezes não muda
-- nada.
--
-- NÃO DESTRUTIVA: só acrescenta. Nenhum prompt é reescrito por esta
-- migração, nenhuma coluna existente muda de tipo. A importação dos
-- "# PATCH MANUAL" que já estão gravados é feita depois, pelo script
-- apps/api/scripts/migrarPatchesParaRegistros.ts, com prévia e aprovação.
--
-- REVERTER:
--   DROP TABLE IF EXISTS public.agent_rules;
--   ALTER TABLE public.agent_eval_runs DROP COLUMN IF EXISTS fix_decision_id;
-- ═════════════════════════════════════════════════════════════════

-- ── 1. agent_rules ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_rules (
    "id"                          UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id"             TEXT NOT NULL,
    "agent_id"                    TEXT NOT NULL,
    -- Cenário do gabarito que a regra corrige. NULL = regra escrita à mão
    -- pelo dono, sem cenário: essas podem conviver, não são substituídas.
    "scenario_id"                 TEXT,
    "texto"                       TEXT NOT NULL,
    -- 'sugestao_ia' (aprovada como veio) | 'editada' (o dono mudou o texto)
    -- | 'manual' (escrita do zero pelo dono ou pela migração dos patches)
    "origem"                      TEXT NOT NULL,
    -- 'ativa' | 'substituida' | 'revertida'
    "status"                      TEXT NOT NULL DEFAULT 'ativa',
    -- Por que saiu de 'ativa', em português: 'substituida_por_nova',
    -- 'revertida_pelo_dono', 'truncada'. Vai para a tela e para o relatório
    -- da migração.
    "motivo"                      TEXT,
    -- Versão de agent_prompt_versions vigente quando a regra nasceu.
    "versao_do_prompt_de_origem"  INTEGER,
    -- Decisão de correção (agent_eval_fix_decisions) que criou esta regra.
    -- Sem FK de propósito: a decisão pode ser expurgada por LGPD e a regra
    -- que o dono aprovou continua valendo.
    "decision_id"                 TEXT,
    "created_by"                  TEXT,
    "created_at"                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"                  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "agent_rules_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_rules_agent_id_fkey'
  ) THEN
    ALTER TABLE public.agent_rules
      ADD CONSTRAINT "agent_rules_agent_id_fkey"
      FOREIGN KEY ("agent_id") REFERENCES public.agents("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- UMA regra ativa por cenário. É este índice que impede o acúmulo do A081:
-- aplicar de novo o mesmo cenário tem de SUBSTITUIR, e se o código esquecer,
-- o banco recusa. Parcial porque regra sem cenário (escrita à mão) pode ter
-- várias, e porque 'substituida'/'revertida' são histórico.
CREATE UNIQUE INDEX IF NOT EXISTS "agent_rules_ativa_por_cenario_key"
  ON public.agent_rules("agent_id", "scenario_id")
  WHERE "status" = 'ativa' AND "scenario_id" IS NOT NULL;

-- Leitura do turno: todas as regras ativas da organização, na ordem em que
-- entraram. É a consulta do montador do prompt.
CREATE INDEX IF NOT EXISTS "agent_rules_org_status_idx"
  ON public.agent_rules("organization_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "agent_rules_agent_idx"
  ON public.agent_rules("agent_id", "status");

CREATE INDEX IF NOT EXISTS "agent_rules_decision_idx"
  ON public.agent_rules("decision_id");

-- ── 2. Re-teste vira execução gravada e ligada à decisão ─────────
ALTER TABLE public.agent_eval_runs
  ADD COLUMN IF NOT EXISTS "fix_decision_id" TEXT;

CREATE INDEX IF NOT EXISTS "agent_eval_runs_fix_decision_idx"
  ON public.agent_eval_runs("fix_decision_id");

-- ── 3. RLS: nega tudo para quem não ignora RLS ───────────────────
-- Mesmo desenho da 20260715000004_rls_fecha_anon e da 20260914000050: RLS
-- LIGADA E SEM POLÍTICA. A API conecta como dono (rolbypassrls = true) e não
-- é afetada. A chave pública não tem uso legítimo nesta tabela: regra do
-- agente é comportamento de produto, não dado de tela pública.
ALTER TABLE public.agent_rules ENABLE ROW LEVEL SECURITY;

-- REVOKE condicional: banco local de desenvolvimento não tem os papéis do
-- Supabase. Sem o IF, a migração quebraria fora do Supabase.
DO $$
DECLARE
  papel text;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated', 'app_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL ON public.agent_rules FROM %I', papel);
    END IF;
  END LOOP;
END $$;
