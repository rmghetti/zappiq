# Maestro v3 — Spec 1B-Analytics: Funil/Drop-off por Nó (Design)

> **Data:** 2026-06-14 · **Status:** aprovado (autonomia delegada), pronto para plano
> **Pacote:** 1 (Fundação) — item 4. Fecha o Pacote 1 junto com 1C (subfluxos).
> **Depende de:** 1A (motor/editor). Pré-requisito do Pacote 2 (auto-otimização lê este funil).

---

## 1. Objetivo

Medir, por fluxo, **quantos contatos passam por cada nó** e **onde abandonam** — funil e drop-off — exibidos no canvas. Hoje não há analytics por nó (só `LLMCallLog`/`Activity`/`TenantUsageMonthly`).

## 2. Decisão de modelagem (contadores pré-agregados)

Em vez de uma linha por passo (`FlowStepEvent` — explode em volume num chatbot), uso **contadores pré-agregados por nó/dia** com upsert atômico (`INSERT … ON CONFLICT … DO UPDATE SET entries = entries + …`). Escala (uma linha por nó-dia, não por evento), é suficiente para funil/drop-off, e zero risco de inchar o banco. Trade-off: não dá para reconstruir jornadas individuais (isso seria um `FlowStepEvent` cru — Pacote 2 se necessário).

## 3. Modelo de dados

`FlowNodeStat` (Prisma + migration idempotente com RLS, padrão do repo):
```
model FlowNodeStat {
  id             String   @id @default(cuid())
  organizationId String
  flowId         String
  nodeId         String
  nodeType       String
  nodeLabel      String?
  period         String   // 'YYYY-MM-DD' (UTC)
  entries        Int      @default(0)  // nº de vezes que o walk visitou o nó
  ends           Int      @default(0)  // nº de vezes que o fluxo encerrou neste nó
  updatedAt      DateTime @updatedAt
  createdAt      DateTime @default(now())
  @@unique([flowId, nodeId, period])
  @@index([organizationId, flowId])
  @@map("flow_node_stats")
}
```
RLS `flow_node_stats_tenant_isolation` + GRANT condicional `app_user` (padrão `20260611_maestro_v2…`). Relations em `Flow`/`Organization`.

## 4. Captura (motor puro → runtime IO)

- **Motor (`flowEngine.resolveFlowStep`)**: passa a retornar `visitedNodeIds: string[]` — os ids dos nós que o walk visitou neste passo, na ordem. Puro (só acumula durante o walk). Não muda mais nada.
- **Runtime (`flowRuntime.resolveActiveFlowStep`)** e **`flowScheduler`** (retomada por timer): após `resolveFlowStep`, chamam `recordNodeStats({ organizationId, flowId, graph, visitedNodeIds, ended: result.next==='end' })` (novo serviço IO). Para cada nó visitado → `entries+1`; se `ended`, o **último** nó visitado → `ends+1`. Tipo/label vêm do `graph`. **Fail-soft**: try/catch que nunca derruba o turno (Maestro é aditivo). Período = data UTC `YYYY-MM-DD`.
- **Emissão atômica**: `recordNodeStats` usa `prisma.$executeRaw` com `INSERT … ON CONFLICT (flowId,nodeId,period) DO UPDATE SET entries = flow_node_stats.entries + EXCLUDED.entries, ends = flow_node_stats.ends + EXCLUDED.ends, "updatedAt" = now()` — uma instrução por nó (ou um INSERT múltiplo). Sem race de create/update.

## 5. Agregação + API

`GET /api/flows/:id/analytics?days=7` (em `routes/flows.ts`, padrão `req.organizationId!` + checagem `flowId`+org):
- Soma `entries`/`ends` por `nodeId` no período (`period >= hoje-N`), para o `flowId` da org.
- Retorna `{ totalEntries, byNode: [{ nodeId, nodeType, nodeLabel, entries, ends, dropoff }] }`, onde `dropoff` é calculado no front (ou retornado): entradas do nó menos entradas dos sucessores.
- Serviço puro de agregação `flowAnalytics.aggregate(rows)` testável; a query (IO) fica na rota/serviço.

## 6. Dashboard (mínimo, alinhado ao canvas auditável)

No editor (`flows/page.tsx`): um **toggle "Métricas"**. Ligado → busca `GET /api/flows/:id/analytics?days=7` e mostra em cada nó do canvas um **badge com `entries`** (e, no nó, `ends` se houver) via `MaestroNode`. Um resumo no topo (total de entradas, nó com maior drop-off). Sem nova página; reusa o `api` client. Fail-soft (analytics indisponível → canvas normal).

## 7. Tratamento de erros
- Emissão fail-soft (erro de DB nunca derruba o turno/timer).
- Rota: 404 se o fluxo não é da org; analytics vazio → `byNode: []` (front mostra "sem dados ainda").
- `visitedNodeIds` no motor não altera nenhum comportamento existente (campo aditivo no resultado).

## 8. Testes
- **Puro**: motor retorna `visitedNodeIds` corretos (start→message→ai visita os 3; condition ramifica visita só o ramo; retomada por timer); `flowAnalytics.aggregate` soma/ordena e calcula drop-off.
- **Integração**: `recordNodeStats` (mock prisma `$executeRaw`) — chama o upsert certo por nó + ends no último quando ended; fail-soft em erro.
- **Rota**: `GET /:id/analytics` retorna agregação (mock prisma) + 404 fora da org.
- Frontend: typecheck + verificação manual (auth-gated).

## 9. Escopo / YAGNI
- **Dentro**: FlowNodeStat + captura + agregação + API + badges no canvas.
- **Fora**: jornadas individuais (event log cru), métricas de tempo/latência por nó, A/B (Pacote 3), export. Funil/drop-off por nó é o suficiente para o Pacote 2.

## 10. Referências
- Migração-padrão: `packages/database/prisma/migrations/20260611_maestro_v2_versions_timers/migration.sql` (RLS + GRANT condicional).
- `flowEngine.ts` (FlowStepResult), `flowRuntime.ts`/`flowScheduler.ts` (emissão), `routes/flows.ts` (API), `flows/page.tsx` + `MaestroNode` (badges).
