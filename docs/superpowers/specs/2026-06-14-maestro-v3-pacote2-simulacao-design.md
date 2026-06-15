# Maestro v3 — Pacote 2.8: Simulação por Personas Sintéticas (Design)

> **Data:** 2026-06-14 · **Status:** aprovado (autonomia delegada)
> **Pacote:** 2 (Cérebro) — item 8. Sinergia com a QUALIDADE DA IA (reusa o juiz).
> **Depende de:** motor puro (`resolveFlowStep`), `loadBusinessContext`, `runJudge` (agentEvalRunner), `llmRouter`.

## 1. Objetivo
Antes de publicar, o Maestro **testa o fluxo com clientes sintéticos** (derivados do brief do negócio) e reporta onde ele trava/falha. A IA gera N personas, cada uma conversa com o fluxo turno a turno (motor puro), e um **juiz (LLM)** pontua se o fluxo lidou bem. *Nenhum player verificado entrega isso.*

## 2. Reuso
- `resolveFlowStep` (motor puro) — dirige a conversa determinística; quando `next==='ai'`, simulamos a resposta do bot chamando o LLM com o `aiPrompt`.
- `loadBusinessContext().brief` — semente para gerar personas realistas do negócio.
- `runJudge(expectedBehavior, response)` do `agentEvalRunner` (exportar) — pontua a conversa.
- `llmRouter.complete` — gera mensagens da persona + resposta do nó-IA + juiz.

## 3. Componentes (`flowSimulation.ts`)
- **Tipos**: `Persona { id, name, tone, intent, painPoint }`, `SimTurn { from:'customer'|'bot'; text; effects? }`, `ConversationResult { persona, turns, verdict:{passed,confidence,reason}, ended }`, `SimulationReport { passRate, total, passed, failed, byPersona, recommendations }`.
- **`scoreConversation(turns, ended, persona)` (puro, TDD)**: heurística — passou se a conversa **encerrou** (`ended`) e nenhum juízo de turno falhou; senão falhou, com `reason`. Pura.
- **`runOnePersona(graph, persona, deps)` (orquestra, deps injetadas → testável)**: loop até `MAX_TURNS` (8) ou `next==='end'`:
  1. `deps.customerSays(persona, history)` → msg do cliente.
  2. `resolveFlowStep(graph, state, msg, { ctx })` → efeitos + next.
  3. registra turno (efeitos = falas do bot).
  4. se `next==='ai'`: `deps.botReplies(aiPrompt, history)` vira a fala do bot e `deps.judge(persona, history)` pontua aquele ponto; continua.
  5. se `next==='end'` → `ended=true`, break.
  `deps` = `{ customerSays, botReplies, judge, buildCtx }` (todas as chamadas LLM ficam aqui → o loop é testável com stubs).
- **`generateSyntheticPersonas(brief, count)` (IO)**: LLM gera `count` personas diversas (intenções: comprar, dúvida, objeção, suporte, sumir) do brief; `extractJson`; fallback determinístico (personas genéricas) se falhar.
- **`executeFlowSimulation({ organizationId, flow, personaCount })` (IO)**: carrega contexto → gera personas → para cada uma roda `runOnePersona` com deps reais (LLM) → `scoreConversation` → agrega `SimulationReport`. Fail-soft (persona que erra vira verdict 'erro', não derruba o lote). Respeita throttle.
- **Rota** `POST /api/flows/:id/simulate` (org-scoped; body `{ personaCount? }`, default 3, cap 8): roda do grafo ATUAL (draft em edição → o cliente passa nodes/edges no body, OU usa o salvo). Retorna `SimulationReport`.

## 4. Erros/bordas
- Sem contexto/brief pobre → personas genéricas (fallback).
- LLM falha numa persona → verdict `{passed:false, reason:'erro na simulação'}`, continua as outras.
- `MAX_TURNS` evita conversa infinita; `next==='scheduled'` (wait) → trata como "encerrou para fins de simulação" (não espera timer real).
- Custo: N personas × ~poucos turnos × LLM. Cap personaCount em 8; throttle leve.

## 5. Testes
- `scoreConversation` (puro): encerrou+sem falha → pass; não encerrou → fail; juízo falho → fail.
- `runOnePersona` (deps stubadas, motor real): conversa simples start→message→end com persona stub → turns corretos + ended. Verdict via scoreConversation.
- `executeFlowSimulation` (LLM mockado): gera personas + roda + agrega report; fallback quando geração falha.
- Rota: 404 fora da org; retorna report.

## 6. Escopo / YAGNI
- **Dentro**: gerar personas, simular conversas, juiz, report, rota.
- **Fora**: simular timers reais (wait), simular mídia/botões interativos de verdade (a persona "escolhe" via texto), persistir simulações em DB (retorna direto), auto-aplicar correções (só reporta). Frontend (botão "Simular") = adição leve opcional.

## 7. Referências
- `flowEngine.resolveFlowStep`, `agentEvalRunner.runJudge` (exportar), `flowGenerator.loadBusinessContext`, `llmRouter.complete`, `routes/flows.ts` (`/:id/test` como padrão de loop).
