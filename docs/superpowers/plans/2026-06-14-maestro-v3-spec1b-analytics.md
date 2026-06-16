# Maestro v3 — Spec 1B-Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Pure modules use TDD. Backend test: `pnpm --filter @zappiq/api exec vitest run <pattern>`. ESM `.js` suffix. Branch: `maestro-v3-spec1a-motor`.

**Goal:** Funil/drop-off por nó: capturar contadores pré-agregados por nó/dia, agregar via API, exibir no canvas. Spec: `docs/superpowers/specs/2026-06-14-maestro-v3-spec1b-analytics-design.md`.

**Contratos (do Explore):** migração-padrão RLS+GRANT em `packages/database/prisma/migrations/20260611_maestro_v2_versions_timers/migration.sql`; `FlowStepResult` em `flowEngine.ts`; emissão em `flowRuntime.resolveActiveFlowStep` e `flowScheduler` worker (após `resolveFlowStep`); rota auth `req.organizationId!` em `routes/flows.ts`; canvas `MaestroNode` + `api` client.

---

## Estrutura de arquivos
| Arquivo | Ação |
|---|---|
| `packages/database/prisma/schema.prisma` | + model `FlowNodeStat` (+ relations em Flow/Organization) |
| `packages/database/prisma/migrations/20260614_flow_node_stats/migration.sql` | criar (idempotente + RLS) |
| `apps/api/src/agents/flowEngine.ts` | `FlowStepResult.visitedNodeIds` + acumular no walk |
| `apps/api/src/services/flowAnalytics.ts` | `aggregate(rows)` puro + `recordNodeStats` (IO) |
| `apps/api/src/services/flowAnalytics.test.ts` | testes de aggregate |
| `apps/api/src/services/flowAnalytics.record.test.ts` | testes de recordNodeStats (mock prisma) |
| `apps/api/src/agents/flowRuntime.ts` | chamar recordNodeStats (fail-soft) |
| `apps/api/src/services/flowScheduler.ts` | chamar recordNodeStats no timer-resume (fail-soft) |
| `apps/api/src/routes/flows.ts` | `GET /:id/analytics` |
| `apps/api/src/routes/flows.analytics.test.ts` | teste da rota (mock prisma) |
| `apps/web/app/(dashboard)/flows/page.tsx` | toggle Métricas + badges nos nós |

---

## Task A1: Modelo + migração FlowNodeStat
**Files:** modify `schema.prisma`; create migration.

- [ ] **Step 1: Adicionar o model em `packages/database/prisma/schema.prisma`** (perto de FlowTimer):
```prisma
model FlowNodeStat {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  flowId         String
  flow           Flow     @relation(fields: [flowId], references: [id], onDelete: Cascade)
  nodeId         String
  nodeType       String
  nodeLabel      String?
  period         String   // 'YYYY-MM-DD' UTC
  entries        Int      @default(0)
  ends           Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@unique([flowId, nodeId, period])
  @@index([organizationId, flowId])
  @@map("flow_node_stats")
}
```
Adicionar as back-relations: em `model Flow { ... nodeStats FlowNodeStat[] }` e `model Organization { ... flowNodeStats FlowNodeStat[] }`.

- [ ] **Step 2: Criar `packages/database/prisma/migrations/20260614_flow_node_stats/migration.sql`** (espelhar o padrão idempotente de `20260611_maestro_v2_versions_timers/migration.sql` — ler antes):
```sql
-- Maestro 1B-analytics — contadores por nó/dia (funil/drop-off)
CREATE TABLE IF NOT EXISTS "flow_node_stats" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "nodeType" TEXT NOT NULL,
  "nodeLabel" TEXT,
  "period" TEXT NOT NULL,
  "entries" INTEGER NOT NULL DEFAULT 0,
  "ends" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "flow_node_stats_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "flow_node_stats_flowId_nodeId_period_key" ON "flow_node_stats"("flowId","nodeId","period");
CREATE INDEX IF NOT EXISTS "flow_node_stats_organizationId_flowId_idx" ON "flow_node_stats"("organizationId","flowId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flow_node_stats_flowId_fkey') THEN
    ALTER TABLE "flow_node_stats" ADD CONSTRAINT "flow_node_stats_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
ALTER TABLE "flow_node_stats" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS flow_node_stats_tenant_isolation ON "flow_node_stats";
CREATE POLICY flow_node_stats_tenant_isolation ON "flow_node_stats"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "flow_node_stats" TO app_user;
  END IF;
END $$;
```
(Confirme o nome real da tabela de flows — o `@@map` é `flows`. Ajuste se diferente.)

- [ ] **Step 3: Gerar o client** — `pnpm --filter @zappiq/database exec prisma generate` (NÃO rodar migrate dev — a migração é aplicada por `prisma migrate deploy` no release; só geramos o client p/ os tipos). Confirme que `prisma generate` conclui e que `FlowNodeStat` aparece no client.
- [ ] **Step 4: Commit** — `git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/20260614_flow_node_stats && git commit -m "feat(db): modelo FlowNodeStat + migração RLS (1B-analytics)"`

---

## Task A2: motor retorna visitedNodeIds (puro)
**Files:** modify `flowEngine.ts` + `flowEngine.test.ts`.

- [ ] **Step 1: Teste que falha** (append no describe do flowEngine.test.ts):
```ts
  it('retorna visitedNodeIds na ordem do walk', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'm', type: 'message', data: { text: 'oi' } },
        { id: 'a', type: 'ai', data: { prompt: 'p' } },
      ],
      edges: [{ source: 's', target: 'm' }, { source: 'm', target: 'a' }],
    };
    const r = resolveFlowStep(graph, { cursor: null, vars: {} }, 'oi', { ctx: DEFAULT_CTX });
    expect(r.visitedNodeIds).toEqual(['s', 'm', 'a']);
  });

  it('condition: visitedNodeIds inclui o condition e o ramo seguido', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'c', type: 'condition' },
        { id: 'sim', type: 'message', data: { text: 'sim' } },
        { id: 'nao', type: 'message', data: { text: 'nao' } },
      ],
      edges: [
        { source: 'c', target: 'sim', data: { when: { match: 'contains', value: 'quero' } } },
        { source: 'c', target: 'nao', data: { when: { match: 'else' } } },
      ],
    };
    const r = resolveFlowStep(graph, { cursor: 'c', vars: {} }, 'quero', { ctx: DEFAULT_CTX });
    expect(r.visitedNodeIds).toContain('c');
    expect(r.visitedNodeIds).toContain('sim');
    expect(r.visitedNodeIds).not.toContain('nao');
  });
```

- [ ] **Step 2: Rodar, ver falhar.**
- [ ] **Step 3: Implementar** — em `flowEngine.ts`: adicionar `visitedNodeIds: string[]` a `FlowStepResult`. No `resolveFlowStep`, declarar `const visited: string[] = []` no topo; dentro do loop do walk, ao entrar em cada nó válido (logo após obter `node`), `visited.push(node.id)` (uma vez por nó visitado). Incluir `visitedNodeIds: visited` em TODOS os `return { ... }` do resolveFlowStep (await_input, ai, end, scheduled, default). Garanta que nós deterministicamente atravessados (start/message/tag/etc.) e o nó terminal entrem na lista, e que o condition entre antes de ramificar.
- [ ] **Step 4: Rodar, ver passar** (incl. testes legados — o campo é aditivo). `pnpm --filter @zappiq/api exec vitest run flowEngine`.
- [ ] **Step 5: Commit** — `git commit -m "feat(maestro): resolveFlowStep retorna visitedNodeIds (1B-analytics)"`

---

## Task A3: flowAnalytics — aggregate (puro) + recordNodeStats (IO)
**Files:** create `flowAnalytics.ts` + 2 test files.

- [ ] **Step 1: Teste de `aggregate` (puro)** — `flowAnalytics.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { aggregate } from './flowAnalytics.js';

describe('aggregate', () => {
  it('soma entries/ends por nó e calcula totalEntries', () => {
    const rows = [
      { nodeId: 'm', nodeType: 'message', nodeLabel: 'Msg', entries: 5, ends: 0 },
      { nodeId: 'm', nodeType: 'message', nodeLabel: 'Msg', entries: 3, ends: 1 },
      { nodeId: 'a', nodeType: 'ai', nodeLabel: 'IA', entries: 4, ends: 2 },
    ];
    const r = aggregate(rows as any);
    const m = r.byNode.find((n) => n.nodeId === 'm');
    expect(m!.entries).toBe(8);
    expect(m!.ends).toBe(1);
    expect(r.totalEntries).toBe(12);
  });

  it('vazio → byNode [] e totalEntries 0', () => {
    expect(aggregate([])).toEqual({ totalEntries: 0, byNode: [] });
  });
});
```

- [ ] **Step 2: Teste de `recordNodeStats` (IO, mock prisma)** — `flowAnalytics.record.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@zappiq/database', () => ({ prisma: { $executeRaw: vi.fn().mockResolvedValue(1) } }));
vi.mock('../utils/logger.js', () => ({ logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() } }));
import { prisma } from '@zappiq/database';
import { recordNodeStats } from './flowAnalytics.js';

const graph = { nodes: [{ id: 'm', type: 'message', data: { label: 'Msg' } }, { id: 'a', type: 'ai', data: { label: 'IA' } }], edges: [] };

describe('recordNodeStats', () => {
  beforeEach(() => vi.clearAllMocks());
  it('emite um upsert por nó visitado', async () => {
    await recordNodeStats({ organizationId: 'o1', flowId: 'f1', graph: graph as any, visitedNodeIds: ['m', 'a'], ended: false });
    expect((prisma.$executeRaw as any).mock.calls.length).toBe(2);
  });
  it('fail-soft: erro de DB não lança', async () => {
    (prisma.$executeRaw as any).mockRejectedValueOnce(new Error('db'));
    await expect(recordNodeStats({ organizationId: 'o1', flowId: 'f1', graph: graph as any, visitedNodeIds: ['m'], ended: true })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Rodar, ver falhar.**
- [ ] **Step 4: Implementar `apps/api/src/services/flowAnalytics.ts`:**
  - `export interface NodeStatRow { nodeId: string; nodeType: string; nodeLabel?: string|null; entries: number; ends: number }`
  - `export function aggregate(rows: NodeStatRow[]): { totalEntries: number; byNode: NodeStatRow[] }` — agrupa por nodeId somando entries/ends (mantém nodeType/label do primeiro), totalEntries = soma de entries. Puro.
  - `export async function recordNodeStats(input: { organizationId: string; flowId: string; graph: { nodes: any[] }; visitedNodeIds: string[]; ended: boolean }): Promise<void>` — período = `new Date().toISOString().slice(0,10)` (UTC). Para cada `nodeId` em `visitedNodeIds` (dedupe mantendo contagem? — conte cada visita; se o mesmo nó aparece 2x no walk, conta 2 — use o array como está), monta `entries=1` e `ends=1` só para o ÚLTIMO nó se `ended`. Para cada nó faz um `prisma.$executeRaw` com `INSERT INTO "flow_node_stats" (...) VALUES (...) ON CONFLICT ("flowId","nodeId","period") DO UPDATE SET entries="flow_node_stats".entries+EXCLUDED.entries, ends="flow_node_stats".ends+EXCLUDED.ends, "updatedAt"=now()`. Gera `id` com `crypto.randomUUID()` (este é serviço IO, pode usar). nodeType/label do `graph.nodes.find(id)`. TODO o corpo em try/catch → `logger.warn` e retorna (fail-soft, nunca lança). Use `Prisma.sql`/tagged template do `$executeRaw` com parâmetros (evita SQL injection — nodeId/label vêm do grafo, mas parametrize).
- [ ] **Step 5: Rodar, ver passar.**
- [ ] **Step 6: Commit** — `git commit -m "feat(maestro): flowAnalytics aggregate + recordNodeStats fail-soft (1B-analytics)"`

---

## Task A4: emitir stats no runtime + scheduler (fail-soft)
**Files:** modify `flowRuntime.ts`, `flowScheduler.ts`.

- [ ] **Step 1: flowRuntime** — após o loop de hops e a obtenção do `result` final (antes ou junto à persistência do cursor), chamar (fail-soft, sem await que derrube):
```ts
try {
  await recordNodeStats({ organizationId, flowId: currentFlow.id, graph: { nodes: currentFlow.nodes as any[] }, visitedNodeIds: result.visitedNodeIds ?? [], ended: result.next === 'end' });
} catch { /* fail-soft */ }
```
Importar `recordNodeStats` de `../services/flowAnalytics.js`. (Nota: `currentFlow` é o fluxo dono do último resolve; `result.visitedNodeIds` vem do motor.)
- [ ] **Step 2: flowScheduler** — no worker, após o `resolveFlowStep` do timer-resume, idem: `recordNodeStats({ organizationId: timer.organizationId, flowId: timer.flowId, graph: { nodes: <nodes do flow carregado> }, visitedNodeIds: result.visitedNodeIds ?? [], ended: result.next==='end' })` em try/catch. Use a variável de nodes já carregada no worker (o `flow.findUnique` seleciona `nodes`).
- [ ] **Step 3: Verificar** — `pnpm --filter @zappiq/api exec tsc --noEmit && pnpm --filter @zappiq/api exec vitest run src/agents src/services`. Tudo verde (emissão é aditiva, mockada onde testada).
- [ ] **Step 4: Commit** — `git commit -m "feat(maestro): emite node stats no runtime e timer-resume (1B-analytics)"`

---

## Task A5: rota GET /:id/analytics
**Files:** modify `routes/flows.ts`; create `flows.analytics.test.ts`.

- [ ] **Step 1: Teste da rota** (mock prisma `flow.findFirst` + `flowNodeStat.findMany`) — mirror existing route-test style in the repo (read another `routes/*.test.ts` first; if none, write a minimal supertest/express test or a unit test calling the handler). If route tests are awkward in this repo, instead unit-test a small `buildAnalyticsResponse(flow, rows)` helper and trust the thin handler. Choose what fits the repo's conventions and report.
- [ ] **Step 2: Implementar a rota** em `routes/flows.ts`:
```ts
router.get('/:id/analytics', async (req, res, next) => {
  try {
    const orgId = req.organizationId!;
    const flow = await prisma.flow.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!flow) { res.status(404).json({ error: 'Flow not found' }); return; }
    const days = Math.min(Math.max(parseInt(String(req.query.days ?? '7'), 10) || 7, 1), 90);
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const rows = await prisma.flowNodeStat.findMany({
      where: { flowId: flow.id, organizationId: orgId, period: { gte: since } },
      select: { nodeId: true, nodeType: true, nodeLabel: true, entries: true, ends: true },
    });
    const agg = aggregate(rows);
    res.json({ success: true, data: agg });
  } catch (err) { next(err); }
});
```
Importar `aggregate` de `../services/flowAnalytics.js`. Posicionar a rota ANTES de qualquer `router.get('/:id')` genérico que possa engolir (cheque a ordem — `/:id/analytics` é mais específico, mas em Express a ordem importa; coloque-a junto às outras subrotas de `:id` como `/:id/publish`).
- [ ] **Step 3: Verificar** — tsc + testes.
- [ ] **Step 4: Commit** — `git commit -m "feat(api): GET /flows/:id/analytics (funil por nó) (1B-analytics)"`

---

## Task A6: badges de métricas no canvas
**Files:** modify `apps/web/app/(dashboard)/flows/page.tsx`.

- [ ] **Step 1: Implementar** (ler o arquivo; integrar minimamente):
  - Estado `const [metrics, setMetrics] = useState<Record<string, {entries:number;ends:number}>|null>(null)` e `const [showMetrics, setShowMetrics] = useState(false)`.
  - Quando `showMetrics` liga (e há `flow.id`): `api.get(\`/flows/\${flow.id}/analytics?days=7\`)` → montar `metrics` como mapa `nodeId → {entries,ends}` a partir de `data.byNode`. Fail-soft (catch → metrics null).
  - Um botão "Métricas" na toolbar que alterna `showMetrics`.
  - No `MaestroNode` (ou via prop), quando `showMetrics && metrics`, renderizar um badge pequeno no canto do nó: `▶ {entries}` e, se `ends>0`, `⏹ {ends}`. Passar `metrics`/`showMetrics` ao MaestroNode via `data` ou contexto do ReactFlow (siga o padrão do arquivo — se MaestroNode lê só `node.data`, injete os números no `data` dos nós quando showMetrics, ou use um wrapper). Escolha o caminho de menor risco e descreva.
  - Um resumo opcional no topo: "X entradas em 7d".
- [ ] **Step 2: Typecheck** — `pnpm --filter @zappiq/web exec tsc --noEmit` limpo.
- [ ] **Step 3: Commit** — `git commit -m "feat(web): toggle de métricas + badges por nó no canvas (1B-analytics)"`

---

## Task A7: smoke/doc
- [ ] Criar `docs/maestro/smoke-1b-analytics.md`: rodar um fluxo algumas vezes (mandar mensagens), ligar "Métricas", conferir entries por nó subindo e `ends` no nó terminal; conferir drop-off visível (nó com muitas entradas e poucos sucessores). Commit.

## Cobertura do spec
| Item | Task |
|---|---|
| Modelo FlowNodeStat + migração RLS | A1 |
| visitedNodeIds no motor | A2 |
| aggregate + recordNodeStats | A3 |
| Emissão runtime + timer-resume | A4 |
| API analytics | A5 |
| Badges no canvas | A6 |
| Smoke | A7 |

## Notas
- Tudo aditivo e fail-soft: analytics nunca derruba o turno; `visitedNodeIds` não muda comportamento.
- Migração idempotente (aplicada por `prisma migrate deploy` no release); prod Supabase sem `app_user` → GRANT condicional.
- Upsert atômico por `ON CONFLICT` evita race sob concorrência.
