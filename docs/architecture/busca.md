# Busca do RAG: cache, ranking e cortes

**Status:** em vigor desde 14/09/2026 (B4, "busca que acha o que foi treinado")
**Código:** `apps/api/src/services/ragService.ts`, `apps/api/src/services/ragQueryRewrite.ts`, `services/rag/retrieval.py`

Este documento é curto de propósito. Ele responde quatro perguntas: qual é a chave do cache, o que é a versão de configuração, como o ranking decide e como medir se a busca está achando.

## 1. Chave do cache

A chave é o sha256 de quatro coisas juntas:

```
rag:<namespace>:<sha256(mensagem normalizada + top_k + corte + versão da organização)>
```

- **mensagem normalizada**: NFC, sem espaço nas pontas, espaço interno colapsado, caixa baixa. A mensagem INTEIRA, nunca um pedaço dela.
- **top_k**: 5 no turno normal, 3 no Modo Econômico.
- **corte**: o `min_similarity` que foi enviado ao serviço.
- **versão da organização**: o contador da seção 2.

TTL de 120 segundos. Resultado vazio TAMBÉM é cacheado (antes, toda saudação repetia a busca paga). Serviço fora do ar NUNCA é cacheado: a mensagem seguinte tenta de novo.

A chave antiga era `rag:<ns>:base64(mensagem).slice(0,40)`, ou seja, os 30 primeiros bytes. "Quanto custa o tratamento de canal?" e "Quanto custa o tratamento de clareamento?" recebiam o mesmo contexto por dois minutos, para qualquer contato da organização.

## 2. Versão de configuração da organização

Contador no Redis, uma chave por organização:

```
zappiq:rag:version:org_<id>
```

Incrementado por QUALQUER escrita de treino: upload de arquivo, texto colado, URL, Q&A criado, editado, desativado ou apagado, questionário reingerido, identidade, configuração de agendamento. Na prática, toda chamada de `ingestDocument` e de `deleteDocument` sobe a versão.

Como a versão faz parte da chave, subir o contador invalida o cache inteiro daquela organização na hora. Sem Redis, a leitura devolve 0 e o cache passa a valer só por mensagem: comportamento degradado, nunca quebrado.

O playground "Testar minha IA" e a produção usam a MESMA função de busca (`searchDetailed`), então não voltam a divergir depois de uma edição.

## 3. Consulta enviada à busca

A consulta nem sempre é a mensagem crua. Regras, em ordem:

1. Mensagem com 25 caracteres ou mais vai crua. É o caminho da maioria e não mudou.
2. Mensagem curta: vale a reescrita que o classificador de intenção devolve no mesmo retorno (`{"intent":..., "consulta":...}`). Nenhuma chamada de LLM nova por turno.
3. Mensagem curta, sem reescrita e sem substantivo do domínio ("e quanto fica?", "sim", "esse"): a consulta vira as duas últimas mensagens do cliente mais a mensagem atual, com teto de 600 caracteres.

Limite conhecido: "e o prazo?" tem substantivo do domínio, então a regra 3 não dispara. Quem resolve esse caso é a regra 2. Concatenar sem necessidade sujaria uma consulta que já estava boa.

A chave do cache do classificador leva o contexto quando a mensagem é curta. Sem isso, "sim" de uma conversa sobre preço reaproveitaria a reescrita de outra conversa sobre horário.

## 4. Ranking (`services/rag/retrieval.py`)

O KNN do pgvector busca `min(top_k * 4, 60)` candidatos. Depois, nesta ordem:

1. **Corte absoluto**: descarta similaridade abaixo do piso.
2. **Ordenação** por `similaridade + bônus`.
3. **Corte relativo**: descarta quem estiver abaixo de `melhor_similaridade * RAG_RELATIVE_CUTOFF`. É o corte que faz "oi" voltar vazio: quando nada casa, o melhor resultado também é fraco e a cauda cai junto.
4. **Deduplicação**: por `chunk_hash`, por texto normalizado e por texto quase igual (Jaccard de palavras).
5. **Teto por fonte**: no máximo 2 trechos da mesma fonte.
6. **top_k**.

O bônus é ADITIVO e pequeno. Antes era multiplicativo (1,20 para `qa-*`, 1,15 para `onboarding-survey*`): num trecho de similaridade 0,60 isso valia +0,12, o bastante para pular três posições. Medido em produção, o questionário ocupava 2,62 das 5 vagas e os documentos do cliente, 0,24.

| env | default | o que faz |
|---|---|---|
| `RAG_MIN_SIMILARITY` (apps/api) | 0,35 | piso enviado ao serviço no corpo do `/query` |
| `RAG_MIN_SIMILARITY_FLOOR` (rag) | 0,0 | piso do próprio serviço; só aperta, nunca solta |
| `RAG_RELATIVE_CUTOFF` | 0,60 | corte relativo ao melhor resultado; 0 desliga |
| `RAG_MAX_PER_SOURCE` | 2 | teto de trechos por fonte |
| `RAG_QA_BONUS` | 0,03 | bônus aditivo de `qa-*` |
| `RAG_SURVEY_BONUS` | 0,01 | bônus aditivo de `onboarding-survey*` |
| `RAG_QA_PRIORITY_BONUS` | 0,005 | por ponto de prioridade do Q&A (0 a 10) |
| `RAG_QA_PRIORITY_BONUS_CAP` | 0,05 | teto do bônus de prioridade |
| `RAG_NEAR_DUPLICATE` | 0,92 | Jaccard a partir do qual dois trechos são o mesmo |
| `RAG_SINGLE_CHUNK_MAX_TOKENS` | 6000 | acima disso, nem o Q&A escapa do fatiamento |

### Por que 0,35 e não 0,25 nem 0,50

Medição feita sobre os vetores REAIS de produção (`text-embedding-3-small`, 1536 dimensões), não sobre estimativa:

- Q&A do CMJ contra trechos da MACHIA, 1.804 pares (conteúdo comprovadamente irrelevante): mediana 0,375; apenas 3,7% abaixo de 0,25.
- Q&A da MACHIA contra trechos do CMJ, 7.372 pares: mediana 0,366; 6,5% abaixo de 0,25.
- Dentro do próprio namespace do CMJ, 4.246 pares: mediana 0,450, p05 0,234.

O piso de 0,25 rejeitava menos de 7% do que já se sabia ser lixo. Subir para a faixa de 0,45 a 0,50 rejeitaria junto metade do conteúdo do próprio cliente, porque as duas distribuições se sobrepõem. 0,35 fica acima da mediana do ruído e bem abaixo da mediana do conteúdo da casa; o que separa relevante de irrelevante de verdade é o corte RELATIVO, que não depende da escala do modelo.

Quando o provedor de embedding mudar, este número muda com ele. Refaça a medida (seção 5) antes de mexer.

## 5. Como medir recall

Duas camadas.

**No CI, de graça.** `services/rag/tests/test_recall.py` roda um corpus sintético com um embedder falso determinístico (hash de palavras num vetor esparso). Ele não calibra o corte absoluto, porque a escala de cosseno do embedder falso é outra. Ele prova a mecânica: ordenação, corte relativo, bônus, teto por fonte, deduplicação e trecho único do Q&A.

**Contra dados reais, fora do CI.** `services/rag/scripts/recall_eval.py` lê os `qa_pairs` ativos de uma organização e manda cada pergunta para o `/query`, conferindo se a fonte `qa-<id>.txt` volta no top-5.

```bash
export DATABASE_URL='postgresql://...'      # usuário de LEITURA
export RAG_SERVICE_URL='https://...'
export RAG_SERVICE_SECRET='...'
python services/rag/scripts/recall_eval.py --namespace org_cmr4x0zmn007msdhtqn6lfkia   # CMJ
python services/rag/scripts/recall_eval.py --namespace org_cmrktle9g002epphvb02qbe1r   # MACHIA
```

Cada pergunta gera um embedding pago, por isso o script não roda no CI. Meta combinada: 90% ou mais nas duas organizações. O script sai com código 1 quando fica abaixo da meta, então serve como passo de runbook.
