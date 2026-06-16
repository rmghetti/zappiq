import { describe, it, expect } from 'vitest';
import { rankDropoffNodes } from './flowOptimizer.js';

const graph = {
  nodes: [
    { id: 'm1', type: 'message' }, { id: 'm2', type: 'message' },
    { id: 'a1', type: 'ai' }, { id: 'term', type: 'message' }, { id: 'c', type: 'condition' },
  ],
  edges: [
    { source: 'm1', target: 'm2' }, { source: 'm2', target: 'a1' }, { source: 'a1', target: 'term' },
    // term has NO outgoing edge → terminal
    { source: 'c', target: 'm1' },
  ],
};

describe('rankDropoffNodes', () => {
  it('ranqueia message/ai por dropoffRate desc, ignora terminais e entries baixos', () => {
    const byNode = [
      { nodeId: 'm1', nodeType: 'message', nodeLabel: 'M1', entries: 100, ends: 10 }, // 0.10
      { nodeId: 'm2', nodeType: 'message', nodeLabel: 'M2', entries: 80, ends: 56 },  // 0.70 ← pior
      { nodeId: 'a1', nodeType: 'ai', nodeLabel: 'A1', entries: 20, ends: 6 },        // 0.30
      { nodeId: 'term', nodeType: 'message', nodeLabel: 'T', entries: 50, ends: 50 }, // terminal → excluído
      { nodeId: 'low', nodeType: 'message', nodeLabel: 'L', entries: 3, ends: 3 },    // entries<5 → excluído
    ];
    const r = rankDropoffNodes(byNode as any, graph as any);
    expect(r.map((n) => n.nodeId)).toEqual(['m2', 'a1', 'm1']);
    expect(r[0].dropoffRate).toBeCloseTo(0.70, 2);
    expect(r.find((n) => n.nodeId === 'term')).toBeUndefined();
    expect(r.find((n) => n.nodeId === 'low')).toBeUndefined();
  });

  it('exclui condition/ask (não-message/ai)', () => {
    const r = rankDropoffNodes([{ nodeId: 'c', nodeType: 'condition', nodeLabel: 'C', entries: 100, ends: 90 }] as any, graph as any);
    expect(r).toEqual([]);
  });

  it('sem dados → []', () => {
    expect(rankDropoffNodes([], graph as any)).toEqual([]);
  });
});
