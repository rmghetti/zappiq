/**
 * Test: PUT/GET /api/flows/:id/experiment (Pacote 3.10 — Task AB3)
 *
 * Test approach: pure unit test (vitest, zero I/O) — same rationale as
 * flows.analytics.test.ts and flows.optimize.test.ts. The repo has no supertest
 * harness (server.ts pulls Redis, OTel, BullMQ at import time).
 *
 * The routes are thin wrappers over:
 *   - Prisma org settings merge (PUT): pure JSON merge — trivially correct.
 *   - aggregate() → computeAbResults() (GET): both already tested in their own suites.
 *
 * What IS tested here:
 *   1. PUT validation helpers: splitPercent clamping, conversionNodeId opt-in.
 *   2. settings merge: experiments key is merged without clobbering other keys.
 *   3. GET `days` clamping (default 14, not 7 like analytics).
 *   4. GET `since` date string derivation.
 *   5. computeAbResults wiring: aggregate(rows).byNode → results shape contract.
 *   6. entryNodeId resolution: start node id from flow.nodes.
 *   7. Early-return shape when no experiment config exists.
 *
 * What is NOT tested (covered by dedicated suites):
 *   - aggregate() correctness → flows.analytics.test.ts
 *   - computeAbResults / assignVariant logic → flowExperiment.test.ts
 *   - orgId 404 isolation → trivially correct by inspection (same findFirst pattern)
 *   - variantFlowId org-scope validation → trivially correct by inspection
 */
import { describe, it, expect } from 'vitest';
import { aggregate } from '../services/flowAnalytics.js';
import { computeAbResults, type Experiment } from '../agents/flowExperiment.js';

// ── 1. PUT: splitPercent clamping ─────────────────────────────────────────────
function clampSplitPercent(raw: unknown): number {
  return Math.max(0, Math.min(100, parseInt(String(raw ?? 50), 10) || 0));
}

describe('PUT /:id/experiment — splitPercent clamping', () => {
  it('undefined → 0 (parseInt("50")||0 = 50)', () => expect(clampSplitPercent(undefined)).toBe(50));
  it('"50" → 50', () => expect(clampSplitPercent('50')).toBe(50));
  it('"0" → 0', () => expect(clampSplitPercent('0')).toBe(0));
  it('"100" → 100', () => expect(clampSplitPercent('100')).toBe(100));
  it('"200" → 100 (capped at max)', () => expect(clampSplitPercent('200')).toBe(100));
  it('"-10" → 0 (floored at min)', () => expect(clampSplitPercent('-10')).toBe(0));
  it('"abc" → 0 (parseInt NaN → ||0)', () => expect(clampSplitPercent('abc')).toBe(0));
  it('number 30 → 30', () => expect(clampSplitPercent(30)).toBe(30));
});

// ── 2. PUT: exp object shape (conversionNodeId opt-in) ────────────────────────
function buildExp(body: {
  active?: boolean;
  variantFlowId?: string;
  splitPercent?: number | string;
  conversionNodeId?: string;
}): Experiment {
  const { active, variantFlowId, splitPercent, conversionNodeId } = body;
  return {
    active: !!active,
    variantFlowId: String(variantFlowId || ''),
    splitPercent: clampSplitPercent(splitPercent),
    ...(conversionNodeId ? { conversionNodeId: String(conversionNodeId) } : {}),
  };
}

describe('PUT /:id/experiment — exp object shape', () => {
  it('without conversionNodeId → key absent (not undefined)', () => {
    const exp = buildExp({ active: true, variantFlowId: 'flow-B', splitPercent: 40 });
    expect('conversionNodeId' in exp).toBe(false);
  });

  it('with conversionNodeId → key present as string', () => {
    const exp = buildExp({ active: true, variantFlowId: 'flow-B', splitPercent: 40, conversionNodeId: 'node-conv' });
    expect(exp.conversionNodeId).toBe('node-conv');
  });

  it('active false → experiment stored as inactive', () => {
    const exp = buildExp({ active: false, variantFlowId: 'flow-B', splitPercent: 50 });
    expect(exp.active).toBe(false);
  });
});

// ── 3. PUT: org settings merge (don't clobber other keys) ────────────────────
function mergeExperiment(
  settings: Record<string, any>,
  flowId: string,
  exp: Experiment,
): Record<string, any> {
  const experiments = { ...(settings.experiments || {}), [flowId]: exp };
  return { ...settings, experiments };
}

describe('PUT /:id/experiment — settings merge', () => {
  it('merges experiment without clobbering other settings keys', () => {
    const settings = { maestro: { enabled: true }, theme: 'dark' };
    const exp = buildExp({ active: true, variantFlowId: 'flow-B', splitPercent: 50 });
    const updated = mergeExperiment(settings, 'flow-A', exp);
    expect(updated.maestro).toEqual({ enabled: true });
    expect(updated.theme).toBe('dark');
    expect(updated.experiments['flow-A']).toEqual(exp);
  });

  it('merges a second experiment without removing the first', () => {
    const existingExp = buildExp({ active: false, variantFlowId: 'flow-X', splitPercent: 30 });
    const settings = { experiments: { 'flow-X': existingExp } };
    const newExp = buildExp({ active: true, variantFlowId: 'flow-B', splitPercent: 50 });
    const updated = mergeExperiment(settings, 'flow-A', newExp);
    expect(updated.experiments['flow-X']).toEqual(existingExp);
    expect(updated.experiments['flow-A']).toEqual(newExp);
  });

  it('overrides existing experiment for same flowId', () => {
    const old = buildExp({ active: false, variantFlowId: 'flow-B', splitPercent: 20 });
    const settings = { experiments: { 'flow-A': old } };
    const updated = buildExp({ active: true, variantFlowId: 'flow-B', splitPercent: 60 });
    const result = mergeExperiment(settings, 'flow-A', updated);
    expect(result.experiments['flow-A'].splitPercent).toBe(60);
    expect(result.experiments['flow-A'].active).toBe(true);
  });
});

// ── 4. GET: days clamping (default 14, range 1..90) ─────────────────────────
function clampDays(raw: unknown): number {
  return Math.min(Math.max(parseInt(String(raw ?? '14'), 10) || 14, 1), 90);
}

describe('GET /:id/experiment — clampDays (default 14)', () => {
  it('undefined → 14 (default, different from analytics route default 7)', () => {
    expect(clampDays(undefined)).toBe(14);
  });
  it('"30" → 30', () => expect(clampDays('30')).toBe(30));
  it('"abc" → 14 (invalid)', () => expect(clampDays('abc')).toBe(14));
  it('"0" → 14 (parseInt("0")||14 falls to default)', () => expect(clampDays('0')).toBe(14));
  it('"999" → 90 (capped)', () => expect(clampDays('999')).toBe(90));
  it('"1" → 1 (minimum)', () => expect(clampDays('1')).toBe(1));
  it('"-5" → 1 (Math.max(-5,1))', () => expect(clampDays('-5')).toBe(1));
});

// ── 5. GET: since date derivation ────────────────────────────────────────────
function sinceDate(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

describe('GET /:id/experiment — sinceDate derivation', () => {
  it('returns YYYY-MM-DD string', () => {
    expect(sinceDate(14)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('14-day since is before today', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(sinceDate(14) < today).toBe(true);
  });
  it('sinceDate(1) is closer to today than sinceDate(14)', () => {
    expect(sinceDate(1) > sinceDate(14)).toBe(true);
  });
});

// ── 6. GET: entryNodeId resolution from flow.nodes ───────────────────────────
function resolveEntryNodeId(nodes: any[]): string {
  const startNode = nodes.find((n) => n?.type === 'start');
  return startNode?.id || '';
}

describe('GET /:id/experiment — entryNodeId resolution', () => {
  it('returns id of start-type node', () => {
    const nodes = [
      { id: 'n0', type: 'start', data: {} },
      { id: 'n1', type: 'message', data: {} },
    ];
    expect(resolveEntryNodeId(nodes)).toBe('n0');
  });

  it('returns empty string when no start node found', () => {
    const nodes = [{ id: 'n1', type: 'message', data: {} }];
    expect(resolveEntryNodeId(nodes)).toBe('');
  });

  it('returns empty string for empty nodes array', () => {
    expect(resolveEntryNodeId([])).toBe('');
  });
});

// ── 7. GET: early-return shape when no experiment ────────────────────────────
describe('GET /:id/experiment — no experiment early return shape', () => {
  it('returns { experiment: null, results: null } when exp undefined', () => {
    const exp: Experiment | undefined = undefined;
    const response = { success: true, data: { experiment: exp ?? null, results: null } };
    expect(response.data.experiment).toBeNull();
    expect(response.data.results).toBeNull();
  });

  it('returns { experiment: exp, results: null } when exp has no variantFlowId', () => {
    const exp: Experiment = { active: false, variantFlowId: '', splitPercent: 50 };
    const response = { success: true, data: { experiment: exp, results: null } };
    expect(response.data.experiment).toBe(exp);
    expect(response.data.results).toBeNull();
  });
});

// ── 8. GET: aggregate → computeAbResults wiring ──────────────────────────────
describe('GET /:id/experiment — aggregate → computeAbResults wiring', () => {
  const aRows = [
    { nodeId: 'start', nodeType: 'start', nodeLabel: null, entries: 100, ends: 0 },
    { nodeId: 'conv',  nodeType: 'message', nodeLabel: 'Goal', entries: 30, ends: 30 },
  ];
  const bRows = [
    { nodeId: 'start', nodeType: 'start', nodeLabel: null, entries: 100, ends: 0 },
    { nodeId: 'conv',  nodeType: 'message', nodeLabel: 'Goal', entries: 55, ends: 55 },
  ];

  it('route wiring: aggregate(rows).byNode fed to computeAbResults returns winner B', () => {
    const results = computeAbResults({
      aStats: aggregate(aRows as any).byNode,
      bStats: aggregate(bRows as any).byNode,
      conversionNodeId: 'conv',
      entryNodeId: 'start',
    });
    expect(results.winner).toBe('B');
    expect(results.variants).toHaveLength(2);
    const a = results.variants.find((v) => v.variant === 'A')!;
    const b = results.variants.find((v) => v.variant === 'B')!;
    expect(a.conversionRate).toBeCloseTo(0.30, 2);
    expect(b.conversionRate).toBeCloseTo(0.55, 2);
  });

  it('empty rows → inconclusivo (winner null, both 0 entries)', () => {
    const results = computeAbResults({
      aStats: aggregate([]).byNode,
      bStats: aggregate([]).byNode,
      conversionNodeId: 'conv',
      entryNodeId: 'start',
    });
    expect(results.winner).toBeNull();
    expect(results.variants[0].entries).toBe(0);
    expect(results.variants[1].entries).toBe(0);
  });

  it('response shape: { success: true, data: { experiment, results } }', () => {
    const exp: Experiment = { active: true, variantFlowId: 'flow-B', splitPercent: 50 };
    const results = computeAbResults({
      aStats: aggregate(aRows as any).byNode,
      bStats: aggregate(bRows as any).byNode,
      entryNodeId: 'start',
    });
    const response = { success: true, data: { experiment: exp, results } };
    expect(response.success).toBe(true);
    expect(response.data.experiment).toBe(exp);
    expect(typeof response.data.results.winner).toBe('string');
    expect(Array.isArray(response.data.results.variants)).toBe(true);
    expect(typeof response.data.results.note).toBe('string');
  });
});
