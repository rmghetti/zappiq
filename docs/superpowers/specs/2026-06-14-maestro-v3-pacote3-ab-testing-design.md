# Maestro v3 — Pacote 3.10: A/B Traffic Split (Design)

> **Data:** 2026-06-14 · **Status:** aprovado (autonomia delegada)
> **Pacote:** 3 (Receita) — item 10.
> **Depende de:** roteamento multi-fluxo (`flowRuntime`/`flowRouter`), 1B-analytics (funil por nó), versionamento.

## 1. Objetivo
Testar **duas versões de um fluxo** (A = fluxo atual, B = um fluxo variante) com **% de tráfego**, e comparar a **conversão** de cada variante — para decidir com dados qual publicar. Reusa o funil 1B-analytics (cada variante é um fluxo → já tem funil) e o roteamento existente.

## 2. Decisão de arquitetura
- **Sem migração:** o experimento vive em `org.settings.experiments[flowAId] = { active, variantFlowId, splitPercent, conversionNodeId? }`. `splitPercent` = % do tráfego mandado pra B (0–100). `variantFlowId` = o fluxo B (outro Flow ativo). `conversionNodeId?` = nó que conta como conversão (opcional; default = "conclusão do fluxo").
- **Atribuição determinística por conversa:** no PRIMEIRO contato (sem cursor), depois que o roteador escolhe o fluxo A, se A tem experimento ativo → `assignVariant(experiment, seed=conversationId)` decide A ou B por **hash determinístico** (mesma conversa sempre cai na mesma variante). Se B e `variantFlowId` é um fluxo ativo → usa B. Depois disso, o `flowId` no FlowState mantém a conversa na variante (turnos seguintes não re-sorteiam).
- **Conversão = funil:** ambas as variantes são fluxos → `FlowNodeStat` já mede entries/ends por nó. Conversão de uma variante = `entries(conversionNodeId) / entries(nó de entrada)`; sem `conversionNodeId` → `sum(ends)/totalEntries` (taxa de conclusão). O resultado compara as duas variantes no período.

## 3. Componentes

### AB1 — `flowExperiment.ts` (puro, TDD)
- `assignVariant(exp, seed): 'A'|'B'` — hash estável do `seed` (FNV/simple) → bucket 0–99; `< splitPercent` → 'B', senão 'A'. Determinístico (mesma seed → mesma variante). `splitPercent` clamp 0–100; experimento inativo/sem variantFlowId → sempre 'A'.
- `computeAbResults({ aStats, bStats, conversionNodeId, entryNodeId })` — recebe os `byNode` (aggregate) de A e B; calcula `{ variant, entries, conversions, conversionRate }` por variante + aponta o vencedor (maior conversionRate com amostra mínima) ou "sem dados suficientes". Puro.
- Tipos: `Experiment { active, variantFlowId, splitPercent, conversionNodeId? }`.

### AB2 — runtime: aplicar o experimento (IO, gated, fail-soft)
No `flowRuntime.resolveActiveFlowStep`, no ramo de PRIMEIRO contato (sem cursor, após `pickFlowForMessage` escolher `picked`): se `orgSettings.experiments?.[picked.id]?.active` → `assignVariant(exp, conversationId)`; se 'B' e existe `flows.find(variantFlowId, isActive)` → trocar `flow` pra B (a atribuição persiste via flowId no cache). **Fail-soft:** qualquer erro → segue com A. **Sem regressão:** fluxos sem experimento → caminho idêntico.

### AB3 — API
- `PUT /api/flows/:id/experiment` (body `{ active, variantFlowId, splitPercent, conversionNodeId? }`): grava em `org.settings.experiments[id]` (merge). Valida: variantFlowId é outro fluxo da org; splitPercent 0–100.
- `GET /api/flows/:id/experiment`: retorna a config + **resultados** (busca `FlowNodeStat` de A e B no período, `aggregate` + `computeAbResults`).

### AB4 — editor: painel de experimento
No editor, uma seção "Experimento A/B" no nível do fluxo: ligar/desligar, escolher o fluxo B (select de outros fluxos), % pra B (slider/number), nó de conversão (select de nós, opcional). Quando ativo, mostra os **resultados** (entries/conversão por variante + vencedor) lendo `GET /experiment`.

### AB5 — smoke/doc.

## 4. Erros/bordas
- `variantFlowId` inexistente/inativo → trata como sem experimento (fica em A). Auto-referência (A=B) bloqueada na API.
- Atribuição estável: a mesma conversa nunca troca de variante (seed = conversationId; e o flowId persistido reforça).
- Sem dados suficientes → resultado "inconclusivo" (sem declarar vencedor).
- Desligar o experimento não migra conversas em andamento (cada uma segue no seu flowId) — comportamento esperado.

## 5. Testes
- `assignVariant` (puro): determinístico; distribuição respeita splitPercent (0→sempre A; 100→sempre B; 50→~metade num conjunto de seeds); inativo→A.
- `computeAbResults` (puro): calcula conversionRate por variante, aponta vencedor, "inconclusivo" sem amostra.
- Runtime: integração coberta por smoke (IO-heavy); a decisão pura via assignVariant.
- API: 404 fora da org; grava/lê config; resultados.
- Editor: typecheck + smoke.

## 6. Escopo / YAGNI
- **Dentro:** experimento A/B (2 variantes), split %, atribuição determinística, conversão por funil, config+resultados (API+editor).
- **Fora:** >2 variantes, significância estatística formal (mostra taxas + vencedor simples), auto-promoção da variante vencedora (só reporta), bandit/multi-armed.

## 7. Referências
- `flowRuntime.ts` (ramo de primeiro contato, `pickFlowForMessage`), `flowAnalytics.aggregate`, `routes/flows.ts`, editor `flows/page.tsx`, `org.settings` (padrão de config).
