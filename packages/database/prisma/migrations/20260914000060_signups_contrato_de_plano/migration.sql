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
-- CI (apps/api/src/db/signupsCatalogo.test.ts) lê ESTE arquivo e falha se
-- alguma lista divergir. Mudar o catálogo sem mudar a migração quebra o CI,
-- não a produção.
--
-- O QUE ESTA MIGRAÇÃO FAZ
--   1. CREATE TABLE IF NOT EXISTS com o DDL completo (banco novo nasce
--      igual ao de produção; banco existente não é tocado).
--   2. ADD COLUMN IF NOT EXISTS de cada coluna, para o caso de uma base
--      antiga estar sem alguma delas.
--   3. Troca as duas CHECK: DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT.
--   4. Religa a RLS e revoga privilégio de anon/authenticated.
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
CREATE TABLE IF NOT EXISTS public.signups (
    "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
    "email"            TEXT NOT NULL,
    "name"             TEXT,
    "company"          TEXT,
    "cnpj"             TEXT,
    "plan_chosen"      TEXT,
    "onboarding_path"  TEXT,
    "status"           TEXT NOT NULL DEFAULT 'pending_email',
    "supabase_user_id" UUID,
    "organization_id"  TEXT,
    "confirmed_at"     TIMESTAMPTZ,
    "trial_starts_at"  TIMESTAMPTZ,
    "trial_ends_at"    TIMESTAMPTZ,
    "card_required_at" TIMESTAMPTZ,
    "utm_source"       TEXT,
    "utm_medium"       TEXT,
    "utm_campaign"     TEXT,
    "meta"             JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "signups_pkey" PRIMARY KEY ("id")
);

-- Base antiga pode estar sem alguma coluna. ADD IF NOT EXISTS é silencioso
-- quando a coluna já existe e não toca no tipo nem no default vigente.
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "name"             TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "company"          TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "cnpj"             TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "plan_chosen"      TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "onboarding_path"  TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "supabase_user_id" UUID;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "organization_id"  TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "confirmed_at"     TIMESTAMPTZ;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "trial_starts_at"  TIMESTAMPTZ;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "trial_ends_at"    TIMESTAMPTZ;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "card_required_at" TIMESTAMPTZ;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "utm_source"       TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "utm_medium"       TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS "utm_campaign"     TEXT;

-- Um e-mail, um cadastro: o /api/signup e o /auth/callback já tratam a
-- tabela assim (SELECT por email + INSERT ou UPDATE).
CREATE UNIQUE INDEX IF NOT EXISTS "signups_email_key" ON public.signups (lower("email"));
CREATE INDEX IF NOT EXISTS "signups_status_idx" ON public.signups ("status");
CREATE INDEX IF NOT EXISTS "signups_organization_id_idx" ON public.signups ("organization_id");
CREATE INDEX IF NOT EXISTS "signups_confirmed_at_idx" ON public.signups ("confirmed_at");

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
