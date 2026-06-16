import { describe, it, expect } from 'vitest';
import { assemble } from './flowAssembler.js';

describe('assemble', () => {
  it('plano linear válido → grafo com start + nós + arestas', () => {
    const r = assemble({
      flowName: 'F', entry: 'b1',
      blocks: [
        { id: 'b1', type: 'message', text: 'Oi', next: 'b2' },
        { id: 'b2', type: 'ai', prompt: 'ajude' },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const start = r.graph.nodes.find((n) => n.type === 'start');
    expect(start).toBeTruthy();
    expect(r.graph.edges.some((e) => e.source === start.id)).toBe(true);
    expect(r.graph.nodes.some((n) => n.type === 'message')).toBe(true);
    expect(r.graph.nodes.some((n) => n.type === 'ai')).toBe(true);
  });

  it('ask_buttons: cada opção vira aresta de predicate keyword para o alvo certo', () => {
    const r = assemble({
      flowName: 'Q', entry: 'b1',
      blocks: [
        { id: 'b1', type: 'ask_buttons', question: 'O que?', options: [{ title: 'Planos', next: 'b2' }, { title: 'Suporte', next: 'b3' }], elseNext: 'b3' },
        { id: 'b2', type: 'ai', prompt: 'planos' },
        { id: 'b3', type: 'ai', prompt: 'suporte' },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cond = r.graph.nodes.find((n) => n.type === 'condition');
    const out = r.graph.edges.filter((e) => e.source === cond.id);
    expect(out.some((e) => e.data?.predicates?.[0]?.value === 'Planos')).toBe(true);
    expect(out.some((e) => e.data?.when?.match === 'else')).toBe(true);
  });

  it('else-completion: ask sem elseNext recebe um destino seguro (não fica órfão)', () => {
    const r = assemble({
      flowName: 'A', entry: 'b1',
      blocks: [
        { id: 'b1', type: 'ask', question: 'email?', varName: 'email', validationType: 'email', next: 'b2' },
        { id: 'b2', type: 'ai', prompt: 'segue' },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const elseEdge = r.graph.edges.find((e) => e.source === 'b1' && e.data?.when?.match === 'else');
    expect(elseEdge).toBeTruthy();
    expect(elseEdge!.target).toBeTruthy();
  });

  it('plano inválido: next órfão → ok:false', () => {
    const r = assemble({ flowName: 'X', entry: 'b1', blocks: [{ id: 'b1', type: 'message', text: 'oi', next: 'naoexiste' }] });
    expect(r.ok).toBe(false);
  });

  it('plano inválido: type desconhecido → ok:false', () => {
    const r = assemble({ flowName: 'X', entry: 'b1', blocks: [{ id: 'b1', type: 'foobar' }] });
    expect(r.ok).toBe(false);
  });

  it('plano inválido: entry inexistente → ok:false', () => {
    const r = assemble({ flowName: 'X', entry: 'zzz', blocks: [{ id: 'b1', type: 'message', text: 'oi' }] });
    expect(r.ok).toBe(false);
  });

  it('grafo montado passa na validateGraph (ramo com else, ids únicos)', () => {
    const r = assemble({
      flowName: 'Q', entry: 'b1',
      blocks: [
        { id: 'b1', type: 'ask_buttons', question: 'O que?', options: [{ title: 'A', next: 'b2' }, { title: 'B', next: 'b2' }] },
        { id: 'b2', type: 'ai', prompt: 'x' },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('else-completion sem nenhum nó ai: cria ai_fallback e liga o else nele', () => {
    const r = assemble({
      flowName: 'NF', entry: 'b1',
      blocks: [
        { id: 'b1', type: 'ask_buttons', question: 'Q?', options: [{ title: 'A', next: 'b2' }] },
        { id: 'b2', type: 'tag', tag: 'x' }, // sem nó ai no plano
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const fallback = r.graph.nodes.find((n) => n.type === 'ai');
    expect(fallback).toBeTruthy(); // ai_fallback criado
    const cond = r.graph.nodes.find((n) => n.type === 'condition');
    const elseEdge = r.graph.edges.find((e) => e.source === cond.id && e.data?.when?.match === 'else');
    expect(elseEdge!.target).toBe(fallback.id);
  });

  it('branch_hours: open vai ao destino, closed (else) é completado', () => {
    const r = assemble({
      flowName: 'H', entry: 'b1',
      blocks: [
        { id: 'b1', type: 'branch_hours', openNext: 'b2', closedNext: 'b3' },
        { id: 'b2', type: 'ai', prompt: 'aberto' },
        { id: 'b3', type: 'ai', prompt: 'fechado' },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cond = r.graph.nodes.find((n) => n.type === 'condition');
    const out = r.graph.edges.filter((e) => e.source === cond.id);
    expect(out.some((e) => e.data?.predicates?.[0]?.kind === 'business_hours')).toBe(true);
    expect(out.some((e) => e.data?.when?.match === 'else')).toBe(true);
  });

  it('handoff encerra (transfer sem saída)', () => {
    const r = assemble({
      flowName: 'HO', entry: 'b1',
      blocks: [
        { id: 'b1', type: 'message', text: 'tchau', next: 'b2' },
        { id: 'b2', type: 'handoff' },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const transfer = r.graph.nodes.find((n) => n.type === 'transfer');
    expect(transfer).toBeTruthy();
    expect(r.graph.edges.some((e) => e.source === transfer.id)).toBe(false); // sem saída
  });
});
