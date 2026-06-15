/**
 * Test: computeReverifyVerdict (Task Q1 — Qualidade IA)
 *
 * Approach: pure-helper unit test (vitest, zero I/O).
 *
 * The route (adminAgentEval.ts apply-fix) uses executeAgentEvalRun internally.
 * The repo has no supertest harness (server.ts pulls Redis/OTel/BullMQ at
 * import time), so testing the full route is impractical. Instead we extract
 * the verdict computation into `computeReverifyVerdict` (pure, exported from
 * agentEvalRunner.ts) and test it in isolation.
 *
 * What is tested:
 *   1. after === 'pass'  → improved: true
 *   2. after === 'fail'  → improved: false
 *   3. after === 'partial' → improved: false (only full 'pass' counts)
 *   4. before is preserved as-is (pass-through)
 *   5. before: null (run sem dados prévios) is handled gracefully
 */
import { describe, it, expect } from 'vitest';
import { computeReverifyVerdict } from './agentEvalRunner.js';

describe('computeReverifyVerdict', () => {
  // ── 1. improved: true when after === 'pass' ──────────────────────────────
  it('after=pass → improved true', () => {
    const v = computeReverifyVerdict('fail', 'pass');
    expect(v.improved).toBe(true);
    expect(v.after).toBe('pass');
  });

  it('after=pass, before=partial → improved true', () => {
    const v = computeReverifyVerdict('partial', 'pass');
    expect(v.improved).toBe(true);
  });

  // ── 2. improved: false when after === 'fail' ─────────────────────────────
  it('after=fail → improved false', () => {
    const v = computeReverifyVerdict('fail', 'fail');
    expect(v.improved).toBe(false);
    expect(v.after).toBe('fail');
  });

  it('after=fail, before=pass → improved false (regression)', () => {
    const v = computeReverifyVerdict('pass', 'fail');
    expect(v.improved).toBe(false);
  });

  // ── 3. improved: false when after === 'partial' (partial does NOT count) ─
  it('after=partial → improved false', () => {
    const v = computeReverifyVerdict('fail', 'partial');
    expect(v.improved).toBe(false);
    expect(v.after).toBe('partial');
  });

  // ── 4. before is preserved verbatim ──────────────────────────────────────
  it('before value is passed through unchanged', () => {
    expect(computeReverifyVerdict('fail', 'pass').before).toBe('fail');
    expect(computeReverifyVerdict('partial', 'pass').before).toBe('partial');
    expect(computeReverifyVerdict('pass', 'pass').before).toBe('pass');
  });

  // ── 5. before: null (run antiga sem dados prévios) ───────────────────────
  it('before=null is handled gracefully', () => {
    const v = computeReverifyVerdict(null, 'pass');
    expect(v.before).toBeNull();
    expect(v.improved).toBe(true);
  });

  it('before=null, after=fail → improved false', () => {
    const v = computeReverifyVerdict(null, 'fail');
    expect(v.before).toBeNull();
    expect(v.improved).toBe(false);
  });
});
