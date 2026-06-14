# Maestro v3 — Spec 1C: Subfluxos Call/Return (Design)

> **Data:** 2026-06-14 · **Status:** aprovado (autonomia delegada), pronto para plano
> **Pacote:** 1 (Fundação) — item 5. **Fecha o Pacote 1.**
> **Depende de:** 1A (motor/runtime multi-fluxo + goto_flow one-way).

---

## 1. Objetivo

Hoje `goto_flow` é **one-way**: salta para outro fluxo e não volta (sem call/return). A 1C adiciona **subfluxos**: um fluxo pode **chamar** outro e, quando o subfluxo termina, **retomar o chamador no ponto seguinte** — com as `vars` compartilhadas. Permite reutilizar blocos (ex.: um subfluxo "qualificar" chamado por vários fluxos).

## 2. Decisão de arquitetura

A **pilha de chamadas** (`callStack`) vive no estado da conversa (persistido no cache, sobrevive a turnos) e é **orquestrada pelo runtime** (a única camada que carrega fluxos do banco). O **motor puro** muda o mínimo: o nó `goto_flow` ganha `mode: 'goto' | 'call'`; em `call`, emite o efeito com o `returnNodeId` (o nó do chamador a retomar). O motor **não** manipula a pilha — só o runtime empilha (no call) e desempilha (no fim do subfluxo). Isso mantém o motor puro e concentra a lógica de IO/cross-flow onde ela já vive (o hop loop).

## 3. Modelo

- `FlowState.callStack?: { flowId: string; returnNodeId: string | null }[]` (frame = fluxo chamador + nó de retorno). Opcional → retrocompat total.
- `FlowEffect` `goto_flow` ganha `mode?: 'goto' | 'call'` e `returnNodeId?: string | null`.
- Nó `goto_flow`: `data.mode` (`'goto'` default = comportamento atual; `'call'` = subfluxo).

## 4. Motor (puro)

No `case 'goto_flow'`:
- `mode = node.data?.mode === 'call' ? 'call' : 'goto'`.
- `call` → `effects.push({ kind:'goto_flow', targetFlowId, mode:'call', returnNodeId: firstTargetFrom(graph, node.id) })`. `goto` → efeito atual (sem mode).
- Retorna `next:'end'` (o runtime assume a transição), como hoje.
O motor **passa `callStack` adiante** sem tocá-lo (presente no `state` de entrada/saída). Não há mais nenhuma mudança no motor.

Helper puro testável `nextHopIntent(gotoEff, next, hasFrames): 'call' | 'switch' | 'return' | 'stop'` — encapsula a decisão do hop loop:
- efeito goto com `mode:'call'` → `'call'`; com `mode:'goto'`/sem → `'switch'`;
- sem goto e `next==='end'` e `hasFrames` → `'return'`;
- caso contrário → `'stop'`.

## 5. Runtime (IO) — hop loop com call/return

`callStack` é uma variável local carregada do estado persistido. No loop (anti-loop `MAX_FLOW_HOPS`):
1. `resolveFlowStep` → `result`. Registra stats por hop (1B-analytics, inalterado).
2. `intent = nextHopIntent(gotoEff, result.next, callStack.length>0)`.
3. **call**: resolve o fluxo alvo (ativo); se não existe → para (segue no atual). `callStack.push({ flowId: currentFlow.id, returnNodeId: gotoEff.returnNodeId ?? null })`; `currentFlow = alvo`; `currentState = { cursor:null, vars }`; continua.
4. **switch** (one-way, atual): resolve alvo; troca sem empilhar; `cursor:null`, `vars`; continua.
5. **return**: `frame = callStack.pop()`; resolve o chamador (`frame.flowId`, ativo); se sumiu → para (encerra). `currentFlow = chamador`; `currentState = { cursor: frame.returnNodeId, vars }`; continua.
6. **stop**: break (await_input / ai / scheduled / end com pilha vazia).

**Persistência**: o `StoredFlowState` ganha `callStack`. Mid-flow (cursor != null) → grava `{ ...state, flowId: currentFlow.id, callStack }`. Fim real (cursor null **e** pilha vazia) → `__ended__`. Assim um subfluxo que aguarda input persiste o frame do chamador e, ao terminar num turno futuro, retoma o chamador.

**Anti-loop**: `MAX_FLOW_HOPS` já cobre call/return infinitos (cada call/return é um hop). Profundidade de pilha implicitamente limitada pelo mesmo teto por turno.

## 6. Editor

No inspetor do nó `goto_flow` (`NodeProperties`), além do `targetFlowId`, um seletor de **modo**: "Enviar para o fluxo (não volta)" (`goto`) vs "Chamar e voltar quando terminar" (`call`). Default `goto` (retrocompat). Minimal.

## 7. Tratamento de erros / bordas
- Alvo/chamador inexistente ou inativo → degrada com segurança (para no fluxo atual / encerra), com log — nunca quebra o turno.
- `returnNodeId` null (goto_flow era o último nó do chamador) → ao voltar, o chamador encerra naturalmente (cursor null) → desempilha de novo ou fim.
- Pilha sobrevive a turnos (no cache, TTL 7d); se o TTL expira no meio, a conversa recomeça pelo roteador (comportamento atual).
- Retrocompat: nós `goto_flow` sem `mode` = one-way idêntico ao de hoje; `callStack` ausente = sem subfluxos.

## 8. Testes
- **Motor (puro, TDD)**: `goto_flow` `mode:'call'` emite efeito com `mode` + `returnNodeId` correto; sem mode → efeito atual. `nextHopIntent` cobre os 4 casos.
- **Runtime (integração)**: teste com `prisma.flow.findMany`/`cache` mockados exercitando um ciclo call→subfluxo→return (chamador retoma no `returnNodeId`) e o caso cross-turn (subfluxo com await_input persiste callStack). Se a fiação de mocks for inviável, cobrir via `nextHopIntent` (puro) + smoke manual e reportar.
- Frontend: typecheck + smoke manual.

## 9. Escopo / YAGNI
- **Dentro**: callStack, goto_flow `call`, return no runtime, toggle no editor.
- **Fora**: passagem de parâmetros isolados por subfluxo (hoje `vars` são compartilhadas — suficiente), namespacing de vars, recursão profunda intencional (limitada pelo anti-loop), visualização da pilha no canvas.

## 10. Referências
- `flowEngine.ts` (`FlowState`, `FlowEffect` goto_flow, `case 'goto_flow'`, `firstTargetFrom`).
- `flowRuntime.ts` (hop loop `for (let hop…)`, `StoredFlowState`, persistência `cache.set`).
- Editor `NodeProperties` branch `goto_flow` em `flows/page.tsx`.
- Fecha o Pacote 1 (1A + 1B-geração + 1B-analytics + 1C).
