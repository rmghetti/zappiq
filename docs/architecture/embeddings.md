# ADR-0005 — Embeddings: Voyage voyage-3 (1024 dim) como canônico

**Status:** Aceita
**Decisão tomada em:** 2026-04-27 (Sprint 0 Blocker 5)
**Versão:** V2-019
**Substitui:** sem ADR anterior (decisão era implícita e divergia entre `KBChunk` e `rag_chunks`)

## 1. Contexto

A auditoria do monorepo em 27/04/2026 (`docs/audit/cowork_response_2026-04-27.md` §5.3) identificou conflito explícito de schema de embeddings:

| Tabela | Local | Dimensão | Compatível com |
|---|---|---|---|
| `KBChunk` | Prisma `schema.prisma` | `vector(1536)` | OpenAI `text-embedding-3-small` |
| `rag_chunks` | SQL puro `rag_pgvector.sql` | `vector(1024)` | Voyage `voyage-3` |

`rag_chunks` é a tabela em uso real pelo serviço Python `services/rag` que executa todas as ingestões e queries via Voyage. `KBChunk` no Prisma é legacy de quando o plano usava OpenAI embeddings — nenhum código no monorepo Node lê ou escreve nela hoje (`grep -r "kBChunk\|KBChunk" apps/ packages/` retorna zero callsites de runtime).

A coexistência é um risco silencioso: se alguém futuro fizer ingestão Node-side em `KBChunk` esperando que fosse a tabela do RAG, vai gerar vetores com dimensão errada e poluir queries cross-tabela.

## 2. Decisão

**Embedder canônico para todas as tabelas vetoriais da plataforma:**

- **Modelo:** Voyage AI `voyage-3`
- **Dimensão:** **1024**
- **Distância:** cosine
- **Índice:** HNSW (`m=16`, `ef_construction=64`)
- **Tipo de input:** `query` (queries) / `document` (chunks de KB)

**Aplicação:**
- `rag_chunks` (Python RAG) — já está conforme (1024d).
- `KBChunk` (Prisma) — alinhada via migration `20260427_kbchunk_vector_1024` (drop column + add column vector(1024); falha se houver dados existentes).

**Provider de fallback (apenas no serviço Python, em caso de degradação Voyage):** OpenAI `text-embedding-3-small` truncado para 1024d via parâmetro `dimensions=1024` na API. Cuidado: `text-embedding-3-large` (3072d) NÃO é fallback — dimensões diferentes não são intercambiáveis.

## 3. Justificativas

### 3.1 Por que Voyage voyage-3 (não OpenAI)
- **Qualidade pt-BR superior** em benchmarks MTEB (Voyage publica scores específicos por idioma).
- **Custo competitivo**: $0.18/1M tokens (vs $0.13 OpenAI text-embedding-3-small) — diferença irrelevante no volume da ZappIQ.
- **Independência de vendor LLM**: já usamos Anthropic primário no LLM; ter embeddings em outro provider reduz blast radius de outage.
- **Especialização**: Voyage é focado em embeddings/retrieval, OpenAI é generalista.

### 3.2 Por que 1024 dimensões (não 1536, não 3072)
- **Memória**: 1024 floats × 4 bytes = 4 KB/vetor; 1536 = 6 KB; 3072 = 12 KB. Em escala de 100k chunks/tenant, a diferença é material (400 MB vs 600 MB vs 1.2 GB de RAM em índice HNSW).
- **Qualidade**: voyage-3 a 1024d entrega recall@10 ≈ 0.97 em queries pt-BR (próprio benchmark Voyage). Acima de 1024 o ganho marginal é ~1pp e não justifica o custo de armazenamento.
- **Latência HNSW**: índice menor = busca mais rápida. Em 100k vetores, query p95 < 5ms a 1024d vs ~8ms a 3072d.

### 3.3 Por que migration drop-and-recreate (não ALTER TYPE)
- pgvector não suporta `ALTER COLUMN ... TYPE vector(N)` quando N muda — exige cast manual que não existe entre dimensões diferentes (faz sentido: você está descartando informação, não convertendo).
- Solução standard: `DROP COLUMN` + `ADD COLUMN`. Migration aborta com erro claro se houver dados existentes — força reembedding manual antes de re-rodar.

## 4. Alternativas avaliadas

| Alternativa | Pró | Contra | Decisão |
|---|---|---|---|
| OpenAI `text-embedding-3-small` (1536d) | Stack uniforme com fallback LLM | pior em pt-BR; mais memória; depende mesmo provider | Rejeitada |
| OpenAI `text-embedding-3-large` (3072d) | Melhor qualidade absoluta | 3x memória, latência maior, custo 6.5x | Rejeitada |
| BAAI `bge-m3` (1024d, multilíngue) | Open-source, pode rodar self-hosted | infra de inferência adicional, sem benchmark dedicado pt-BR | Adiada (revisitar Q4 se Voyage subir preço) |
| Cohere `embed-multilingual-v3.0` (1024d) | Bom em pt-BR | preço mais alto; sem vantagem clara sobre Voyage | Rejeitada |

## 5. Consequências

### Positivas
- **Schema único** de embeddings em toda plataforma.
- **CI lint** (a adicionar em Onda 2) bloqueia PRs que importem OpenAI embeddings sem ADR-override explícito.
- Onda 2/3 do roadmap RAG (Plano §5.2 — hybrid search, Cohere Rerank, Contextual Retrieval) podem assumir 1024d.

### Negativas
- Vendor lock-in com Voyage — mitigado pelo fallback OpenAI no Python.
- Migration destrutiva (drop column) — aceitável porque KBChunk está vazia.

### Neutras
- `KBChunk` continua sendo legacy (não está no caminho de leitura/escrita do Node). Decisão de remover ou usar fica pra Q3 (junto com builder self-service que pode optar por ingestão Node).

## 6. Política de mudança

Mudar a dimensão ou o modelo de embeddings **requer:**

1. Nova ADR aprovada substituindo esta.
2. Migration de reembedding completa (não apenas ALTER TYPE — pgvector não cast entre dimensões).
3. Janela de manutenção comunicada (RAG fica indisponível durante reembed).
4. Backup de embeddings antigos antes da migração.
5. Smoke test em staging com pelo menos 2 tenants reais.

Mudanças que **NÃO** requerem nova ADR:
- Atualização de versão do `voyage-3` se Voyage mantiver dimensão 1024 e compatibilidade de espaço vetorial (verificar release notes).
- Adicionar reranker (Cohere/Voyage) — mudança paralela à embedding, não substitui.
- Cache de queries (Redis TTL) — mudança ortogonal.

## 7. Implementação

| Componente | Arquivo | Status |
|---|---|---|
| Migration KBChunk | `packages/database/prisma/migrations/20260427_kbchunk_vector_1024/migration.sql` | ✅ Sprint 0 |
| Schema Prisma atualizado | `packages/database/prisma/schema.prisma` (KBChunk) | ✅ Sprint 0 |
| ADR (este documento) | `docs/architecture/embeddings.md` | ✅ Sprint 0 |
| `rag_chunks` (Python) | `packages/database/prisma/rag_pgvector.sql` | ✅ Já conforme (1024d desde criação) |
| CI lint contra OpenAI embeddings | `.github/workflows/ci.yml` | ⏳ Onda 2 |
| Documentação no serviço RAG | `services/rag/README.md` | ⏳ Onda 3 |

## 8. Referências

- Voyage AI pricing: https://docs.voyageai.com/docs/pricing
- pgvector docs: https://github.com/pgvector/pgvector
- Plano Iza V2.0 §5 — RAG estado real e roadmap
- Auditoria Cowork 27/04/2026 §5.3 — conflito identificado
- Migration SQL: header documenta safety checks
