/**
 * Feature 5a.3 — testes puros do shaping do detalhe do deal (buildDealDetail).
 */
import { describe, it, expect } from 'vitest';
import { buildDealDetail, type DealDetailActivity } from './deals.detail.util.js';

const act = (over: Partial<DealDetailActivity> = {}): DealDetailActivity => ({
  id: 'a1',
  type: 'STAGE_CHANGE',
  actor: 'HUMAN',
  title: 'Moveu para Proposta',
  body: null,
  conversationId: null,
  createdAt: new Date('2026-07-01T12:00:00.000Z'),
  ...over,
});

describe('buildDealDetail', () => {
  it('anexa as activities ao deal preservando os campos originais', () => {
    const deal = { id: 'd1', title: 'Plano Growth', value: 1497, stage: 'proposal', contact: { id: 'c1' } };
    const activities = [act(), act({ id: 'a2', type: 'NOTE' })];
    const out = buildDealDetail(deal, activities);
    expect(out.id).toBe('d1');
    expect(out.title).toBe('Plano Growth');
    expect(out.contact).toEqual({ id: 'c1' });
    expect(out.activities).toHaveLength(2);
    expect(out.activities[1].type).toBe('NOTE');
  });

  it('não muta o objeto deal recebido', () => {
    const deal = { id: 'd1', title: 'X' };
    const out = buildDealDetail(deal, [act()]);
    expect(out).not.toBe(deal);
    expect((deal as any).activities).toBeUndefined();
  });

  it('normaliza activities ausentes/não-array para lista vazia', () => {
    const deal = { id: 'd1' };
    expect(buildDealDetail(deal, undefined as any).activities).toEqual([]);
    expect(buildDealDetail(deal, null as any).activities).toEqual([]);
  });

  it('preserva a ordem recebida das activities (handler já ordena desc)', () => {
    const deal = { id: 'd1' };
    const activities = [
      act({ id: 'novo', createdAt: new Date('2026-07-05T00:00:00Z') }),
      act({ id: 'velho', createdAt: new Date('2026-07-01T00:00:00Z') }),
    ];
    const out = buildDealDetail(deal, activities);
    expect(out.activities.map((a) => a.id)).toEqual(['novo', 'velho']);
  });
});
