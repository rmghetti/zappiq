-- ═════════════════════════════════════════════════════════════════
-- 20260914000070: o pré-filtro passa a deixar registro consultável
-- ─────────────────────────────────────────────────────────────────
-- POR QUE ESTA TABELA EXISTE
--
-- O pré-filtro determinístico roda antes de qualquer LLM, em todo turno de
-- WhatsApp, Instagram e Testar minha IA, para TODA organização. Quando ele
-- disparava, o único rastro era um logger.info: nenhum evento consultável,
-- nenhum aviso ao dono, nenhuma marca na conversa (achados A251 e A232). O
-- dono nunca soube que o cliente final dele levou uma recusa.
--
-- Com a rede de crise (P62) isso deixou de ser aceitável: o disparo mais
-- importante do produto não pode existir só no log de um contêiner que
-- reinicia.
--
-- O QUE NÃO ENTRA AQUI, DE PROPÓSITO
--
-- O TEXTO DA MENSAGEM. Indício de risco à vida é dado sensível de saúde
-- (LGPD art. 5º II e art. 11) e não tem por que ser duplicado fora da
-- conversa. O registro guarda a REGRA que casou, o canal e o que foi feito.
-- Quem precisa do conteúdo abre a conversa no Inbox, onde ela já está, com
-- o controle de acesso que já existe.
--
-- COMO PROVAR DEPOIS DE APLICAR (produção, pelo MCP do Supabase):
--   SELECT relrowsecurity FROM pg_class WHERE relname='prefilter_events'; -- t
--   SELECT has_table_privilege('anon','public.prefilter_events','SELECT'); -- false
--   SELECT categoria, acao, count(*) FROM prefilter_events GROUP BY 1,2;
--
-- IDEMPOTENTE: CREATE TABLE IF NOT EXISTS, índices IF NOT EXISTS, FK dentro
-- de um IF NOT EXISTS. NÃO DESTRUTIVA: só cria.
-- REVERTER: DROP TABLE IF EXISTS public.prefilter_events;
-- ═════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.prefilter_events (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    -- 'whatsapp' | 'instagram' | 'site' | 'playground'
    "canal"           TEXT NOT NULL,
    -- 'crise' | 'compliance' | 'politica-comercial-zappiq'
    "categoria"       TEXT NOT NULL,
    -- id da regra de crise, ou nome da vertical bloqueada
    "regra"           TEXT NOT NULL,
    -- 'acolhimento' | 'transbordo' | 'recusa'
    "acao"            TEXT NOT NULL,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "prefilter_events_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prefilter_events_organization_id_fkey'
  ) THEN
    ALTER TABLE public.prefilter_events
      ADD CONSTRAINT "prefilter_events_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES public.organizations("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "prefilter_events_organization_id_created_at_idx"
  ON public.prefilter_events ("organization_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "prefilter_events_categoria_idx"
  ON public.prefilter_events ("categoria");
CREATE INDEX IF NOT EXISTS "prefilter_events_conversation_id_idx"
  ON public.prefilter_events ("conversation_id");

-- RLS LIGADA E SEM POLÍTICA, mesmo desenho de 20260914000030: a API conecta
-- como postgres (dono, rolbypassrls) e não é afetada; a chave pública não
-- tem uso legítimo aqui.
ALTER TABLE public.prefilter_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  papel text;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated', 'app_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL ON public.prefilter_events FROM %I', papel);
    END IF;
  END LOOP;
END $$;
