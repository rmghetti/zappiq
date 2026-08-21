-- Resposta Meta out/2026 (PR-L, 20/08/2026): enum PlanType ganha os valores
-- da grade nova (IZA_LITE e ESSENCIAL). Migração ADITIVA e segura: nenhuma
-- linha existente muda, nenhum valor é removido ou renomeado.
-- Fonte da decisão: docs/resposta-meta-2026/PLANO-RESPOSTA-META.md

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlanType" ADD VALUE 'IZA_LITE';
ALTER TYPE "PlanType" ADD VALUE 'ESSENCIAL';
