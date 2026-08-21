# Benchmark do gate D4: custo de LLM por resposta

Gerado em 2026-08-21 01:11 UTC pelo `rodar-benchmark.ts` em **modo ESTIMATIVA** (sem chaves de API: nenhuma chamada de rede, banco ou Redis foi feita; tokens e custos são ESTIMADOS por heurística declarada).

> **Gate D4 (plano Resposta Meta, decisão D4):** aprova a grade nova se o custo por RESPOSTA (P90) ficar em até R$ 0,03; entre R$ 0,03 e R$ 0,05 entra o degrau (franquias 20% menores para contas novas); acima disso reprova (adiar grade e manter régua atual recalibrada). Gate PROVISÓRIO até 30 dias de sombra em produção; o circuit breaker por org vale desde o dia 1 independente deste resultado.

## Corpus

- 72 casos sintéticos em 4 verticais (clinica, ecommerce, distribuidora, servicos), 168 turnos de cliente (= respostas medidas).
- Distribuição por desenho: maioria operação simples (saudação, FAQ, RAG, recorrente) e cauda complexa (negociação, cliente confuso, áudio longo, handoff e 3 famílias adversariais: contexto enorme, mensagens picadas, mudança de assunto).
- O corpus do gate é HÍBRIDO por desenho (S4: não existem 1.000 conversas reais para replay). Esta rodada usa a parte sintética; a coleta dos transcripts reais anonimizados está pronta em `exportar-corpus-real.ts` (ver README).

## Resultado geral (tier GROWTH, roteamento por complexidade ativo)

| Métrica | Valor |
|---|---|
| Respostas medidas | 168 |
| Custo por resposta P50 | R$ 0,0047 (US$ 0.00092) |
| Custo por resposta P90 | **R$ 0,0490** (US$ 0.00952) |
| Custo por resposta P95 | R$ 0,0511 |
| Custo por resposta máximo | R$ 0,0634 |
| Custo por resposta médio | R$ 0,0148 |
| Chamadas LLM por resposta (média) | 2,00 |
| Chamadas LLM por resposta (máximo observado) | 2 |
| Tokens de entrada por resposta (média, somadas as chamadas) | 3196 |
| Tokens de saída por resposta (média) | 78 |
| Respostas escaladas para Sonnet (intent != normal) | 38 (22,6%) |

## Veredito do gate

| Critério | P90 medido | Limite | Resultado |
|---|---|---|---|
| Custo por resposta (P90, tier GROWTH) | R$ 0,0490 | R$ 0,0300 / R$ 0,0500 | **DEGRAU (franquias 20% menores para contas novas)** |
| Com fator de segurança 2x (P90 x 2) | R$ 0,0981 | R$ 0,0300 / R$ 0,0500 | REPROVA (adiar grade, manter régua atual recalibrada) |

O plano lista "fator de segurança 2x" entre os componentes do gate sem fixar onde ele incide; as duas leituras estão na tabela e a interpretação vinculante fica com o dono do gate. Teto de chamadas de verificação: o pipeline atual faz no máximo 2 chamadas por resposta (classify + resposta principal; não há chamadas de verificação hoje, e o loop de tools de agendamento não foi exercitado neste corpus).

## Por vertical (tier GROWTH)

| Vertical | Respostas | P50 | P90 | Máx | Escaladas |
|---|---|---|---|---|---|
| clinica | 47 | R$ 0,0045 | R$ 0,0490 | R$ 0,0606 | 11 (23%) |
| distribuidora | 39 | R$ 0,0049 | R$ 0,0507 | R$ 0,0524 | 9 (23%) |
| ecommerce | 42 | R$ 0,0048 | R$ 0,0467 | R$ 0,0587 | 9 (21%) |
| servicos | 40 | R$ 0,0047 | R$ 0,0502 | R$ 0,0634 | 9 (23%) |

## Por classe de caso (tier GROWTH)

| Classe | Respostas | P50 | P90 | Máx |
|---|---|---|---|---|
| adversarial-assunto | 15 | R$ 0,0051 | R$ 0,0416 | R$ 0,0488 |
| adversarial-contexto | 32 | R$ 0,0054 | R$ 0,0458 | R$ 0,0634 |
| adversarial-picadas | 20 | R$ 0,0044 | R$ 0,0050 | R$ 0,0484 |
| audio | 4 | R$ 0,0057 | R$ 0,0582 | R$ 0,0582 |
| confuso | 16 | R$ 0,0046 | R$ 0,0057 | R$ 0,0490 |
| faq | 10 | R$ 0,0042 | R$ 0,0045 | R$ 0,0048 |
| handoff | 5 | R$ 0,0468 | R$ 0,0480 | R$ 0,0480 |
| negociacao | 17 | R$ 0,0487 | R$ 0,0511 | R$ 0,0524 |
| rag | 19 | R$ 0,0045 | R$ 0,0516 | R$ 0,0524 |
| recorrente | 13 | R$ 0,0044 | R$ 0,0446 | R$ 0,0446 |
| simples | 17 | R$ 0,0042 | R$ 0,0045 | R$ 0,0477 |

## Intents observadas (classify real sobre o corpus)

| Intent | Respostas |
|---|---|
| normal | 130 |
| price_question | 14 |
| objection | 10 |
| purchase_intent | 9 |
| handoff | 4 |
| enterprise | 1 |

No modo estimativa a resposta do classificador é simulada: 32 turnos usam a `intentEsperada` anotada no corpus e o restante cai na heurística regex declarada no script. A ORQUESTRAÇÃO do classify é a real (prompt montado e parseado pelo código de produção).

## Sensibilidade: tier SCALE (provider primário Sonnet)

| Métrica | GROWTH | SCALE |
|---|---|---|
| P50 | R$ 0,0047 | R$ 0,0477 |
| P90 | R$ 0,0490 | R$ 0,0551 |
| Média | R$ 0,0148 | R$ 0,0482 |
| Veredito se fosse o tier da grade | DEGRAU (franquias 20% menores para contas novas) | REPROVA (adiar grade, manter régua atual recalibrada) |

## Custo por atendimento (caso completo, GROWTH)

A franquia da grade nova é por ATENDIMENTO (fair use de 12 respostas no lançamento). Somando as respostas de cada caso do corpus: P50 R$ 0,0096, P90 R$ 0,0964, máximo R$ 0,1462 por atendimento.

## Premissas do modo estimativa

1. Câmbio: R$ 5,15/US$ (referência da tarifa Meta citada no plano: R$ 0,0350 = US$ 0,0068). Ajustável com `--cambio`.
2. Tokens estimados por heurística declarada: 1 token a cada 3,5 caracteres (pt-BR), + 4 tokens por mensagem + 10 por chamada. Sem chaves de API não há contagem oficial de tokenizer.
3. Preços por modelo: tabela MODEL_PRICING real de `src/utils/llmCost.ts` (PRICING_VERSION vigente no repo), via a MESMA `estimateCostUsd` que o `llmCallAudit` usa em produção.
4. Provider por chamada: a cabeça da cadeia que o `buildChain` real montaria (forceProvider > preferProvider > tier > default Sonnet), assumindo provider primário sempre saudável: sem fallback, sem circuit breaker. Fallbacks encarecem ou barateiam a resposta conforme o provider e NÃO estão medidos aqui.
5. Tamanho da resposta: o texto da própria "iza" que segue no corpus; no último turno de cada caso, default por classe (simples 320, faq 380, rag 700, recorrente 350, etc.).
6. System prompt de produção espelhado: CORE_AGENT_RULES_V1 REAL + prompt de tenant sintético por vertical + bloco de cliente + RAG (preenchido só nos casos de classe rag) + data. Sem iza_facts (org de cliente).
7. Histórico com teto de 20 mensagens, espelhando o take: 20 do agentOrchestrator.
8. Cache de prompt NÃO considerado (a llmCost.ts declara essa limitação); o custo real com cache tende a ser MENOR que o estimado nas conversas longas.

## O que rodou de verdade x o que foi mockado

REAL: routeIzaTurn inteiro (pre-filter de verticais bloqueadas, classifyIntent com prompt e parse reais, escalada por intent, montagem de mensagens, contagem de chamadas), mapa TIER_PRIMARY_PROVIDER, estimateCostUsd, CORE_AGENT_RULES_V1.

MOCKADO: apenas `llmRouter.complete` (a fronteira de rede). Não exercitados nesta rodada: cascade/fallback entre providers, circuit breaker Redis, audit em llm_call_logs (Prisma), loop de tools de agendamento, TTS/STT.

## Limitações declaradas

1. MODO ESTIMATIVA: sem chamada real de LLM os tokens são heurísticos; a contagem oficial pode variar (para pt-BR, tipicamente até ~15% para mais ou para menos). Rode `--modo real` com chaves para números de tokenizer.
2. Corpus 100% sintético nesta rodada: a parte real do corpus híbrido depende do export anonimizado (script pronto; a plataforma tem poucas conversas reais hoje).
3. A fração de escaladas para Sonnet é a alavanca dominante do P90: aqui ela reflete a anotação do corpus (cauda proposital); em produção o classificador real pode escalar mais ou menos.
4. Custos fora do pipeline de resposta não entram: transcrição de áudio (Whisper, ~US$ 0,006/min), TTS, embeddings do RAG, LLM institucional.
5. Casos de vertical bloqueada (custo zero) não aparecem porque a org sintética é de CLIENTE (o pre-filter comercial da ZappIQ não se aplica; o de compliance sim, mas o corpus não tem esses casos).
6. GATE PROVISÓRIO: este benchmark aprova/reprova a LARGADA da grade; a régua definitiva sai dos 30 dias de sombra real com o metering por atendimento.

## Reproduzir

```bash
cd apps/api
npx tsx scripts/gate-d4/rodar-benchmark.ts --tier GROWTH --cambio 5.15
```
