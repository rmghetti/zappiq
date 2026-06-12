/* ══════════════════════════════════════════════════════════════════════
 * ZappIQ Maestro — Tests do motor puro (flowEngine, #280)
 *
 * Cobertura:
 *   ✓ start → message → ai  (trilho fixo manda texto e entrega pro LLM)
 *   ✓ condition consome a mensagem do turno e ramifica (match + else)
 *   ✓ retomada de cursor consome a PRÓXIMA mensagem no condition
 *   ✓ transfer encerra com efeito handoff
 *   ✓ tag/update_lead viram efeitos
 *   ✓ grafo cíclico não trava (MAX_WALK encerra)
 * ══════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import { resolveFlowStep, type FlowGraph, type FlowState } from './flowEngine.js';

const EMPTY_STATE: FlowState = { cursor: null, vars: {} };

describe('flowEngine.resolveFlowStep', () => {
  it('start → message → ai: manda texto fixo e entrega pro LLM com o prompt do nó', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'm', type: 'message', data: { text: 'Olá! Bem-vindo.' } },
        { id: 'a', type: 'ai', data: { prompt: 'Responda dúvidas sobre preço', model: 'sonnet' } },
        { id: 'end', type: 'message', data: { text: 'fim' } },
      ],
      edges: [
        { source: 's', target: 'm' },
        { source: 'm', target: 'a' },
        { source: 'a', target: 'end' },
      ],
    };
    const r = resolveFlowStep(graph, EMPTY_STATE, 'oi');
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'Olá! Bem-vindo.' }]);
    expect(r.next).toBe('ai');
    expect(r.aiPrompt).toBe('Responda dúvidas sobre preço');
    expect(r.aiModelHint).toBe('sonnet');
    // cursor avança pro nó após o ai (próximo turno retoma lá)
    expect(r.state.cursor).toBe('end');
  });

  it('condition: consome a mensagem do turno e ramifica no match', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'c', type: 'condition' },
        { id: 'sim', type: 'message', data: { text: 'Que bom!' } },
        { id: 'nao', type: 'message', data: { text: 'Tudo bem.' } },
      ],
      edges: [
        { source: 's', target: 'c' },
        { source: 'c', target: 'sim', data: { when: { match: 'contains', value: 'quero' } } },
        { source: 'c', target: 'nao', data: { when: { match: 'else' } } },
      ],
    };
    const sim = resolveFlowStep(graph, EMPTY_STATE, 'Sim, eu QUERO comprar');
    expect(sim.effects).toEqual([{ kind: 'send_text', text: 'Que bom!' }]);
    expect(sim.next).toBe('end');

    const nao = resolveFlowStep(graph, EMPTY_STATE, 'não, obrigado');
    expect(nao.effects).toEqual([{ kind: 'send_text', text: 'Tudo bem.' }]);
  });

  it('mid-walk condition aguarda PRÓXIMA mensagem (await_input) e retoma no cursor', () => {
    // start → msg → condition(c2). A primeira msg só dispara o welcome; o c2
    // espera a SEGUNDA mensagem.
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'm', type: 'message', data: { text: 'Você quer um orçamento?' } },
        { id: 'c2', type: 'condition' },
        { id: 'ok', type: 'message', data: { text: 'Gerando orçamento...' } },
      ],
      edges: [
        { source: 's', target: 'm' },
        { source: 'm', target: 'c2' },
        { source: 'c2', target: 'ok', data: { when: { match: 'contains', value: 'sim' } } },
      ],
    };
    // 1º turno: manda welcome e para no condition aguardando
    const t1 = resolveFlowStep(graph, EMPTY_STATE, 'oi');
    expect(t1.effects).toEqual([{ kind: 'send_text', text: 'Você quer um orçamento?' }]);
    expect(t1.next).toBe('await_input');
    expect(t1.state.cursor).toBe('c2');

    // 2º turno: retoma no c2 e consome "sim"
    const t2 = resolveFlowStep(graph, t1.state, 'sim, por favor');
    expect(t2.effects).toEqual([{ kind: 'send_text', text: 'Gerando orçamento...' }]);
    expect(t2.next).toBe('end');
  });

  it('transfer: emite handoff e encerra', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 't', type: 'transfer' },
      ],
      edges: [{ source: 's', target: 't' }],
    };
    const r = resolveFlowStep(graph, EMPTY_STATE, 'falar com humano');
    expect(r.effects).toEqual([{ kind: 'handoff' }]);
    expect(r.next).toBe('end');
    expect(r.state.cursor).toBeNull();
  });

  it('tag e update_lead viram efeitos antes do ai', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'tg', type: 'tag', data: { tag: 'lead-quente' } },
        { id: 'ul', type: 'update_lead', data: { field: 'origem', value: 'fluxo' } },
        { id: 'a', type: 'ai', data: { prompt: 'Continue o atendimento' } },
      ],
      edges: [
        { source: 's', target: 'tg' },
        { source: 'tg', target: 'ul' },
        { source: 'ul', target: 'a' },
      ],
    };
    const r = resolveFlowStep(graph, EMPTY_STATE, 'oi');
    expect(r.effects).toEqual([
      { kind: 'set_tag', tag: 'lead-quente' },
      { kind: 'update_lead', field: 'origem', value: 'fluxo' },
    ]);
    expect(r.next).toBe('ai');
  });

  it('grafo cíclico não trava (encerra defensivamente)', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'a', type: 'tag', data: { tag: 'x' } },
        { id: 'b', type: 'tag', data: { tag: 'y' } },
      ],
      edges: [
        { source: 's', target: 'a' },
        { source: 'a', target: 'b' },
        { source: 'b', target: 'a' }, // ciclo
      ],
    };
    const r = resolveFlowStep(graph, EMPTY_STATE, 'oi');
    expect(r.next).toBe('end'); // não entra em loop infinito
  });

  it('sem flow iniciado e sem start usa o primeiro nó', () => {
    const graph: FlowGraph = {
      nodes: [{ id: 'm', type: 'message', data: { text: 'único' } }],
      edges: [],
    };
    const r = resolveFlowStep(graph, EMPTY_STATE, 'oi');
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'único' }]);
    expect(r.next).toBe('end');
  });
});

describe('flowEngine goto_flow (Maestro v2)', () => {
  it('goto_flow emite efeito e encerra o walk neste fluxo', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'm', type: 'message', data: { text: 'Te levo pro time de vendas!' } },
        { id: 'g', type: 'goto_flow', data: { targetFlowId: 'flow-vendas' } },
      ],
      edges: [{ source: 's', target: 'm' }, { source: 'm', target: 'g' }],
    };
    const r = resolveFlowStep(graph, EMPTY_STATE, 'quero comprar');
    expect(r.effects).toEqual([
      { kind: 'send_text', text: 'Te levo pro time de vendas!' },
      { kind: 'goto_flow', targetFlowId: 'flow-vendas' },
    ]);
    expect(r.next).toBe('end');
    expect(r.state.cursor).toBeNull();
  });
  it('goto_flow sem targetFlowId segue a aresta de saída (fallback)', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'g', type: 'goto_flow', data: {} },
        { id: 'm', type: 'message', data: { text: 'seguindo aqui mesmo' } },
      ],
      edges: [{ source: 's', target: 'g' }, { source: 'g', target: 'm' }],
    };
    const r = resolveFlowStep(graph, EMPTY_STATE, 'oi');
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'seguindo aqui mesmo' }]);
  });
});
