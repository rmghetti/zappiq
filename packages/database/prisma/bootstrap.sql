-- ─────────────────────────────────────────────────────────────────────────────
-- Bootstrap Script para Supabase
--
-- Execute UMA ÚNICA VEZ no SQL Editor do Supabase antes de rodar qualquer
-- migração Prisma (prisma migrate deploy ou prisma db push).
--
-- Instala extensões obrigatórias:
--   - uuid-ossp: geração de UUIDs via PostgreSQL
--   - vector: pgvector para armazenamento de embeddings
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
