-- ═════════════════════════════════════════════════════════════════
-- 20260914000060: o DDL de `signups` entra no repositório e as CHECK
-- passam a derivar do catálogo de planos (achado A242)
-- ─────────────────────────────────────────────────────────────────
-- POR QUE ESTA MIGRAÇÃO EXISTE
--
-- A tabela `signups` é escrita pelo apps/web (Supabase, fora do Prisma) e
-- por isso nunca teve DDL versionado. As duas CHECK dela ficaram paradas
-- num catálogo que o produto abandonou:
--
--   signups_plan_chosen_check     IN ('STARTER','GROWTH','SCALE','BUSINESS','ENTERPRISE')
--   signups_onboarding_path_check IN ('assisted','self_service')
--
-- A tela de cadastro pré-seleciona IZA_LITE desde 27/05/2026 e o produto
-- grava onboarding_path = 'wizard'. Medido em 14/09/2026: 6 tentativas de
-- cadastro com IZA_LITE, 6 erros "Erro ao registrar cadastro", 0 linhas com
-- IZA_LITE na história da tabela, 5 signups confirmados e nenhum ligado a
-- uma organização. Nenhum lead novo chegou ao Treinar IA em 60 dias.
--
-- A partir daqui as duas listas são derivadas de packages/shared
-- (SIGNUP_PLAN_CHOSEN_VALUES e ONBOARDING_PATHS) e um teste de catálogo no
-- CI (apps/api/src/db/signupsCatalogo.test.ts) varre as migrações e lê a
-- MAIS RECENTE que define `signups_plan_chosen_check`. Mudar o catálogo sem
-- mudar a migração quebra o CI, não a produção.
--
-- ATENÇÃO, quem for mudar o catálogo de planos ou de caminhos de
-- onboarding: mudança de catálogo é migração NOVA, nunca edição desta.
-- Migração já aplicada tem checksum guardado em `_prisma_migrations`, e o
-- `prisma migrate deploy` recusa a que mudou. Editar este arquivo para o
-- teste voltar a passar derruba o deploy da API. O teste acha a migração
-- nova sozinho.
--
-- O QUE ESTA MIGRAÇÃO FAZ
--   1. CREATE TABLE IF NOT EXISTS com o DDL completo (banco novo nasce
--      igual ao de produção; banco existente não é tocado).
--   2. ADD COLUMN IF NOT EXISTS de cada coluna, para o caso de uma base
--      antiga estar sem alguma delas.
--   3. Cria, só onde faltar, a unicidade de e-mail, a chave estrangeira
--      para auth.users e a CHECK de status. Em produção as três já existem
--      e os blocos não tocam em nada.
--   4. Troca as duas CHECK do catálogo: DROP CONSTRAINT IF EXISTS + ADD.
--   5. Religa a RLS e revoga privilégio de anon/authenticated.
--
-- IDEMPOTENTE: rodar duas vezes não muda nada e não falha.
-- NÃO DESTRUTIVA: nenhuma linha é apagada, nenhum tipo de coluna muda.
--   As CHECK novas são SUPERCONJUNTO das antigas: nada que já está gravado
--   passa a violar a restrição.
--
-- COMO PROVAR DEPOIS DE APLICAR (produção, pelo MCP do Supabase):
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = 'public.signups'::regclass AND contype = 'c';
--   -- plan_chosen deve listar IZA_LITE; onboarding_path deve listar wizard
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'signups';  -- t
--   SELECT has_table_privilege('anon','public.signups','SELECT');   -- false
--
-- REVERTER (não recomendado, volta o defeito):
--   ALTER TABLE public.signups DROP CONSTRAINT signups_plan_chosen_check;
--   ALTER TABLE public.signups DROP CONSTRAINT signups_onboarding_path_check;
-- ═════════════════════════════════════════════════════════════════

-- ── 1. DDL versionado ────────────────────────────────────────────
-- Este CREATE TABLE foi conferido contra a tabela REAL em 14/09/2026, pela
-- consulta de catálogo do Postgres. Antes disso ele havia sido escrito a
-- partir do código que lê e escreve a tabela, e divergia em cinco colunas,
-- cinco NOT NULL, a CHECK de status, a chave estrangeira para auth.users e
-- a forma da unicidade de e-mail. Num banco novo (preview, CI, máquina de
-- desenvolvimento) a tabela nascia diferente da de produção, que é o lugar
-- exato em que esse tipo de defeito passa batido.
CREATE TABLE IF NOT EXISTS public.signups (
    "id"                     UUID NOT NULL DEFAULT gen_random_uuid(),
    "email"                  TEXT NOT NULL,
    "name"                   TEXT NOT NULL,
    "company"                TEXT,
    "cnpj"                   TEXT,
    "plan_chosen"            TEXT NOT NULL,
    "onboarding_path"        TEXT,
    "status"                 TEXT NOT NULL DEFAULT 'pending_email',
    "supabase_user_id"       UUID,
    "organization_id"        TEXT,
    "confirmed_at"           TIMESTAMPTZ,
    -- O trial de 14 dias é contrato de produto, e em produção as três
    -- colunas dele são NOT NULL com default. Uma linha de signup nunca
    -- existe sem janela de teste definida.
    "trial_starts_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "trial_ends_at"          TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
    "card_required_at"       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
    -- Marcos de cobrança. Ficaram de fora da primeira versão deste arquivo.
    "card_added_at"          TIMESTAMPTZ,
    "paid_at"                TIMESTAMPTZ,
    "churned_at"             TIMESTAMPTZ,
    "stripe_customer_id"     TEXT,
    "stripe_subscription_id" TEXT,
    "utm_source"             TEXT,
    "utm_medium"             TEXT,
    "utm_campaign"           TEXT,
    "meta"                   JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at"             TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "signups_pkey" PRIMARY KEY ("id")
);

-- Base antiga pode estar sem alguma coluna. ADD IF NOT EXISTS é silencioso
-- quando a coluna já existe e não toca no tipo nem no default vigente.
--
-- De propósito, NENHUM destes ALTER impõe NOT NULL: numa tabela que já tem
-- linhas isso falharia e derrubaria o deploy. O NOT NULL vale para o banco
-- que nasce do CREATE acima; em produção as colunas já são o que devem ser.
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "name"                   TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "company"                TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "cnpj"                   TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "plan_chosen"            TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "onboarding_path"        TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "supabase_user_id"       UUID;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "organization_id"        TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "confirmed_at"           TIMESTAMPTZ;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "trial_starts_at"        TIMESTAMPTZ;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "trial_ends_at"          TIMESTAMPTZ;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "card_required_at"       TIMESTAMPTZ;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "card_added_at"          TIMESTAMPTZ;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "paid_at"                TIMESTAMPTZ;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "churned_at"             TIMESTAMPTZ;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "stripe_customer_id"     TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "stripe_subscription_id" TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "utm_source"             TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "utm_medium"             TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "utm_campaign"           TEXT;

-- Um e-mail, um cadastro. Em produção isto é uma CONSTRAINT UNIQUE sobre
-- (email), não um índice sobre lower(email): quem normaliza a caixa é a
-- aplicação, antes de gravar. O bloco só cria se ainda não existir, então
-- em produção ele não toca em nada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.signups'::regclass
       AND conname  = 'signups_email_key'
  ) THEN
    ALTER TABLE public.signups
      ADD CONSTRAINT "signups_email_key" UNIQUE ("email");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "signups_status_idx" ON public.signups ("status");
CREATE INDEX IF NOT EXISTS "signups_organization_id_idx" ON public.signups ("organization_id");
CREATE INDEX IF NOT EXISTS "signups_confirmed_at_idx" ON public.signups ("confirmed_at");

-- Índices que JÁ existem em produção (lidos de pg_indexes em 14/09/2026) e
-- nunca tiveram DDL no repositório. Entram aqui para o banco de preview e
-- de CI nascer igual ao de produção; lá o IF NOT EXISTS não toca em nada.
CREATE INDEX IF NOT EXISTS "signups_email_idx"
  ON public.signups ("email");
CREATE INDEX IF NOT EXISTS "signups_trial_ends_at_idx"
  ON public.signups ("trial_ends_at") WHERE "status" IN ('active', 'pending_email');
CREATE INDEX IF NOT EXISTS "signups_supabase_user_id_idx"
  ON public.signups ("supabase_user_id") WHERE "supabase_user_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "signups_stripe_customer_idx"
  ON public.signups ("stripe_customer_id") WHERE "stripe_customer_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_signups_utm_source"
  ON public.signups ("utm_source") WHERE "utm_source" IS NOT NULL;

-- Vínculo com o usuário do Supabase Auth. ON DELETE SET NULL de propósito:
-- apagar a conta de autenticação (direito do titular, LGPD) não pode apagar
-- o registro comercial do funil; o que some é o vínculo.
--
-- O schema `auth` é do Supabase e não existe em banco local nem no CI, então
-- o bloco checa antes de tentar. Sem isso, a migração quebraria fora da nuvem.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE NOTICE 'schema auth ausente: FK de supabase_user_id não criada (esperado fora do Supabase)';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.signups'::regclass
       AND conname  = 'signups_supabase_user_id_fkey'
  ) THEN
    ALTER TABLE public.signups
      ADD CONSTRAINT "signups_supabase_user_id_fkey"
      FOREIGN KEY ("supabase_user_id") REFERENCES auth.users ("id") ON DELETE SET NULL;
  END IF;
END $$;

-- ── 2. CHECK derivada do catálogo ────────────────────────────────
-- Lista gerada de packages/shared/src/signupContract.ts. Se você mudar uma
-- lista sem mudar a outra, signupsCatalogo.test.ts falha no CI.
--
-- NULL é aceito de propósito nas duas: o signup nasce antes de o lead
-- escolher o caminho, e uma linha antiga pode estar sem plano.
ALTER TABLE public.signups DROP CONSTRAINT IF EXISTS "signups_plan_chosen_check";
ALTER TABLE public.signups
  ADD CONSTRAINT "signups_plan_chosen_check"
  CHECK (
    plan_chosen IS NULL
    OR plan_chosen IN ('IZA_LITE','STARTER','GROWTH','SCALE','BUSINESS','ENTERPRISE')
  );

ALTER TABLE public.signups DROP CONSTRAINT IF EXISTS "signups_onboarding_path_check";
ALTER TABLE public.signups
  ADD CONSTRAINT "signups_onboarding_path_check"
  CHECK (
    onboarding_path IS NULL
    OR onboarding_path IN ('assisted','self_service','wizard')
  );

-- A CHECK de status NÃO é derrubada e recriada, ao contrário das duas de
-- cima. Ela já está correta em produção e recriá-la seria mexer no que
-- funciona: se alguma linha violasse a lista, o ADD falharia e derrubaria o
-- deploy da API. O bloco só cria onde ainda não existe (banco novo).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.signups'::regclass
       AND conname  = 'signups_status_check'
  ) THEN
    ALTER TABLE public.signups
      ADD CONSTRAINT "signups_status_check"
      CHECK (status IN ('pending_email','active','paid','churned','archived'));
  END IF;
END $$;

-- ── 3. RLS e privilégios ─────────────────────────────────────────
-- A tabela já tinha RLS ligada; isto é cinto e suspensório, no padrão de
-- 20260914000020_revoke_anon_public. O apps/web escreve com service_role,
-- que atravessa RLS; anon e authenticated não têm nada aqui.
ALTER TABLE public.signups ENABLE ROW LEVEL SECURITY;

-- REVOKE condicional, como em 20260914000030: banco local de desenvolvimento
-- não tem os papéis do Supabase, e sem o IF a migração quebraria fora dele.
DO $$
DECLARE
  papel text;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated', 'app_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL ON public.signups FROM %I', papel);
    END IF;
  END LOOP;
END $$;
