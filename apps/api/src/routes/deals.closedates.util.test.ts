/**
 * W3.6 (dados) — datas de fechamento aplicadas na criação direta (POST) e no
 * move (PUT /:id/stage). Teste puro (vitest, zero I/O) do helper compartilhado
 * que garante que POST e PUT nunca divirjam na regra de wonAt/lostAt/closedAt.
 */
import { describe, it, expect } from 'vitest';
import { closingDatesForStage } from './deals.closedates.util.js';

describe('closingDatesForStage', () => {
  const now = new Date('2026-07-05T12:00:00.000Z');

  it("stage 'won' → closedAt + wonAt (sem lostAt)", () => {
    const r = closingDatesForStage('won', now);
    expect(r.closedAt).toBe(now);
    expect(r.wonAt).toBe(now);
    expect(r.lostAt).toBeUndefined();
  });

  it("stage 'lost' → closedAt + lostAt (sem wonAt)", () => {
    const r = closingDatesForStage('lost', now);
    expect(r.closedAt).toBe(now);
    expect(r.lostAt).toBe(now);
    expect(r.wonAt).toBeUndefined();
  });

  it('stage aberto não gera nenhuma data de fechamento', () => {
    for (const stage of ['new', 'contatado', 'qualified', 'proposal', 'negotiation']) {
      expect(closingDatesForStage(stage, now)).toEqual({});
    }
  });

  it('usa new Date() quando now não é injetado', () => {
    const before = Date.now();
    const r = closingDatesForStage('won');
    const after = Date.now();
    expect(r.wonAt).toBeInstanceOf(Date);
    expect(r.closedAt).toBe(r.wonAt);
    const t = (r.wonAt as Date).getTime();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });

  it('deal que NASCE em won/lost (POST) recebe as MESMAS datas do move (PUT)', () => {
    // regressão do bug: POST criava sem datas → deal sumia das métricas.
    expect(closingDatesForStage('won', now)).toEqual({ closedAt: now, wonAt: now });
    expect(closingDatesForStage('lost', now)).toEqual({ closedAt: now, lostAt: now });
  });
});
