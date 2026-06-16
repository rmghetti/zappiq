import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@zappiq/database', () => ({
  prisma: { $executeRaw: vi.fn().mockResolvedValue(1) },
  Prisma: { sql: (strings: TemplateStringsArray, ...vals: any[]) => ({ strings, vals }), join: (a: any[]) => a, raw: (s: string) => s },
}));
vi.mock('../utils/logger.js', () => ({ logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() } }));
import { prisma } from '@zappiq/database';
import { recordNodeStats } from './flowAnalytics.js';

const graph = { nodes: [{ id: 'm', type: 'message', data: { label: 'Msg' } }, { id: 'a', type: 'ai', data: { label: 'IA' } }] };

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
  it('sem nós visitados → nenhum upsert', async () => {
    await recordNodeStats({ organizationId: 'o1', flowId: 'f1', graph: graph as any, visitedNodeIds: [], ended: false });
    expect((prisma.$executeRaw as any).mock.calls.length).toBe(0);
  });
});
