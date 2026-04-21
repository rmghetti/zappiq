-- ──────────────────────────────────────────────────────────────
-- Migration patch: extend PlanType enum with BUSINESS + ENTERPRISE
-- Aplicar em produção com:
--   psql "$DATABASE_URL" -f migrations_patch_2026_plans.sql
--
-- ALTER TYPE … ADD VALUE não pode rodar dentro de uma transação
-- em Postgres < 12. Por isso cada statement é autônomo.
-- ──────────────────────────────────────────────────────────────

-- Idempotente: só adiciona se o valor ainda não existir.
ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'BUSINESS';
ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'ENTERPRISE';

-- Após aplicar, rodar no app:
--   cd packages/database && pnpm prisma generate
-- para regenerar o client com os novos valores.
