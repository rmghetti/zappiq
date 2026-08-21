# Gate D4: benchmark de custo de LLM por resposta

Ferramenta OFFLINE do plano Resposta Meta (decisão D4, `docs/resposta-meta-2026/PLANO-RESPOSTA-META.md`) que mede o custo de LLM POR RESPOSTA do pipeline da Iza num corpus controlado, para decidir se a grade nova de preços pode ligar.

> **AVISO: gate PROVISÓRIO.** Este benchmark decide a LARGADA da grade nova. A régua definitiva sai de 30 dias de sombra em produção com o metering por atendimento. O circuit breaker por organização (Modo Econômico automático acima de 2x a premissa) vale desde o dia 1 independente do resultado daqui.

## O critério do gate

Medido sobre o custo por RESPOSTA (não por conversa, não por chamada), no P90 (não só na média):

| P90 por resposta | Resultado |
|---|---|
| até R$ 0,03 | APROVA a grade nova |
| R$ 0,03 a R$ 0,05 | DEGRAU: grade liga com franquias 20% menores para contas novas |
| acima de R$ 0,05 | REPROVA: adia a grade, mantém régua atual recalibrada (página no-go pronta até 15/09) |

Componentes adicionais escritos na D4: teto de chamadas de verificação (o relatório reporta o máximo de chamadas observado por resposta) e fator de segurança 2x (o relatório mostra o P90 puro e o P90 x 2; onde o fator incide é decisão do dono do gate).

## O que é medido

Para cada turno de cliente do corpus, o script chama o **roteador real** (`routeIzaTurn` de `src/services/llm/izaTurnRouter.ts`, o mesmo do `agentOrchestrator`) e registra por resposta:

- chamadas LLM feitas (classify + resposta principal + eventuais rodadas de tools);
- tokens de entrada e saída somados das chamadas;
- custo estimado pela MESMA função de produção (`estimateCostUsd` de `src/utils/llmCost.ts`, a que o `llmCallAudit` usa), convertido a R$ pelo câmbio declarado.

Saídas: `relatorio.md` (P50/P90/P95, chamadas por resposta, tabelas por vertical e por classe, sensibilidade por tier, veredito e premissas) e `relatorio-dados.json` (dado bruto por resposta, para auditoria).

## Como rodar

### Sem chaves (modo estimativa, offline, o default)

```bash
cd apps/api
npx tsx scripts/gate-d4/rodar-benchmark.ts
```

Não faz NENHUMA chamada de rede, banco ou Redis (as chaves de API são removidas do processo por garantia). O roteador real roda inteiro; só a fronteira `llmRouter.complete` é simulada:

- provider da chamada = cabeça da cadeia real (forceProvider > preferProvider > tier > default Sonnet), assumindo provider primário saudável (sem fallback);
- intent do classify = `intentEsperada` anotada no corpus, senão heurística regex declarada no script;
- texto da resposta = a fala seguinte da "iza" no corpus (ou default por classe);
- tokens = 1 por 3,5 caracteres + overhead por mensagem (heurística declarada no relatório).

Flags: `--tier GROWTH|SCALE|...` (tier do veredito, default GROWTH; o outro entra como sensibilidade), `--cambio 5.15` (R$/US$), `--saida arquivo.md`.

### Com chaves (modo real, custa dinheiro)

```bash
cd apps/api
ANTHROPIC_API_KEY=... GOOGLE_API_KEY=... OPENAI_API_KEY=... \
  npx tsx scripts/gate-d4/rodar-benchmark.ts --modo real
```

Chama os providers de verdade e mede tokens oficiais do tokenizer de cada um. Observações: o audit em `llm_call_logs` e o circuit breaker vão tentar Prisma/Redis e falhar em fail-soft (warns no console) se você não apontar `DATABASE_URL`/`REDIS_URL` reais; para o benchmark isso é aceitável e nenhum dado é gravado. Custo aproximado de uma rodada completa (168 respostas, tier GROWTH): poucos dólares, dominado pelas escaladas a Sonnet.

## O corpus (híbrido por desenho)

A D4 define corpus HÍBRIDO: transcripts reais + casos sintéticos adversariais (Adendo S4: não existem 1.000 conversas reais para replay hoje).

### Parte sintética (pronta, neste diretório)

`corpus/*.jsonl`, 72 casos, 168 turnos de cliente, 4 verticais (clinica, ecommerce, distribuidora, servicos). Uma linha por caso:

```json
{ "vertical": "clinica", "caso": "cli-simples-01", "classe": "simples",
  "mensagens": [ { "de": "cliente", "texto": "..." }, { "de": "iza", "texto": "..." } ] }
```

Campos extras aceitos: `classe` (simples, faq, rag, recorrente, negociacao, confuso, audio, handoff, adversarial-contexto, adversarial-picadas, adversarial-assunto) e `intentEsperada` numa mensagem de cliente (rótulo usado pelo simulador no lugar da heurística; vira ground truth para comparar com o classify real no modo real).

Distribuição por desenho, contra benchmark autocomplacente: maioria de operação simples (saudação, FAQ, RAG, pedido recorrente) e cauda complexa proposital (negociação de preço, cliente confuso multi-turno, áudio transcrito longo, pedido de humano e três famílias adversariais: contexto enorme de 10+ turnos, mensagens picadas que disparam uma resposta por fragmento, mudança de assunto no meio da conversa).

### Parte real (script pronto, coleta pendente)

```bash
cd apps/api
DATABASE_URL='<conexao-de-leitura>' npx tsx scripts/gate-d4/exportar-corpus-real.ts \
  --org <organizationId> --vertical clinica --limite 50
```

Somente leitura (só `findMany`), anonimiza telefones, e-mails, CPF/CNPJ, URLs e o nome cadastrado do contato para `[TELEFONE]`, `[EMAIL]`, `[DOCUMENTO]`, `[URL]`, `[NOME]`. Regras:

1. NÃO rode contra produção sem decisão registrada; use dump local ou réplica/branch de leitura.
2. Revise o JSONL exportado ANTES de commitar ou usar: a anonimização por regex não pega nome citado no texto que não seja o do cadastro.
3. O arquivo `corpus/real-<vertical>.jsonl` entra automaticamente na próxima rodada do benchmark (o runner lê todos os `.jsonl` do diretório).

Candidatas hoje: conversas do CMJ (com autorização), Iza institucional e históricos importados, como listado na D4.

## Limitações conhecidas

1. Modo estimativa usa heurística de tokens (sem tokenizer oficial); espere variação de até ~15% contra o modo real.
2. Não entram no custo por resposta: transcrição de áudio (Whisper), TTS, embeddings de RAG e o LLM institucional (overhead declarado no blend do plano).
3. Fallback entre providers, circuit breaker e o loop de tools de agendamento não são exercitados nesta versão.
4. Cache de prompt não é considerado pela `llmCost.ts` (limitação declarada lá); conversas longas tendem a custar MENOS no real com cache ligado.
