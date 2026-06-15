/**
 * Test — generateOptimizationSuggestion (Task O2 / Pacote 2.7)
 * ============================================================================
 * Mock style mirrors flowGenerator.rich.test.ts exactly.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock LLMRouter before importing any module that uses it ──────────────────
vi.mock('../services/llm/LLMRouter.js', () => ({
  llmRouter: { complete: vi.fn() },
}));

// ── Mock @zappiq/database (prisma) to satisfy loadBusinessContext ────────────
vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn().mockResolvedValue({
        plan: 'GROWTH',
        settings: { businessName: 'Loja X', niche: 'varejo' },
      }),
    },
    kBDocument: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    QAPair: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// ── Mock logger to silence output ────────────────────────────────────────────
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports after mocks ──────────────────────────────────────────────────────
import { llmRouter } from '../services/llm/LLMRouter.js';
import { generateOptimizationSuggestion } from './flowOptimizer.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────
const flow = {
  name: 'F',
  nodes: [
    { id: 'm1', type: 'message', data: { text: 'Mensagem antiga confusa' } },
    { id: 'm2', type: 'message', data: { text: 'Outra' } },
  ],
  edges: [{ source: 'm1', target: 'm2' }],
};

// m1 has an outgoing edge (m1→m2), m2 has none (terminal) → only m1 qualifies
const byNode = [
  { nodeId: 'm1', nodeType: 'message', nodeLabel: 'M1', entries: 100, ends: 70 },
];

// ─────────────────────────────────────────────────────────────────────────────

describe('generateOptimizationSuggestion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('plano válido → diff no nó de pior drop-off, source ai', async () => {
    (llmRouter.complete as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify({
        value: 'Mensagem nova clara e objetiva',
        changeNote: 'Reescrevi para reduzir abandono.',
      }),
    });

    const r = await generateOptimizationSuggestion({ organizationId: 'o1', flow, byNode });

    expect(r.source).toBe('ai');
    expect(r.diff?.some((d) => d.nodeId === 'm1' && d.after === 'Mensagem nova clara e objetiva')).toBe(true);
    // estrutura intacta: m2 não muda
    expect(r.nodes.find((n: any) => n.id === 'm2').data.text).toBe('Outra');
  });

  it('sem dados de drop-off → fallback (diff vazio, source fallback)', async () => {
    const r = await generateOptimizationSuggestion({ organizationId: 'o1', flow, byNode: [] });

    expect(r.source).toBe('fallback');
    expect(r.diff ?? []).toEqual([]);
    // LLM must NOT be called when there are no drop-off nodes
    expect((llmRouter.complete as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it('LLM falha → fallback', async () => {
    (llmRouter.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));

    const r = await generateOptimizationSuggestion({ organizationId: 'o1', flow, byNode });

    expect(r.source).toBe('fallback');
    expect(r.diff ?? []).toEqual([]);
  });
});
