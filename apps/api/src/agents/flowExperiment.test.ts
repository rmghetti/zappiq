import { describe, it, expect } from 'vitest';
import { assignVariant, computeAbResults, type Experiment } from './flowExperiment.js';

const exp = (p: Partial<Experiment> = {}): Experiment => ({ active: true, variantFlowId: 'B', splitPercent: 50, ...p });

describe('assignVariant', () => {
  it('determinístico: mesma seed → mesma variante', () => {
    const a = assignVariant(exp(), 'conv-123');
    const b = assignVariant(exp(), 'conv-123');
    expect(a).toBe(b);
  });
  it('splitPercent 0 → sempre A', () => {
    for (const s of ['a', 'b', 'c', 'd', 'e']) expect(assignVariant(exp({ splitPercent: 0 }), s)).toBe('A');
  });
  it('splitPercent 100 → sempre B', () => {
    for (const s of ['a', 'b', 'c', 'd', 'e']) expect(assignVariant(exp({ splitPercent: 100 }), s)).toBe('B');
  });
  it('inativo ou sem variantFlowId → A', () => {
    expect(assignVariant(exp({ active: false }), 'x')).toBe('A');
    expect(assignVariant(exp({ variantFlowId: '' }), 'x')).toBe('A');
  });
  it('split 50 distribui ~metade num conjunto grande de seeds', () => {
    let b = 0;
    const N = 400;
    for (let i = 0; i < N; i++) if (assignVariant(exp({ splitPercent: 50 }), 'seed-' + i) === 'B') b++;
    expect(b).toBeGreaterThan(N * 0.35);
    expect(b).toBeLessThan(N * 0.65);
  });
});

describe('computeAbResults', () => {
  const aStats = [
    { nodeId: 'start', nodeType: 'start', entries: 100, ends: 0 },
    { nodeId: 'conv', nodeType: 'message', entries: 30, ends: 30 },
  ];
  const bStats = [
    { nodeId: 'start', nodeType: 'start', entries: 100, ends: 0 },
    { nodeId: 'conv', nodeType: 'message', entries: 55, ends: 55 },
  ];
  it('conversão por nó de conversão + aponta vencedor B', () => {
    const r = computeAbResults({ aStats: aStats as any, bStats: bStats as any, conversionNodeId: 'conv', entryNodeId: 'start' });
    const a = r.variants.find((v) => v.variant === 'A')!;
    const b = r.variants.find((v) => v.variant === 'B')!;
    expect(a.conversionRate).toBeCloseTo(0.30, 2);
    expect(b.conversionRate).toBeCloseTo(0.55, 2);
    expect(r.winner).toBe('B');
  });
  it('sem dados → inconclusivo (winner null)', () => {
    const r = computeAbResults({ aStats: [], bStats: [], conversionNodeId: 'conv', entryNodeId: 'start' });
    expect(r.winner).toBeNull();
  });
  it('sem conversionNodeId → usa taxa de conclusão (ends/entries de entrada)', () => {
    const r = computeAbResults({ aStats: aStats as any, bStats: bStats as any, entryNodeId: 'start' });
    // conclusão = sum(ends)/entries(start): A=30/100=0.30, B=55/100=0.55
    expect(r.variants.find((v) => v.variant === 'A')!.conversionRate).toBeCloseTo(0.30, 2);
    expect(r.winner).toBe('B');
  });
});
