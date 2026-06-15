# Maestro v3 — Pacote 2.7: Auto-otimização de Fluxo (Design)

> **Data:** 2026-06-14 · **Status:** aprovado (autonomia delegada)
> **Pacote:** 2 (Cérebro) — item 7. O diferencial "fluxo que se melhora sozinho".
> **Depende de:** 1B-analytics (funil por nó) + Atualização Inteligente (diff/apply).

## 1. Objetivo
O Maestro lê o **funil por nó** (1B-analytics), identifica o nó com **drop-off anômalo** e **propõe uma versão melhorada do conteúdo desse nó com diff**, que o cliente aprova. Reusa a infra de Atualização Inteligente (`flowContentPatch` + `refresh-apply`). *Nenhum player verificado entrega isso.*

## 2. Reuso (não reinventar)
- `flowContentPatch`: `extractEditableContent` / `applyContentPatch` / `diffContent` (estrutura travada).
- `loadBusinessContext`, `llmRouter`, `extractJson` (já no flowGenerator).
- Rota de aplicação: a **mesma** `POST /:id/refresh-apply` (valida `sameStructure` + snapshot `source='refresh'`). Não precisa de rota de apply nova.
- `GET /:id/analytics` → `{ totalEntries, byNode:[{nodeId,nodeType,nodeLabel,entries,ends}] }`.

## 3. Componentes
- **`flowOptimizer.ts`**
  - `rankDropoffNodes(byNode, graph)` **(puro, TDD)**: ranqueia nós `message`/`ai` por sinal de drop-off. Sinal = `dropoffRate = ends/entries` alto **e** `entries >= MIN` (default 5) **e** o nó NÃO é terminal trivial (tem sucessor no grafo). Retorna `[{nodeId, nodeType, nodeLabel, entries, ends, dropoffRate}]` ordenado desc. Vazio se sem dados suficientes.
  - `generateOptimizationSuggestion({ organizationId, flow, byNode }) → FlowRefreshResult` **(IO)**: pega o top-1 nó de drop-off; carrega `loadBusinessContext`; prompta o LLM (Sonnet) com o contexto + o conteúdo atual do nó + a estatística ("este nó perde X% — reescreva o texto para ser mais claro/objetivo e reduzir abandono, mantendo a intenção"); valida JSON; monta `ContentField` (só aquele nó), `applyContentPatch` + `diffContent`; retorna `FlowRefreshResult` com `changeNote` explicando o porquê (cita o drop-off). Fail-soft: sem dados / LLM falha → `source:'fallback'`, `changeNote` explicando que não há dados suficientes ainda, `diff:[]`.
- **Rota** `POST /api/flows/:id/optimize-suggestion`: carrega o flow (org-scoped), busca os stats (últimos 7d, `aggregate`), chama `generateOptimizationSuggestion`, retorna `FlowRefreshResult` (mesma forma de `refresh-suggestion`). Aplicar = `refresh-apply` existente.
- **Frontend**: botão "Otimizar" no editor que chama `optimize-suggestion` e mostra **o mesmo preview de diff** do refresh (reusa a UI), aplicando via `refresh-apply`. Se `diff` vazio → mostra a `changeNote` ("sem dados suficientes / fluxo já está bom").

## 4. Erros/bordas
- Sem tráfego (byNode vazio ou todos entries < MIN) → fallback amigável, sem proposta.
- LLM falha/JSON inválido → fallback (nunca quebra).
- Estrutura travada: o optimizer só altera o campo de conteúdo de UM nó; `refresh-apply` revalida `sameStructure`.
- Só nós `message`/`ai` são reescritos (condition/ask/etc. não — drop-off neles é estrutural, não de copy).

## 5. Testes
- `rankDropoffNodes` (puro): ordena por drop-off; ignora entries baixos; ignora nós terminais; vazio sem dados.
- `generateOptimizationSuggestion` (LLM mockado): plano válido → diff no nó de pior drop-off, source 'ai'; sem dados → fallback; LLM falha → fallback.
- Rota: 404 fora da org; retorna suggestion.
- Frontend: typecheck + smoke.

## 6. Escopo / YAGNI
- **Dentro**: ranquear drop-off + sugerir reescrita de 1 nó + diff + aplicar via refresh-apply + botão.
- **Fora**: reescrita estrutural (adicionar/remover nós), otimização multi-nó simultânea, auto-aplicação sem aprovação (sempre human-in-the-loop), trigger automático por cron (pode vir depois).

## 7. Referências
- `flowGenerator.regenerateFlowContent` (padrão), `flowContentPatch.*`, `routes/flows.ts` (`refresh-suggestion`/`refresh-apply`), `flowAnalytics.aggregate`, editor diff UI em `flows/page.tsx`.
