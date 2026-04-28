-- ═════════════════════════════════════════════════════════════════════
-- V2-019 · kb_chunks.embedding vector(1536) → vector(1024)
-- (Sprint 0 Blocker 5 — Plano Iza V2.0 §2.2)
-- ─────────────────────────────────────────────────────────────────────
-- CONTEXTO:
--   Conflito histórico documentado na auditoria de 27/04 (cowork_response):
--     - KBChunk (Prisma) declarava vector(1536) — compatível com OpenAI
--       text-embedding-3-small.
--     - rag_chunks (SQL puro, em uso real pelo serviço RAG Python)
--       declara vector(1024) — compatível com Voyage voyage-3.
--   Auditoria de uso confirmou: nenhum código no monorepo Node
--   (apps/api, apps/web, packages/*) lê ou escreve em kb_chunks. É
--   schema legacy. Real RAG está em rag_chunks (Python).
--
-- DECISÃO (Plano §5.1 + ADR docs/architecture/embeddings.md):
--   Embedder canônico = Voyage voyage-3, 1024 dimensões.
--   kb_chunks.embedding alinhada para vector(1024) — caso seja usada
--   no futuro (ex.: ingestão Node-side em vez de Python), respeita o
--   canônico desde o início.
--
-- SAFETY:
--   1. Verifica COUNT(*) > 0 e aborta com erro claro se houver dados —
--      reembedding manual seria necessário (Voyage 1024d ≠ OpenAI 1536d).
--   2. Idempotente: se embedding já é vector(1024), pula sem erro.
--   3. pgvector valida dimensão na inserção (vector(1024) rejeita
--      vetor com dim diferente). CHECK constraint adicional seria
--      redundante.
--
-- ROLLBACK:
--   Não há — uma vez aplicado, voltar pra 1536 exigiria reembed completo
--   da KB. Decisão registrada em ADR; mudança requer nova ADR.
-- ═════════════════════════════════════════════════════════════════════

DO $migration$
DECLARE
  v_count   integer;
  v_dim     integer;
BEGIN
  -- 1. Detectar dimensão atual da coluna (se existir)
  SELECT atttypmod
    INTO v_dim
    FROM pg_attribute
   WHERE attrelid = 'public.kb_chunks'::regclass
     AND attname = 'embedding'
     AND NOT attisdropped;

  IF v_dim IS NULL THEN
    RAISE NOTICE 'kb_chunks.embedding não existe — criando como vector(1024)';
    ALTER TABLE public.kb_chunks ADD COLUMN embedding vector(1024);
    RETURN;
  END IF;

  -- pgvector codifica a dimensão em atttypmod; checar se já é 1024
  IF v_dim = 1024 THEN
    RAISE NOTICE 'kb_chunks.embedding já é vector(1024) — migration idempotente, nada a fazer';
    RETURN;
  END IF;

  -- 2. Há dados? Se sim, abortar pra evitar perda silenciosa
  SELECT COUNT(*) INTO v_count FROM public.kb_chunks WHERE embedding IS NOT NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION
      'kb_chunks tem % linhas com embedding não-nulo (dimensão atual: %). '
      'Migration ABORTADA pra evitar perda silenciosa. Ações:'
      ' (a) reembedar com Voyage voyage-3 antes de re-rodar, OU'
      ' (b) DELETE FROM kb_chunks; (validar com Produto que pode dropar)',
      v_count, v_dim;
  END IF;

  -- 3. Drop + recreate da coluna (mais simples e seguro que tentar
  -- ALTER TYPE com vetor não-vazio — pgvector não suporta cast direto
  -- entre dimensões diferentes).
  ALTER TABLE public.kb_chunks DROP COLUMN embedding;
  ALTER TABLE public.kb_chunks ADD COLUMN embedding vector(1024);

  RAISE NOTICE 'kb_chunks.embedding migrada de vector(%) para vector(1024)', v_dim;
END
$migration$;

-- 4. Comentários documentais (ficam atrelados ao schema pra introspect)
COMMENT ON COLUMN public.kb_chunks.embedding IS
  'Embedding Voyage voyage-3 (1024 dimensões). Canônico via ADR docs/architecture/embeddings.md. Mudar dimensão requer nova ADR + reembed.';
