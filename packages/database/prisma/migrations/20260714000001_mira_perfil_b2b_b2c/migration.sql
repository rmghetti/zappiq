-- Mira Prospects — Perfil de Prospecção condicional B2B/B2C (2026-07-14).
-- IDEMPOTENTE, no estilo da 20260711000001_mira_prospects.
--
-- O formulário deixou de ser um molde só (todo voltado a B2B) e virou uma
-- união discriminada por "tipoCliente": os campos de alvo B2B e B2C não se
-- misturam mais no mesmo nível. Entram também os campos de qualificação do
-- bloco comum e a procedência do auto-preenchimento.
--
-- CUIDADO: os DROP abaixo perdem dado. Rodamos sem backfill porque
-- "mira_perfis" está VAZIA (0 linhas em produção, conferido em 14/07/2026):
-- nenhum cliente chegou a salvar um perfil. Antes de aplicar em qualquer
-- outro ambiente, conferir com:  SELECT count(*) FROM "mira_perfis";
--
-- RLS, policy de tenant e GRANT já vieram da migração original e continuam
-- valendo — aqui só mexemos em colunas.

-- ─── Discriminador: "modo" → "tipoCliente" ──────────────────────────────
DO $$ BEGIN
  IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'mira_perfis' AND column_name = 'modo'
     ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'mira_perfis' AND column_name = 'tipoCliente'
     )
  THEN
    ALTER TABLE "mira_perfis" RENAME COLUMN "modo" TO "tipoCliente";
  END IF;
END $$;

-- ─── Bloco comum: campos novos de qualificação ──────────────────────────
-- "ticketMedio" é TEXT (faixa livre: "R$ 5k–15k/mês"), não número. O antigo
-- ticket por item do catálogo era numérico, nunca chegou a ser exibido e sai
-- junto com o resto do molde antigo (mudança de shape do JSONB, sem DDL).
ALTER TABLE "mira_perfis"
  ADD COLUMN IF NOT EXISTS "doresResolvidas"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "resultadosEsperados" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "casosDeUso"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "ticketMedio"         TEXT;

-- ─── Alvo: os dois caminhos, lado a lado ────────────────────────────────
-- Guardamos B2B e B2C ao mesmo tempo de propósito: só o do "tipoCliente"
-- vale, mas assim o cliente não perde o que digitou ao alternar.
ALTER TABLE "mira_perfis"
  ADD COLUMN IF NOT EXISTS "alvoB2B" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "alvoB2C" JSONB NOT NULL DEFAULT '{}';

-- Não guardamos procedência do auto-preenchimento: o selo "sugerido" vive na
-- sessão da tela. Depois que o cliente revisa e salva, o dado é dele — marcar
-- para sempre o que a plataforma chutou primeiro não serve a ninguém.

-- ─── Molde antigo: sai ──────────────────────────────────────────────────
-- "icpFirmografia" e "icpB2c" viraram "alvoB2B"/"alvoB2C";
-- "areasCompradoras" virou "alvoB2B"."decisor".
ALTER TABLE "mira_perfis"
  DROP COLUMN IF EXISTS "icpFirmografia",
  DROP COLUMN IF EXISTS "icpB2c",
  DROP COLUMN IF EXISTS "areasCompradoras";
