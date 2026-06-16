import { describe, it, expect } from 'vitest';
import { scoreConversation, runOnePersona, type Persona } from './flowSimulation.js';
import { DEFAULT_CTX, type FlowGraph } from './flowEngine.js';

const persona: Persona = { id: 'p1', name: 'Ana', tone: 'direta', intent: 'comprar', painPoint: 'preço' };

describe('scoreConversation', () => {
  it('encerrou e sem juízo falho → passou', () => {
    const v = scoreConversation([{ from: 'bot', text: 'oi', judged: { passed: true } } as any], true, persona);
    expect(v.passed).toBe(true);
  });
  it('não encerrou → falhou', () => {
    const v = scoreConversation([{ from: 'bot', text: 'oi' } as any], false, persona);
    expect(v.passed).toBe(false);
    expect(v.reason).toMatch(/encerr|complet/i);
  });
  it('juízo de turno falho → falhou', () => {
    const v = scoreConversation([{ from: 'bot', text: 'x', judged: { passed: false, reason: 'ruim' } } as any], true, persona);
    expect(v.passed).toBe(false);
  });
});

describe('runOnePersona', () => {
  it('conversa simples start→message→end: registra turnos e encerra', async () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'm', type: 'message', data: { text: 'Bem-vindo!' } },
      ],
      edges: [{ source: 's', target: 'm' }],
    };
    let custCalls = 0;
    const r = await runOnePersona(graph, persona, {
      customerSays: async () => { custCalls++; return 'oi'; },
      botReplies: async () => 'resposta da IA',
      judge: async () => ({ passed: true, confidence: 1, reason: 'ok' }),
      buildCtx: () => DEFAULT_CTX,
      maxTurns: 5,
    });
    // o fluxo manda 'Bem-vindo!' e encerra (sem nó-IA), então ended true
    expect(r.ended).toBe(true);
    expect(r.turns.some((t) => t.from === 'bot' && /Bem-vindo/.test(t.text))).toBe(true);
    expect(r.verdict.passed).toBe(true);
    expect(custCalls).toBeGreaterThanOrEqual(1);
  });

  it('nó-IA: usa botReplies e judge no ponto de IA', async () => {
    const graph: FlowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'a', type: 'ai', data: { prompt: 'Ajude com preço' } },
      ],
      edges: [{ source: 's', target: 'a' }],
    };
    let judged = 0, botCalls = 0;
    const r = await runOnePersona(graph, persona, {
      customerSays: async () => 'quanto custa?',
      botReplies: async () => { botCalls++; return 'Custa R$ X'; },
      judge: async () => { judged++; return { passed: true, confidence: 0.9, reason: 'ok' }; },
      buildCtx: () => DEFAULT_CTX,
      maxTurns: 2, // o nó-IA não encerra; maxTurns corta
    });
    expect(botCalls).toBeGreaterThanOrEqual(1);
    expect(judged).toBeGreaterThanOrEqual(1);
    expect(r.turns.some((t) => t.from === 'bot' && /Custa R\$ X/.test(t.text))).toBe(true);
  });
});
