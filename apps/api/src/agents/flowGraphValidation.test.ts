import { describe, it, expect } from 'vitest';
import { validateGraph } from './flowGraphValidation.js';

const N = (id: string, type: string, data: any = {}) => ({ id, type, data });
const E = (source: string, target: string, data?: any) => ({ id: `${source}_${target}`, source, target, data });

describe('validateGraph', () => {
  it('ask sem varName → erro; ask sem else → erro', () => {
    const r = validateGraph([N('q', 'ask', { question: 'x' })], [E('q', 'fim')]);
    expect(r.errors.some((e) => /vari/i.test(e))).toBe(true);
    expect(r.errors.some((e) => /else|padr/i.test(e))).toBe(true);
  });

  it('ask com varName e aresta else → ok', () => {
    const r = validateGraph(
      [N('q', 'ask', { question: 'x', varName: 'nome' }), N('ok', 'ai'), N('no', 'ai')],
      [E('q', 'ok'), E('q', 'no', { when: { match: 'else' } })],
    );
    expect(r.errors).toEqual([]);
  });

  it('interactive: 0 opções, título vazio, id duplicado, excesso → erros', () => {
    const dup = validateGraph([N('m', 'message', { interactive: { type: 'button', options: [{ id: 'a', title: 'X' }, { id: 'a', title: 'Y' }] } })], []);
    expect(dup.errors.some((e) => /duplicad/i.test(e))).toBe(true);
    const empty = validateGraph([N('m', 'message', { interactive: { type: 'button', options: [{ id: 'a', title: '' }] } })], []);
    expect(empty.errors.some((e) => /texto/i.test(e))).toBe(true);
    const over = validateGraph([N('m', 'message', { interactive: { type: 'button', options: [1,2,3,4].map((i) => ({ id: 'o' + i, title: 'T' + i })) } })], []);
    expect(over.errors.some((e) => /máximo|maximo/i.test(e))).toBe(true);
  });

  it('condition com saídas sem ramo padrão → warning', () => {
    const r = validateGraph(
      [N('c', 'condition'), N('a', 'ai'), N('b', 'ai')],
      [E('c', 'a', { predicates: [{ kind: 'keyword', match: 'equals', value: 'sim' }] }), E('c', 'b', { predicates: [{ kind: 'keyword', match: 'equals', value: 'nao' }] })],
    );
    expect(r.warnings.some((w) => /padr/i.test(w))).toBe(true);
  });

  it('grafo simples válido → sem erros nem warnings', () => {
    const r = validateGraph([N('s', 'start'), N('m', 'message', { text: 'oi' })], [E('s', 'm')]);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});
