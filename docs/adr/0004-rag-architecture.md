# ADR-0004: RAG architecture — chunking, embeddings e isolamento multi-tenant

**Status:** Accepted
**Date:** 2026-04-14
**Author:** Engenharia de Plataforma

## Contexto

O ZappIQ opera como SaaS multi-tenant servindo dezenas de organizações (tenants), cada uma com bases de conhecimento privadas (FAQs, manuais de produto, scripts de atendimento, políticas internas). O motor de RAG precisa:

1. Ingerir documentos heterogêneos (PDF, TXT, MD) com latência aceitável
2. Recuperar contexto relevante para o LLM de atendimento em <200ms p95
3. Garantir isolamento absoluto entre tenants (vazamento cross-tenant = incidente LGPD)
4. Custo de embedding + armazenamento compatível com ticket médio (hoje ~R$0,08/conversa)
5. Suportar DSR (Art. 18 LGPD): deletar tudo que pertence a um contato/tenant

## Decisões

### 1. Stack: Python FastAPI + Voyage AI + pgvector (HNSW)

**Voyage AI como embedding primário**, OpenAI como fallback configurável via `EMBEDDING_PROVIDER=openai`.

Racional Voyage:
- Modelo `voyage-3` tem contexto 32k (vs 8k do OpenAI small) — menos chunking agressivo
- 1024 dimensões (vs 1536 OpenAI) — 33% menos storage e memória no índice
- Multilingual nativo com foco em PT-BR (nossa base de tenants é 90% Brasil)
- Custo por 1M tokens 40% menor que OpenAI text-embedding-3-small no benchmark interno
- Suporta `input_type` ("document"/"query") — otimização assimétrica comprovada melhora recall ~4%

Manter OpenAI como fallback cobre disaster recovery: se Voyage cair, um `fly secrets set EMBEDDING_PROVIDER=openai EMBEDDING_MODEL=text-embedding-3-small EMBEDDING_DIM=1536` restaura operação (requer re-ingestão para consistência de dimensionalidade).

### 2. Chunking: 512 tokens com overlap 64

Chunk size escolhido após benchmark com corpus interno de 120 documentos de FAQ bancário/telecom:

| Chunk size | Recall@5 | Custo embedding (R$/1k docs) | Latência p95 ingestão |
|------------|----------|-----------------------------|-----------------------|
| 256        | 0.81     | R$0,42                      | 4.2s                  |
| **512**    | **0.89** | **R$0,21**                  | **2.1s**              |
| 1024       | 0.87     | R$0,11                      | 1.3s                  |
| 2048       | 0.82     | R$0,06                      | 0.9s                  |

512 tokens oferece o melhor recall/custo. Abaixo de 512, fragmentação semântica degrada recall. Acima, chunks muito largos diluem similarity.

Overlap de 64 tokens (12.5%) preserva contexto entre chunks sem inflar storage proibitivamente. Sem overlap, recall cai para 0.84.

Chunking é por **tokens** (tiktoken cl100k_base), não por caracteres. Isso previne estouros de contexto no embed batch e dá sizing consistente independente de idioma (português tem ~1.3 chars/token, chinês ~1.7).

### 3. Índice HNSW, não IVFFlat

pgvector oferece IVFFlat (menor, mais lento) e HNSW (maior, mais rápido). Escolhemos HNSW com `m=16, ef_construction=64`:

- Recall@5 ≥ 0.97 em benchmarks públicos (BEIR, MTEB)
- Latência p95 <5ms para 100k vetores em shared-cpu-1x
- Build time aceitável até ~5M vetores (nosso horizonte de 3 anos)
- Memória: ~1.2GB por 100k vetores (vs ~600MB IVFFlat)

Quando cruzarmos 5M vetores por organização, revisitar: possível migração para vector DB dedicado (Qdrant/Weaviate) ou sharding por tenant.

### 4. Multi-tenancy: `namespace` obrigatório + UNIQUE constraint

Toda linha em `rag_chunks` tem coluna `namespace TEXT NOT NULL` no formato `org_<uuid>`. Duas camadas de proteção:

**Camada aplicação:**
- Endpoint `/query` exige `namespace` no body, retorna 400 se vazio
- Endpoint `/ingest` exige `namespace` no form data
- Query SQL sempre filtra `WHERE namespace = $1` antes do ORDER BY embedding

**Camada banco (sprint 2):**
- RLS habilitado em `rag_chunks` com política que casa `namespace` contra `jwt.claims.org_id`
- Mesmo que app Node tenha bug e não envie filtro, Postgres rejeita

Vide ADR-0001 para rollout RLS em staging antes de prod.

### 5. Idempotência: `UNIQUE (namespace, chunk_hash)`

`chunk_hash = sha256(namespace|source|chunk_idx|text)`. Re-ingestão do mesmo documento:
- Se conteúdo não mudou → `ON CONFLICT DO NOTHING`, sem re-embed (economiza Voyage tokens)
- Se conteúdo mudou → hash muda, novo row é inserido, antigo fica até cleanup

Chunks órfãos (`source` antigo que não existe mais no doc atual) são limpos por job BullMQ `rag-cleanup-stale` rodando semanalmente. Trade-off: custo extra de storage até a próxima execução vs complexidade de tracking por versão.

### 6. DSR (LGPD Art. 18): DELETE por namespace+source

Endpoint `DELETE /ingest/{namespace}/{source}` remove todos os chunks de um source. Usado em dois fluxos:

- **Usuário remove documento da KB**: DELETE direto do app Node via REST
- **DSR "delete-me"**: job busca todos os sources do contato/organização e enfileira deletes

Não há cascade para audit logs — esses seguem ADR-0003 (anonymize, not delete).

### 7. Fallback e degradação graciosa

Quando Voyage/OpenAI estão indisponíveis:
- `/embed` retorna 503 (nunca cache stale de vetores)
- `/query` retorna 503 com header `Retry-After: 30`
- Worker BullMQ faz backoff exponencial (attempts=3)
- App Node tem fallback para resposta do LLM sem RAG (degraded mode) — prompt instrui Claude a dizer "não tenho contexto específico sobre isso" ao invés de alucinar

## Consequências

### Positivas
- Latência p95 consultaRAG <150ms em 100k vetores (medido em staging)
- Custo médio ~R$0,004 por conversa com 3 consultas RAG (Voyage voyage-3)
- Isolamento multi-tenant resistente a bugs de aplicação (quando RLS ativado)
- DSR compliance: deleção em <1s, irreversível

### Negativas
- Re-ingestão obrigatória se trocarmos dimensionalidade (Voyage 1024 ↔ OpenAI 1536)
- HNSW usa ~2x memória vs IVFFlat — monitorar crescimento de Supabase plan
- Dependência crítica em Voyage AI (provider jovem, <3 anos no mercado) — daí ter fallback pronto

### Riscos mitigados
- **Vazamento cross-tenant**: 2 camadas (app + RLS) + test suite obrigatória em `apps/api/tests/rag.multitenant.test.ts` que tenta query com `org_A` token buscando dados de `org_B`
- **Voyage AI bloqueio/fim de vida**: fallback OpenAI sem mudança de código (só env var + re-ingestão)
- **Drift de modelo**: versão do modelo gravada em `metadata` de cada chunk; queries podem rejeitar chunks de modelo descontinuado

## Alternativas consideradas

### Pinecone / Qdrant / Weaviate Cloud
Rejeitado no primeiro momento: adiciona um vendor crítico, dobra surface de compliance (LGPD outside-Brazil transfer), e nosso volume (<1M vetores total) não justifica. Revisitar quando cruzar 5M vetores.

### Full-text search + reranker em vez de embeddings
Testado como baseline: PostgreSQL FTS + Cohere rerank. Recall@5 = 0.71 (vs 0.89 de pgvector). Descartado para atendimento onde precisão do contexto é crítica. Útil como fallback offline mas não como primário.

### ElasticSearch com dense_vector
Custo operacional alto (cluster dedicado) sem ganho claro sobre pgvector para nosso tamanho. Postgres unificado reduz pontos de falha.

### Chunking semântico (por parágrafo/seção)
Mais preciso em documentos bem estruturados, mas frágil com PDFs mal formatados (grande parte dos nossos uploads). Abandonado em favor de token-based fixed-size. Reconsiderar quando tivermos NLP de estrutura confiável.

## Referências

- services/rag/main.py (implementação)
- packages/database/prisma/rag_pgvector.sql (schema)
- ADR-0001 (RLS multi-tenant)
- ADR-0003 (audit retention — padrão de anonimização aplicável a DSR)
- Voyage AI docs: https://docs.voyageai.com/docs/embeddings
- pgvector HNSW: https://github.com/pgvector/pgvector#hnsw
