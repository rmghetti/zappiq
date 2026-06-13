import { describe, it, expect } from 'vitest';
import { expandBlock } from './flowBlocks.js';

describe('expandBlock', () => {
  it('message: 1 nó message + exit next', () => {
    const f = expandBlock({ id: 'b1', type: 'message', text: 'Oi {{vars.x}}' });
    expect(f.nodes).toHaveLength(1);
    expect(f.nodes[0]).toMatchObject({ id: 'b1', type: 'message', data: { text: 'Oi {{vars.x}}' } });
    expect(f.entry).toBe('b1');
    expect(f.exits).toEqual([{ key: 'next', from: 'b1' }]);
  });

  it('ask: nó ask com varName saneado + exits ok/else', () => {
    const f = expandBlock({ id: 'b2', type: 'ask', question: 'Seu e-mail?', varName: 'e mail!', validationType: 'email', errorMessage: 'inválido', crmField: 'email' });
    expect(f.nodes[0]).toMatchObject({ id: 'b2', type: 'ask', data: { question: 'Seu e-mail?', varName: 'email', crmField: 'email', validation: { type: 'email', errorMessage: 'inválido' } } });
    expect(f.exits.map((e) => e.key).sort()).toEqual(['else', 'ok']);
  });

  it('ask_buttons: message interactive + condition; exits por opção (predicate keyword) + else', () => {
    const f = expandBlock({ id: 'b3', type: 'ask_buttons', question: 'O que procura?', options: [{ title: 'Planos' }, { title: 'Suporte' }] });
    const msg = f.nodes.find((n) => n.type === 'message');
    const cond = f.nodes.find((n) => n.type === 'condition');
    expect(msg.data.interactive.type).toBe('button');
    expect(msg.data.interactive.options.map((o: any) => o.title)).toEqual(['Planos', 'Suporte']);
    expect(msg.data.interactive.options.every((o: any) => !!o.id)).toBe(true);
    expect(f.entry).toBe(msg.id);
    expect(f.edges.some((e) => e.source === msg.id && e.target === cond.id)).toBe(true);
    const optExits = f.exits.filter((e) => e.key.startsWith('opt:'));
    expect(optExits).toHaveLength(2);
    expect(optExits[0].from).toBe(cond.id);
    expect(optExits[0].edgeData.predicates[0]).toMatchObject({ kind: 'keyword', match: 'equals', value: 'Planos' });
    expect(f.exits.some((e) => e.key === 'else')).toBe(true);
  });

  it('branch_var: condition com predicate var por caso + else', () => {
    const f = expandBlock({ id: 'b4', type: 'branch_var', varName: 'plano', cases: [{ op: 'eq', value: 'pro' }, { op: 'eq', value: 'free' }] });
    expect(f.nodes[0].type).toBe('condition');
    const caseExits = f.exits.filter((e) => e.key.startsWith('case:'));
    expect(caseExits[0].edgeData.predicates[0]).toMatchObject({ kind: 'var', name: 'plano', op: 'eq', value: 'pro' });
    expect(f.exits.some((e) => e.key === 'else')).toBe(true);
  });

  it('branch_hours: open (predicate) + closed (else)', () => {
    const f = expandBlock({ id: 'b5', type: 'branch_hours' });
    expect(f.nodes[0].type).toBe('condition');
    const open = f.exits.find((e) => e.key === 'open');
    const closed = f.exits.find((e) => e.key === 'closed');
    expect(open!.edgeData.predicates[0]).toMatchObject({ kind: 'business_hours', expect: 'open' });
    expect(closed!.edgeData.when).toMatchObject({ match: 'else' });
  });

  it('tag/ai/handoff', () => {
    expect(expandBlock({ id: 't', type: 'tag', tag: 'Lead Quente!' }).nodes[0].data.tag).toBe('lead-quente');
    expect(expandBlock({ id: 'a', type: 'ai', prompt: 'faça X' }).nodes[0]).toMatchObject({ type: 'ai', data: { prompt: 'faça X' } });
    const h = expandBlock({ id: 'h', type: 'handoff' });
    expect(h.nodes[0].type).toBe('transfer');
    expect(h.exits).toEqual([]);
  });

  it('ask_buttons: predicate usa o título TRUNCADO (≤20) igual ao botão', () => {
    const longTitle = 'Quero saber sobre os planos premium';
    const f = expandBlock({ id: 'b9', type: 'ask_buttons', question: 'Q?', options: [{ title: longTitle }] });
    const msg = f.nodes.find((n) => n.type === 'message');
    const shown = msg.data.interactive.options[0].title;
    expect(shown.length).toBeLessThanOrEqual(20);
    const optExit = f.exits.find((e) => e.key === 'opt:0');
    // predicate value deve ser EXATAMENTE o título mostrado no botão
    expect(optExit!.edgeData.predicates[0].value).toBe(shown);
  });

  it('ask_buttons: ids de opção são únicos mesmo com títulos que colidem no slug', () => {
    const f = expandBlock({ id: 'b10', type: 'ask_buttons', question: 'Q?', options: [{ title: 'Sim!' }, { title: 'Sim' }] });
    const msg = f.nodes.find((n) => n.type === 'message');
    const ids = msg.data.interactive.options.map((o: any) => o.id);
    expect(new Set(ids).size).toBe(ids.length); // todos distintos
  });
});
