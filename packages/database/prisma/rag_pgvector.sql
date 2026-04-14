-- ZappIQ RAG — pgvector schema
--
-- Rodar em producao APOS services/rag estar pronto pra ingestao real.
-- HNSW index requer PostgreSQL 16+ com pgvector 0.5+. Supabase ja tem.
--
-- CUSTO: HNSW index ~2x o tamanho dos vetores. Para 1M chunks de 1024 dim
-- float32: ~4GB de vetores + ~8GB de index. Monitorar.
--
-- LGPD: esta tabela contem conteudo de documentos uploadados, portanto sujeita
-- a DSR (Art. 18). Endpoint DELETE /ingest/{ns}/{source} remove o source inteiro.
-- Retencao padrao: alinhada com contrato do tenant (vide ADR-0003).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace    TEXT NOT NULL,                            -- 'org_<uuid>'
  source       TEXT NOT NULL,                            -- filename ou doc_id
  chunk_idx    INT  NOT NULL,                            -- ordem dentro do doc
  chunk_hash   TEXT NOT NULL,                            -- sha256(ns|source|idx|text)
  text         TEXT NOT NULL,
  embedding    vector(1024) NOT NULL,                    -- voyage-3 = 1024 dim
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (namespace, chunk_hash)
);

-- Filtro por namespace e obrigatorio em toda query (multi-tenancy)
CREATE INDEX IF NOT EXISTS rag_chunks_ns_idx
  ON rag_chunks (namespace);

-- Source + namespace: usado em DELETE /ingest/{ns}/{source}
CREATE INDEX IF NOT EXISTS rag_chunks_ns_source_idx
  ON rag_chunks (namespace, source);

-- HNSW cosine: compromisso padrao (recall ~0.98, latencia ~5ms em 100k vetores)
-- Alternativa: IVFFlat se memory pressure (recall menor mas index 5x menor)
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_hnsw_idx
  ON rag_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Trigger pra updated_at (padrao do resto do schema Prisma)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rag_chunks_updated_at ON rag_chunks;
CREATE TRIGGER rag_chunks_updated_at
  BEFORE UPDATE ON rag_chunks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: rag_chunks.namespace deve casar com jwt claim org_id
-- Ativar em sprint de rollout RLS (vide ADR-0001)
-- ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY rag_chunks_tenant_isolation ON rag_chunks
--   USING (namespace = 'org_' || current_setting('request.jwt.claims', true)::json->>'org_id');
