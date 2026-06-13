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
import { resolveFlowStep, DEFAULT_CTX, type FlowGraph, type FlowState } from './flowEngine.js';

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

describe('flowEngine wait/schedule (Maestro v2, Fase 3)', () => {
  it('wait para o walk e devolve schedule com ramo de timeout e cursor de resposta', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'm', type: 'message', data: { text: 'Posso te ajudar em algo mais?' } },
        { id: 'w', type: 'wait', data: { delayMinutes: 60 } },
        { id: 'reply', type: 'condition' },
        { id: 'nudge', type: 'message', data: { text: 'Ainda está aí? 😊' } },
      ],
      edges: [
        { source: 's', target: 'm' },
        { source: 'm', target: 'w' },
        { source: 'w', target: 'reply' },
        { source: 'w', target: 'nudge', data: { when: { match: 'timeout' } } as any },
      ],
    };
    const r = resolveFlowStep(graph, EMPTY_STATE, 'oi');
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'Posso te ajudar em algo mais?' }]);
    expect(r.next).toBe('scheduled');
    expect(r.schedule).toEqual({ kind: 'wait', delayMinutes: 60, runAt: null, resumeNodeId: 'nudge' });
    expect(r.state.cursor).toBe('reply');
  });
  it('wait com uma única aresta usa-a como timeout e cursor null (reply cancela e Iza assume)', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'w', type: 'wait', data: { delayMinutes: 30 } },
        { id: 'n', type: 'message', data: { text: 'follow-up' } },
      ],
      edges: [{ source: 's', target: 'w' }, { source: 'w', target: 'n' }],
    };
    const r = resolveFlowStep(graph, EMPTY_STATE, 'oi');
    expect(r.next).toBe('scheduled');
    expect(r.schedule?.resumeNodeId).toBe('n');
    expect(r.state.cursor).toBeNull();
  });
  it('schedule usa runAt do nó e segue aresta única', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'sc', type: 'schedule', data: { runAt: '2026-06-12T13:00:00.000Z' } },
        { id: 'm', type: 'message', data: { text: 'lembrete!' } },
      ],
      edges: [{ source: 's', target: 'sc' }, { source: 'sc', target: 'm' }],
    };
    const r = resolveFlowStep(graph, EMPTY_STATE, 'oi');
    expect(r.next).toBe('scheduled');
    expect(r.schedule).toEqual({ kind: 'schedule', delayMinutes: null, runAt: '2026-06-12T13:00:00.000Z', resumeNodeId: 'm' });
  });
  it('wait sem config de tempo passa direto (compat com fluxos antigos)', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'w', type: 'wait' },
        { id: 'm', type: 'message', data: { text: 'direto' } },
      ],
      edges: [{ source: 's', target: 'w' }, { source: 'w', target: 'm' }],
    };
    const r = resolveFlowStep(graph, EMPTY_STATE, 'oi');
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'direto' }]);
    expect(r.next).toBe('end');
  });
  it('retomada por timer: hasIncomingMessage=false faz condition aguardar em vez de ramificar com texto vazio', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'm', type: 'message', data: { text: 'voltei!' } },
        { id: 'c', type: 'condition' },
      ],
      edges: [
        { source: 's', target: 'm' }, { source: 'm', target: 'c' },
        { source: 'c', target: 'm', data: { when: { match: 'contains', value: '' } } as any },
      ],
    };
    const r = resolveFlowStep(graph, { cursor: 'm', vars: {} }, '', { hasIncomingMessage: false });
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'voltei!' }]);
    expect(r.next).toBe('await_input');
    expect(r.state.cursor).toBe('c');
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

  it('condition ramifica por atributo do contato (predicates em E)', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'c', type: 'condition' },
        { id: 'vip', type: 'message', data: { text: 'Atendimento VIP' } },
        { id: 'comum', type: 'message', data: { text: 'Atendimento padrão' } },
      ],
      edges: [
        { source: 's', target: 'c' },
        { source: 'c', target: 'vip', data: { predicates: [{ kind: 'contact_attr', field: 'tags', op: 'contains', value: 'vip' }] } },
        { source: 'c', target: 'comum', data: { when: { match: 'else' } } },
      ],
    };
    const ctx = {
      contact: { name: null, tags: ['vip'], leadStatus: null, leadScore: 0, funnelStage: null, customFields: {} },
      now: null, businessHours: null,
    };
    const r = resolveFlowStep(graph, { cursor: 'c', vars: {} }, 'qualquer', { ctx });
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'Atendimento VIP' }]);
  });

  it('message interpola {{vars}} e {{contact.name}}', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'm', type: 'message', data: { text: 'Oi {{contact.name}}, plano {{vars.plano}}' } },
      ],
      edges: [{ source: 's', target: 'm' }],
    };
    const ctx = {
      contact: { name: 'Ana', tags: [], leadStatus: null, leadScore: 0, funnelStage: null, customFields: {} },
      now: null, businessHours: null,
    };
    const r = resolveFlowStep(graph, { cursor: null, vars: { plano: 'pro' } }, 'oi', { ctx });
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'Oi Ana, plano pro' }]);
  });

  it('condition: aresta com predicates vazio não vence o else explícito', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'c', type: 'condition' },
        { id: 'bare', type: 'message', data: { text: 'ramo vazio' } },
        { id: 'real', type: 'message', data: { text: 'ramo VIP' } },
        { id: 'fim', type: 'message', data: { text: 'else' } },
      ],
      edges: [
        // aresta de predicates vazio aparece ANTES da real e do else
        { source: 'c', target: 'bare', data: { predicates: [] } },
        { source: 'c', target: 'real', data: { predicates: [{ kind: 'contact_attr', field: 'tags', op: 'contains', value: 'vip' }] } },
        { source: 'c', target: 'fim', data: { when: { match: 'else' } } },
      ],
    };
    const ctx = {
      contact: { name: null, tags: ['vip'], leadStatus: null, leadScore: 0, funnelStage: null, customFields: {} },
      now: null, businessHours: null,
    };
    // contato é VIP → deve seguir a aresta 'real', não a de predicates vazio
    const r = resolveFlowStep(graph, { cursor: 'c', vars: {} }, 'x', { ctx });
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'ramo VIP' }]);
  });

  it('ask: primeira passada pergunta (interpolada) e aguarda input', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'q', type: 'ask', data: { question: 'Qual seu nome, {{vars.saud}}?', varName: 'nome' } },
        { id: 'fim', type: 'message', data: { text: 'Obrigado {{vars.nome}}' } },
      ],
      edges: [{ source: 's', target: 'q' }, { source: 'q', target: 'fim' }],
    };
    const r = resolveFlowStep(graph, { cursor: null, vars: { saud: 'cliente' } }, '', { ctx: DEFAULT_CTX, hasIncomingMessage: false });
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'Qual seu nome, cliente?' }]);
    expect(r.next).toBe('await_input');
    expect(r.state.cursor).toBe('q');
  });

  it('ask: resposta válida grava var, emite update_lead (crmField) e avança', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'q', type: 'ask', data: { question: 'Seu nome?', varName: 'nome', crmField: 'name' } },
        { id: 'fim', type: 'message', data: { text: 'Oi {{vars.nome}}' } },
      ],
      edges: [{ source: 's', target: 'q' }, { source: 'q', target: 'fim' }],
    };
    const r = resolveFlowStep(graph, { cursor: 'q', vars: {} }, 'Ana', { ctx: DEFAULT_CTX });
    expect(r.state.vars.nome).toBe('Ana');
    expect(r.effects).toEqual([
      { kind: 'update_lead', field: 'name', value: 'Ana' },
      { kind: 'send_text', text: 'Oi Ana' },
    ]);
    expect(r.next).toBe('end');
  });

  it('ask: resposta inválida re-pergunta e decrementa retries', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'q', type: 'ask', data: { question: 'Seu email?', varName: 'email',
          validation: { type: 'email', errorMessage: 'Email inválido, tente de novo', maxRetries: 2 } } },
        { id: 'fim', type: 'message', data: { text: 'ok' } },
      ],
      edges: [{ source: 'q', target: 'fim' }],
    };
    const r = resolveFlowStep(graph, { cursor: 'q', vars: {} }, 'não é email', { ctx: DEFAULT_CTX });
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'Email inválido, tente de novo' }]);
    expect(r.next).toBe('await_input');
    expect(r.state.cursor).toBe('q');
    expect(r.state.vars._askRetries).toBe(1);
  });

  it('ask: retries esgotados caem no ramo else', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'q', type: 'ask', data: { question: 'Email?', varName: 'email',
          validation: { type: 'email', errorMessage: 'inválido', maxRetries: 1 } } },
        { id: 'ok', type: 'message', data: { text: 'capturado' } },
        { id: 'desiste', type: 'message', data: { text: 'tudo bem, sem email' } },
      ],
      edges: [
        { source: 'q', target: 'ok' },
        { source: 'q', target: 'desiste', data: { when: { match: 'else' } } },
      ],
    };
    const r = resolveFlowStep(graph, { cursor: 'q', vars: { _askRetries: 0 } }, 'xxx', { ctx: DEFAULT_CTX });
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'tudo bem, sem email' }]);
    expect(r.state.vars._askRetries).toBeUndefined();
  });

  it('ask: exaustão sem else explícito encerra o fluxo (não segue caminho feliz com var vazia)', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'q', type: 'ask', data: { question: 'Email?', varName: 'email',
          validation: { type: 'email', errorMessage: 'inválido', maxRetries: 1 } } },
        { id: 'fim', type: 'message', data: { text: 'Obrigado {{vars.email}}' } },
      ],
      edges: [
        // só a aresta do caminho feliz (bare), SEM else
        { source: 'q', target: 'fim' },
      ],
    };
    const r = resolveFlowStep(graph, { cursor: 'q', vars: { _askRetries: 0 } }, 'xxx', { ctx: DEFAULT_CTX });
    expect(r.next).toBe('end');
    expect(r.effects).toEqual([]); // não envia o "Obrigado" do caminho feliz
    expect(r.state.vars.email).toBeUndefined();
    expect(r.state.vars._askRetries).toBeUndefined();
  });

  it('ask: retomada por timer (sem mensagem) re-emite a pergunta e aguarda', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'q', type: 'ask', data: { question: 'Seu nome?', varName: 'nome' } },
        { id: 'fim', type: 'message', data: { text: 'ok' } },
      ],
      edges: [{ source: 'q', target: 'fim' }],
    };
    const r = resolveFlowStep(graph, { cursor: 'q', vars: {} }, '', { ctx: DEFAULT_CTX, hasIncomingMessage: false });
    expect(r.effects).toEqual([{ kind: 'send_text', text: 'Seu nome?' }]);
    expect(r.next).toBe('await_input');
    expect(r.state.cursor).toBe('q');
  });

  it('message com botões emite send_interactive (titles interpolados)', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'm', type: 'message', data: {
          text: 'Escolha {{vars.nome}}:',
          interactive: { type: 'button', options: [{ id: 'planos', title: 'Planos' }, { id: 'sup', title: 'Suporte' }] },
        } },
      ],
      edges: [],
    };
    const r = resolveFlowStep(graph, { cursor: null, vars: { nome: 'Ana' } }, 'oi', { ctx: DEFAULT_CTX });
    expect(r.effects).toEqual([{
      kind: 'send_interactive', type: 'button', body: 'Escolha Ana:',
      options: [{ id: 'planos', title: 'Planos' }, { id: 'sup', title: 'Suporte' }],
    }]);
  });

  it('message com mídia emite send_media com caption interpolada', () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 'm', type: 'message', data: {
          media: { type: 'image', url: 'https://x/y.png', caption: 'Catálogo {{vars.nome}}' },
        } },
      ],
      edges: [],
    };
    const r = resolveFlowStep(graph, { cursor: null, vars: { nome: 'Ana' } }, 'oi', { ctx: DEFAULT_CTX });
    expect(r.effects).toEqual([{ kind: 'send_media', mediaType: 'image', url: 'https://x/y.png', caption: 'Catálogo Ana' }]);
  });
});
