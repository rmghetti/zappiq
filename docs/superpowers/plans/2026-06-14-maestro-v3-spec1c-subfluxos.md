# Maestro v3 — Spec 1C (Subfluxos Call/Return) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Pure logic uses TDD. Test: `pnpm --filter @zappiq/api exec vitest run <pattern>`. ESM `.js` suffix. Branch: `maestro-v3-spec1a-motor`.

**Goal:** Subfluxos: um `goto_flow` em modo `call` chama outro fluxo; ao terminar, o runtime retoma o chamador no nó seguinte (vars compartilhadas, callStack persistido entre turnos). Spec: `docs/superpowers/specs/2026-06-14-maestro-v3-spec1c-subfluxos-design.md`.

**Contratos atuais (lidos):** `FlowState = { cursor, vars }` (flowEngine.ts:50). goto_flow effect `{kind:'goto_flow';targetFlowId}` (linha 62). goto_flow case (337-347) emite o efeito + `firstTargetFrom`. Runtime hop loop (167-206): acha gotoEff, troca de fluxo com `cursor:null`. Persistência (229-231): `{...result.state, flowId}` ou `__ended__`. `StoredFlowState` em flowRuntime.

---

## Task C1: motor — modo `call` no goto_flow + nextHopIntent (puro)
**Files:** modify `flowEngine.ts` + `flowEngine.test.ts`.

- [ ] **Step 1: Testes que falham** (append no describe):
```ts
  it('goto_flow mode call emite efeito com mode e returnNodeId (nó seguinte do chamador)', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'g', type: 'goto_flow', data: { targetFlowId: 'SUB', mode: 'call' } },
        { id: 'depois', type: 'message', data: { text: 'voltei' } },
      ],
      edges: [{ source: 'g', target: 'depois' }],
    };
    const r = resolveFlowStep(graph, { cursor: 'g', vars: {} }, '', { ctx: DEFAULT_CTX, hasIncomingMessage: false });
    const eff = r.effects.find((e) => e.kind === 'goto_flow') as any;
    expect(eff).toMatchObject({ kind: 'goto_flow', targetFlowId: 'SUB', mode: 'call', returnNodeId: 'depois' });
    expect(r.next).toBe('end');
  });

  it('goto_flow sem mode = one-way (efeito sem mode/returnNodeId)', () => {
    const graph: FlowGraph = { nodes: [{ id: 'g', type: 'goto_flow', data: { targetFlowId: 'X' } }], edges: [] };
    const r = resolveFlowStep(graph, { cursor: 'g', vars: {} }, '', { ctx: DEFAULT_CTX, hasIncomingMessage: false });
    const eff = r.effects.find((e) => e.kind === 'goto_flow') as any;
    expect(eff.targetFlowId).toBe('X');
    expect(eff.mode === undefined || eff.mode === 'goto').toBe(true);
  });
```
And a test file `apps/api/src/agents/flowHop.test.ts` for the pure helper:
```ts
import { describe, it, expect } from 'vitest';
import { nextHopIntent } from './flowHop.js';
describe('nextHopIntent', () => {
  it('call', () => expect(nextHopIntent({ targetFlowId: 'S', mode: 'call' }, 'end', false)).toBe('call'));
  it('switch (goto one-way)', () => expect(nextHopIntent({ targetFlowId: 'S' }, 'end', false)).toBe('switch'));
  it('return quando fim com frames', () => expect(nextHopIntent(undefined, 'end', true)).toBe('return'));
  it('stop quando fim sem frames', () => expect(nextHopIntent(undefined, 'end', false)).toBe('stop'));
  it('stop em await_input', () => expect(nextHopIntent(undefined, 'await_input', true)).toBe('stop'));
});
```

- [ ] **Step 2: Rodar, ver falhar.**
- [ ] **Step 3: Implementar**
  1. `flowEngine.ts`: `FlowState` += `callStack?: { flowId: string; returnNodeId: string | null }[]`. `FlowEffect` goto_flow → `{ kind:'goto_flow'; targetFlowId: string; mode?: 'goto'|'call'; returnNodeId?: string | null }`. No `case 'goto_flow'`: se `node.data?.mode === 'call'` → `effects.push({ kind:'goto_flow', targetFlowId: target, mode:'call', returnNodeId: firstTargetFrom(graph, node.id) })`; senão o efeito atual. (O motor NÃO mexe em callStack; ele apenas existe no tipo. Não precisa adicionar callStack aos returns — o runtime gerencia a pilha localmente. Se preferir passar adiante, é opcional/inócuo.)
  2. Criar `apps/api/src/agents/flowHop.ts`:
```ts
import type { FlowStepResult } from './flowEngine.js';
export type HopIntent = 'call' | 'switch' | 'return' | 'stop';
export function nextHopIntent(
  gotoEff: { targetFlowId: string; mode?: 'goto' | 'call'; returnNodeId?: string | null } | undefined,
  next: FlowStepResult['next'],
  hasFrames: boolean,
): HopIntent {
  if (gotoEff) return gotoEff.mode === 'call' ? 'call' : 'switch';
  if (next === 'end' && hasFrames) return 'return';
  return 'stop';
}
```
- [ ] **Step 4: Rodar, ver passar** (flowEngine + flowHop + legados). tsc clean.
- [ ] **Step 5: Commit** — `git commit -m "feat(maestro): goto_flow modo call + nextHopIntent (1C subfluxos)"`

---

## Task C2: runtime — call/return no hop loop + persistência do callStack
**Files:** modify `flowRuntime.ts`. (+ teste de integração se viável.)

- [ ] **Step 1: Implementar em `flowRuntime.ts`** (ler o trecho 100-235):
  1. Importar `nextHopIntent` de `./flowHop.js`. Definir `type Frame = { flowId: string; returnNodeId: string | null }`.
  2. `StoredFlowState` (interface no arquivo) += `callStack?: Frame[]`.
  3. Ao carregar o estado (perto da linha 104, onde faz `JSON.parse`), inicializar `let callStack: Frame[] = Array.isArray(state.callStack) ? state.callStack : [];`.
  4. Reescrever o hop loop (167-206) para tratar os 4 intents:
```ts
    for (let hop = 0; hop <= MAX_FLOW_HOPS; hop++) {
      const graph: FlowGraph = {
        nodes: Array.isArray(currentFlow.nodes) ? (currentFlow.nodes as unknown as FlowNode[]) : [],
        edges: Array.isArray(currentFlow.edges) ? (currentFlow.edges as unknown as FlowEdge[]) : [],
      };
      if (graph.nodes.length === 0) return null;

      result = resolveFlowStep(graph, currentState, messageContent, { hasIncomingMessage: !consumedMessage, ctx });
      consumedMessage = true;

      hopRecords.push({ flowId: currentFlow.id, nodes: Array.isArray(currentFlow.nodes) ? (currentFlow.nodes as any[]) : [], visitedNodeIds: result.visitedNodeIds ?? [] });

      const gotoEff = result.effects.find((e) => e.kind === 'goto_flow') as
        | { kind: 'goto_flow'; targetFlowId: string; mode?: 'goto' | 'call'; returnNodeId?: string | null }
        | undefined;
      aggregated.push(...result.effects.filter((e) => e.kind !== 'goto_flow'));

      const intent = nextHopIntent(gotoEff, result.next, callStack.length > 0);
      if (intent === 'stop') break;
      if (hop === MAX_FLOW_HOPS) { logger.warn('[Maestro] limite de hops atingido', { organizationId, conversationId }); break; }

      if (intent === 'call' || intent === 'switch') {
        const target = flows.find((f) => f.id === gotoEff!.targetFlowId && f.isActive);
        if (!target) { logger.warn('[Maestro] goto_flow alvo inexistente/inativo — seguindo no atual', { organizationId, from: currentFlow.id, target: gotoEff!.targetFlowId }); break; }
        if (intent === 'call') callStack.push({ flowId: currentFlow.id, returnNodeId: gotoEff!.returnNodeId ?? null });
        currentFlow = target;
        currentState = { cursor: null, vars: result.state?.vars ?? {} };
        continue;
      }
      // intent === 'return'
      const frame = callStack.pop()!;
      const caller = flows.find((f) => f.id === frame.flowId && f.isActive);
      if (!caller) { logger.warn('[Maestro] subfluxo: chamador sumiu — encerrando', { organizationId, callerId: frame.flowId }); break; }
      currentFlow = caller;
      currentState = { cursor: frame.returnNodeId, vars: result.state?.vars ?? {} };
      continue;
    }
```
  (Preserve `aggregated`, `hopRecords`, `consumedMessage`, `result` exatamente como hoje; só a estrutura de decisão muda.)
  5. Persistência (229-231): incluir `callStack` no estado salvo mid-flow e na conclusão:
```ts
    const nextCursor = result.state?.cursor ?? null;
    const endedReal = nextCursor === null && callStack.length === 0;
    if (!endedReal) {
      await cache.set(stateKey, JSON.stringify({ ...result.state, flowId: currentFlow.id, callStack }), FLOW_STATE_TTL);
    } else {
      await cache.set(stateKey, JSON.stringify({ cursor: FLOW_ENDED, vars: result.state?.vars || {}, callStack: [] }), FLOW_STATE_TTL);
    }
```
  ATENÇÃO: hoje a condição é `nextCursor !== null`. Com subfluxos, um `result` com `cursor null` mas `callStack` não-vazio NÃO deveria acontecer (o loop só para em 'stop' = await_input/ai/scheduled [cursor != null] OU end-com-pilha-vazia). Mesmo assim, `endedReal` cobre o caso corretamente. Se `result.next` for await_input/scheduled, `result.state.cursor` != null → persiste com callStack. ✓

- [ ] **Step 2: Teste de integração (se viável)** — criar `apps/api/src/agents/flowRuntime.subflow.test.ts` mockando `@zappiq/database` (prisma.flow.findMany retornando caller+sub, etc.), `../services/cloud/index.js` (cache get/set in-memory), `../services/flowScheduler.js` (cancelPendingWaitTimers/scheduleFlowTimer no-op), `../services/flowAnalytics.js` (recordNodeStats no-op), `./flowRouter.js` se necessário. Cenário: caller = `[start → goto_flow(call SUB) → message("voltei")]`, SUB = `[start → message("no sub")]`. Primeira chamada (first_contact) → espera efeitos `send_text("no sub")` E `send_text("voltei")` (chamou o sub, voltou e seguiu). Se a fiação de mocks for muito custosa/instável, PULE este teste, cubra a decisão via `flowHop.test.ts` (já feito em C1) e DESCREVA no relatório que o ciclo runtime será validado por smoke manual.
- [ ] **Step 3: Verificar** — `pnpm --filter @zappiq/api exec tsc --noEmit` + `pnpm --filter @zappiq/api exec vitest run src/agents src/services` (verde exceto izaTurnRouter).
- [ ] **Step 4: Commit** — `git commit -m "feat(maestro): runtime call/return de subfluxos + callStack persistido (1C)"`

---

## Task C3: editor — toggle de modo no nó goto_flow
**Files:** modify `apps/web/app/(dashboard)/flows/page.tsx`.

- [ ] **Step 1: Implementar** — no `NodeProperties`, no branch `node.type === 'goto_flow'`, abaixo do select de `targetFlowId`, adicionar um select de modo:
```tsx
<div>
  <label className="text-[10px] text-gray-500">Comportamento</label>
  <select className={inputCls} value={(data?.mode as string) || 'goto'} onChange={(e) => onChange({ mode: e.target.value })}>
    <option value="goto">Enviar para o fluxo (não volta)</option>
    <option value="call">Chamar e voltar quando terminar</option>
  </select>
</div>
```
(Use a variável real do inspector — `data`/`onChange`/`inputCls` como nos outros branches. Se o branch goto_flow tiver nomes diferentes, adapte.) Opcional: no `nodeSummary` do goto_flow, mostrar "↪ chamar" quando `mode==='call'`.
- [ ] **Step 2: Typecheck** — `pnpm --filter @zappiq/web exec tsc --noEmit` limpo.
- [ ] **Step 3: Commit** — `git commit -m "feat(web): modo chamar-e-voltar no nó goto_flow (1C)"`

---

## Task C4: smoke/doc
- [ ] Criar `docs/maestro/smoke-1c.md`: caller com `goto_flow` modo "call" para um SUB; rodar → o sub executa e o caller retoma no nó seguinte; testar subfluxo com `ask` (cross-turn: o sub aguarda input, responde, depois volta ao caller); testar `mode goto` (one-way) inalterado. Commit.

## Cobertura do spec
| Item | Task |
|---|---|
| goto_flow modo call + nextHopIntent | C1 |
| runtime call/return + callStack persistido | C2 |
| toggle no editor | C3 |
| smoke | C4 |

## Notas
- Retrocompat: `goto_flow` sem `mode` = one-way idêntico; `callStack` ausente = sem subfluxos.
- Anti-loop `MAX_FLOW_HOPS` já limita call/return infinitos.
- Pilha persiste no cache (TTL 7d) → subfluxos cross-turn funcionam.
