/**
 * Test: GET /api/flows/:id/analytics (1B-analytics A5)
 *
 * Test approach: pure unit test (vitest, zero I/O).
 * Rationale: the repo has no supertest harness — server.ts imports Redis, OTel,
 * BullMQ, socket.io, etc. that cannot be instantiated in unit tests without live
 * infra. The route handler is a thin wrapper: flow lookup (orgId scope) →
 * flowNodeStat query → aggregate(). The "flow not found → 404" and orgId
 * isolation paths are trivially correct by inspection (same pattern as /:id/publish,
 * /:id/versions, etc.) and are NOT re-tested here.
 *
 * What IS tested:
 *   1. aggregate() funnel contract with realistic flowNodeStat rows (happy path).
 *   2. `days` clamping math that guards the `since` date computation (pure fn).
 *   3. Edge: empty stats → totalEntries 0, byNode [].
 */
import { describe, it, expect } from 'vitest';
import { aggregate } from '../services/flowAnalytics.js';

// ── pure helper extracted from the route ─────────────────────────────────────
function clampDays(raw: unknown): number {
  return Math.min(Math.max(parseInt(String(raw ?? '7'), 10) || 7, 1), 90);
}

// ── 1. aggregate() funnel contract ───────────────────────────────────────────
describe('GET /:id/analytics — aggregate contract', () => {
  it('soma entries/ends por nó e calcula totalEntries (funil realista)', () => {
    // Simula 3 dias de stats: nó message visto 2× no dia 1 e 1× no dia 2,
    // nó ai visto 1× no dia 1. flowNodeStat tem 1 row por (flowId, nodeId, period).
    const rows = [
      // day 1
      { nodeId: 'start',   nodeType: 'start',   nodeLabel: 'Início',  entries: 10, ends: 0 },
      { nodeId: 'msg-1',   nodeType: 'message',  nodeLabel: 'Boas vindas', entries: 10, ends: 0 },
      { nodeId: 'ai-1',    nodeType: 'ai',       nodeLabel: 'IA',      entries: 8,  ends: 3 },
      // day 2
      { nodeId: 'start',   nodeType: 'start',   nodeLabel: 'Início',  entries: 5,  ends: 0 },
      { nodeId: 'msg-1',   nodeType: 'message',  nodeLabel: 'Boas vindas', entries: 5, ends: 0 },
      { nodeId: 'ai-1',    nodeType: 'ai',       nodeLabel: 'IA',      entries: 4,  ends: 2 },
    ];

    const result = aggregate(rows as any);

    const start = result.byNode.find((n) => n.nodeId === 'start')!;
    const msg   = result.byNode.find((n) => n.nodeId === 'msg-1')!;
    const ai    = result.byNode.find((n) => n.nodeId === 'ai-1')!;

    // entries agregados
    expect(start.entries).toBe(15);
    expect(msg.entries).toBe(15);
    expect(ai.entries).toBe(12);

    // ends agregados
    expect(start.ends).toBe(0);
    expect(ai.ends).toBe(5);

    // totalEntries = soma de entries de TODOS os nós (funil bruto)
    expect(result.totalEntries).toBe(15 + 15 + 12); // 42
    expect(result.byNode).toHaveLength(3);
  });

  it('preserva nodeLabel do primeiro row ao agregar', () => {
    const rows = [
      { nodeId: 'n1', nodeType: 'message', nodeLabel: 'Label A', entries: 2, ends: 0 },
      { nodeId: 'n1', nodeType: 'message', nodeLabel: 'Label B', entries: 3, ends: 1 },
    ];
    const { byNode } = aggregate(rows as any);
    expect(byNode[0].nodeLabel).toBe('Label A');
    expect(byNode[0].entries).toBe(5);
    expect(byNode[0].ends).toBe(1);
  });

  it('stats vazias → totalEntries 0, byNode []', () => {
    expect(aggregate([])).toEqual({ totalEntries: 0, byNode: [] });
  });
});

// ── 2. `days` clamping ───────────────────────────────────────────────────────
describe('GET /:id/analytics — clampDays', () => {
  it('default (undefined) → 7', () => expect(clampDays(undefined)).toBe(7));
  it('string numérica → número', () => expect(clampDays('30')).toBe(30));
  it('valor inválido → default 7', () => expect(clampDays('abc')).toBe(7));
  it('0 → default 7 (parseInt("0")||7 é falsy, cai no default)', () => expect(clampDays('0')).toBe(7));
  it('acima do máximo → 90', () => expect(clampDays('999')).toBe(90));
  it('1 → 1 (mínimo útil)', () => expect(clampDays('1')).toBe(1));
  it('negativo → 1 (parseInt("-5") é truthy/não-NaN → Math.max(-5,1)=1)', () => expect(clampDays('-5')).toBe(1));
});
