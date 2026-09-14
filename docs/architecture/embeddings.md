# ADR-0006 · Embeddings: OpenAI text-embedding-3-small (1536 dim) é o provedor oficial

**Status:** Aceita
**Decisão tomada em:** 2026-09-14
**Substitui:** ADR-0005 (Voyage `voyage-3`, 1024 dimensões), registrada em 27/04/2026 e reproduzida na seção 7 deste documento

## 1. Contexto: o repositório dizia uma coisa e a produção fazia outra

A auditoria de 13/09/2026 (achado A018) mediu três pontas e encontrou divergência entre elas:

| Onde | O que dizia | O que era verdade |
|---|---|---|
| `GET https://zappiq-rag.fly.dev/ready` | `checks.embedding = {provider: openai, model: text-embedding-3-small}` | é a configuração que roda |
| Banco (`rag_chunks.embedding`) | `format_type` da coluna = `vector(1536)`; 350 de 350 trechos com `vector_dims` 1536 | é o dado que existe |
| `services/rag/fly.toml` e ADR-0005 | `EMBEDDING_PROVIDER=voyage`, `voyage-3`, `EMBEDDING_DIM=1024` | nunca chegou a valer |

A configuração efetiva vinha de fora do repositório, provavelmente de um secret do Fly sobrepondo o bloco `[env]`. O risco não era teórico: bastava um deploy com limpeza de secrets para o `fly.toml` passar a valer, e aí toda ingestão e toda busca falhariam por dimensão incompatível. Nenhum teste e nenhum alarme cobriam isso.

Registrar a realidade é mais seguro do que migrar. Migrar para Voyage 1024 exigiria reingestão completa (pgvector não converte entre dimensões diferentes), janela de indisponibilidade do RAG e novo custo de embedding para os 350 trechos em produção, tudo para resolver uma divergência de documentação.

## 2. Decisão

**Embedder oficial da plataforma:**

- **Provedor:** OpenAI
- **Modelo:** `text-embedding-3-small`
- **Dimensão:** **1536** (é o que a coluna `rag_chunks.embedding` já armazena)
- **Distância:** cosine
- **Índice:** HNSW (`m=16`, `ef_construction=64`)

**Voyage `voyage-3` (1024) passa a ser alternativa não ativa.** O código de `services/rag/main.py` continua oferecendo o provider, e o pacote `voyageai` continua no `requirements.txt`, mas ligá-lo exige reingestão completa e nova ADR (seção 5).

**Onde a decisão está escrita:**

| Componente | Arquivo | Estado |
|---|---|---|
| Bloco `[env]` do serviço | `services/rag/fly.toml` | alinhado em 14/09/2026 (provider, modelo e dimensão) |
| Esta ADR | `docs/architecture/embeddings.md` | este documento |
| Coluna vetorial | `packages/database/prisma/rag_pgvector.sql` | conferir: precisa refletir 1536 |
| Smoke pós-deploy | `.github/workflows/fly-deploy.yml` | o deploy falha se o `/ready` não responder `openai` + `text-embedding-3-small` |

## 3. Por que 1536 e não voltar para 1024

- **O dado já existe em 1536.** São 350 trechos de clientes reais. Reembedar custa dinheiro, custa janela e não melhora nada que o cliente perceba hoje.
- **A chave da OpenAI já está configurada** no serviço, e é a mesma conta usada em outras partes da plataforma.
- **A justificativa original de qualidade em pt-BR nunca foi medida na ZappIQ.** O argumento de 27/04/2026 vinha de benchmark publicado pelo próprio fornecedor. Enquanto não houver medição com dado da casa, ela não sustenta uma migração destrutiva.
- **A conta de memória do ADR-0005 continua correta** (1536 floats ocupam 50% mais que 1024), mas na escala atual (centenas de trechos, não centenas de milhares) a diferença é irrelevante.

Este documento não afirma que Voyage é pior. Afirma que não há medição própria que justifique pagar o custo da troca agora.

## 4. Consequências

### Positivas
- Repositório, serviço e banco passam a dizer a mesma coisa. Um deploy limpo não derruba mais o RAG.
- O smoke do deploy vira alarme: se o `/ready` mudar de provedor ou de modelo sem ninguém decidir, o deploy falha na hora.

### Negativas
- Dependência do mesmo fornecedor que já atende parte do LLM, o que concentra risco de indisponibilidade. Mitigação: o provider Voyage continua implementado e pode ser ligado com reingestão.
- A ADR-0005 defendia qualidade em pt-BR superior no Voyage. Se a medição futura confirmar isso com dado da casa, a troca volta à mesa.

### Pendências conhecidas (fora do escopo desta ADR)
- `KBChunk` no Prisma foi alinhada em 27/04/2026 para `vector(1024)` pela migração `20260427_kbchunk_vector_1024`. Ela continua sem nenhum callsite de runtime no Node, mas agora está com a dimensão errada em relação a esta decisão. Precisa ser alinhada ou removida.
- O `/ready` do serviço não confere se `EMBEDDING_DIM` bate com a dimensão real da coluna. Enquanto não conferir, a divergência só aparece na primeira ingestão que falhar.
- O docstring de `services/rag/main.py` ainda descreve Voyage como primário.

## 5. Política de mudança

Mudar o modelo ou a dimensão exige:

1. Nova ADR aprovada substituindo esta.
2. Reingestão completa. Não existe `ALTER TYPE` entre dimensões no pgvector: a conversão descarta informação e o banco recusa.
3. Janela de manutenção comunicada (o RAG fica indisponível durante a reingestão).
4. Backup dos vetores antigos antes da migração.
5. Ajuste do smoke de `/ready` no `fly-deploy.yml` junto com a mudança, no mesmo PR.

Não exigem nova ADR:
- Atualizar a versão do `text-embedding-3-small` se a OpenAI mantiver 1536 e o mesmo espaço vetorial.
- Adicionar reranker (mudança paralela, não substitui o embedding).
- Cache de consultas.

## 6. Alternativas avaliadas em 14/09/2026

| Alternativa | Pró | Contra | Decisão |
|---|---|---|---|
| Registrar OpenAI 1536 como oficial | custo zero, alinha os três lugares, não toca dado de cliente | mantém concentração de fornecedor | **Aceita** |
| Migrar de fato para Voyage 1024 | cumpre a ADR-0005 como escrita | reingestão completa, janela de indisponibilidade, custo novo, sem medição própria que justifique | Rejeitada |
| Deixar como estava | nenhum trabalho | o `fly.toml` continua sendo uma bomba de relógio num deploy limpo | Rejeitada |

## 7. Histórico: o que a ADR-0005 decidia (27/04/2026)

Mantido para quem for reabrir a discussão.

A auditoria de 27/04/2026 encontrou conflito de schema: `KBChunk` (Prisma) em `vector(1536)` e `rag_chunks` (SQL do serviço Python) em `vector(1024)`. A ADR-0005 escolheu Voyage `voyage-3` com 1024 dimensões como canônico, alinhou `KBChunk` por migração destrutiva (a tabela estava vazia) e deixou OpenAI `text-embedding-3-small` truncado em 1024 como fallback.

Justificativas da época:
- qualidade em pt-BR superior, segundo benchmark publicado pelo fornecedor;
- custo parecido (0,18 dólar por milhão de tokens contra 0,13 da OpenAI);
- não depender do mesmo fornecedor do LLM;
- 1024 dimensões ocupam menos memória no índice HNSW e respondem mais rápido.

O que a ADR-0005 não previu: a configuração de produção já vinha de secret, e ninguém conferia se o serviço rodava o que o repositório dizia.

## 8. Referências

- Achado A018 da auditoria de 13/09/2026 (evidência de `/ready`, do banco e do `fly.toml`)
- `docs/adr/0004-rag-architecture.md` seção sobre troca de provedor exigir reingestão
- pgvector: https://github.com/pgvector/pgvector
- Auditoria Cowork 27/04/2026 seção 5.3 (conflito original de dimensões)
