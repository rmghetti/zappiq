-- Mira Prospects — índice local de CNPJ (2026-07-12) — ADITIVO e IDEMPOTENTE.
-- Base aberta da Receita Federal para descoberta B2B por CNAE/UF/situação,
-- sem depender de busca paga na web. Tabela COMPARTILHADA da plataforma
-- (dado público de registro, não é dado de tenant): SEM organizationId,
-- SEM RLS por tenant (mesmo raciocínio do BrasilAPI, que já é consultado
-- sem isolamento por org). Alimentada pelo job de ingestão (rodado no
-- servidor via .command), nunca por request de usuário.

CREATE TABLE IF NOT EXISTS "mira_cnpj_index" (
  "cnpj" TEXT NOT NULL,
  "razaoSocial" TEXT,
  "nomeFantasia" TEXT,
  "cnae" TEXT,
  "situacaoCadastral" TEXT,
  "municipio" TEXT,
  "uf" TEXT,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mira_cnpj_index_pkey" PRIMARY KEY ("cnpj")
);

CREATE INDEX IF NOT EXISTS "mira_cnpj_index_cnae_uf_situacaoCadastral_idx"
  ON "mira_cnpj_index"("cnae", "uf", "situacaoCadastral");
CREATE INDEX IF NOT EXISTS "mira_cnpj_index_uf_situacaoCadastral_idx"
  ON "mira_cnpj_index"("uf", "situacaoCadastral");

-- ─── GRANT condicional (prod baseline não tem app_user) ─────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "mira_cnpj_index" TO app_user;
  END IF;
END $$;
