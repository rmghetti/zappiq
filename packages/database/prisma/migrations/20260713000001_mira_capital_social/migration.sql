-- Mira Prospects — capital social do Alvo (2026-07-13) — ADITIVO e IDEMPOTENTE.
-- Capital social declarado (R$) da empresa, dado público de registro (Receita,
-- via BrasilAPI). Sinal de "porte real por empresa" usado no Mira Score, no
-- lugar do porte enum autodeclarado. Coluna nullable: Alvos antigos ficam null.
ALTER TABLE "mira_alvos" ADD COLUMN IF NOT EXISTS "capitalSocial" DOUBLE PRECISION;
