import { describe, it, expect } from 'vitest';
import { evalPredicate, evalEdge } from './flowPredicates.js';
import type { EvalContext, FlowEdge } from './flowEngine.js';

const baseCtx: EvalContext = {
  contact: { name: 'Ana', tags: ['vip', 'lead'], leadStatus: 'QUALIFIED', leadScore: 80, funnelStage: 'Planos', customFields: { cidade: 'SP' } },
  now: new Date('2026-06-16T17:00:00Z'),
  businessHours: { timezone: 'America/Sao_Paulo', days: { 1: { open: '09:00', close: '18:00' }, 2: { open: '09:00', close: '18:00' } } as any },
  system: {},
};
const vars = { plano: 'pro', score: 5 };

describe('evalPredicate', () => {
  it('keyword casa contra o texto', () => {
    expect(evalPredicate({ kind: 'keyword', match: 'contains', value: 'quero' }, baseCtx, vars, 'eu QUERO')).toBe(true);
    expect(evalPredicate({ kind: 'keyword', match: 'equals', value: 'sim' }, baseCtx, vars, 'não')).toBe(false);
  });

  it('contact_attr: tags contains, score gt, exists', () => {
    expect(evalPredicate({ kind: 'contact_attr', field: 'tags', op: 'contains', value: 'vip' }, baseCtx, vars, '')).toBe(true);
    expect(evalPredicate({ kind: 'contact_attr', field: 'leadScore', op: 'gt', value: 50 }, baseCtx, vars, '')).toBe(true);
    expect(evalPredicate({ kind: 'contact_attr', field: 'customFields.cidade', op: 'eq', value: 'SP' }, baseCtx, vars, '')).toBe(true);
    expect(evalPredicate({ kind: 'contact_attr', field: 'customFields.idade', op: 'exists' }, baseCtx, vars, '')).toBe(false);
  });

  it('var: eq, gt, exists', () => {
    expect(evalPredicate({ kind: 'var', name: 'plano', op: 'eq', value: 'pro' }, baseCtx, vars, '')).toBe(true);
    expect(evalPredicate({ kind: 'var', name: 'score', op: 'gte', value: 5 }, baseCtx, vars, '')).toBe(true);
    expect(evalPredicate({ kind: 'var', name: 'inexistente', op: 'not_exists' }, baseCtx, vars, '')).toBe(true);
  });

  it('business_hours respeita expect', () => {
    expect(evalPredicate({ kind: 'business_hours', expect: 'open' }, baseCtx, vars, '')).toBe(true);
    expect(evalPredicate({ kind: 'business_hours', expect: 'closed' }, baseCtx, vars, '')).toBe(false);
  });

  it('campo inexistente nunca lança; op incompatível → false', () => {
    expect(evalPredicate({ kind: 'contact_attr', field: 'naoexiste', op: 'gt', value: 1 }, baseCtx, vars, '')).toBe(false);
  });
});

describe('evalEdge (predicados em E)', () => {
  const ctx = baseCtx;
  it('todos verdadeiros → true', () => {
    const edge: FlowEdge = { source: 'c', target: 'a', data: { predicates: [
      { kind: 'contact_attr', field: 'tags', op: 'contains', value: 'vip' },
      { kind: 'business_hours', expect: 'open' },
    ] } };
    expect(evalEdge(edge, ctx, vars, '')).toBe(true);
  });

  it('um falso → false', () => {
    const edge: FlowEdge = { source: 'c', target: 'a', data: { predicates: [
      { kind: 'contact_attr', field: 'tags', op: 'contains', value: 'vip' },
      { kind: 'business_hours', expect: 'closed' },
    ] } };
    expect(evalEdge(edge, ctx, vars, '')).toBe(false);
  });

  it('sem predicates e sem when legado → else (true)', () => {
    expect(evalEdge({ source: 'c', target: 'a' }, ctx, vars, '')).toBe(true);
  });

  it('compat: aresta legada com when keyword ainda casa', () => {
    const edge: FlowEdge = { source: 'c', target: 'a', data: { when: { match: 'contains', value: 'oi' } } };
    expect(evalEdge(edge, ctx, vars, 'oi tudo bem')).toBe(true);
    expect(evalEdge(edge, ctx, vars, 'tchau')).toBe(false);
  });
});
