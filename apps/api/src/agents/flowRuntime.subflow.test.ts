/**
 * flowRuntime.subflow.test.ts — Teste de integração: ciclo call/return (Maestro 1C)
 * ============================================================================
 * Verifica dois cenários do bug corrigido em flowRuntime.ts:
 *
 * 1. call+return (returnNodeId não-null): subfluxo executa, retorna ao chamador,
 *    efeitos em ordem (sub → caller), conversa termina.
 * 2. returnNodeId===null (goto_flow é o último nó do caller): após o subfluxo
 *    encerrar, o caller não reinicia — conversa termina limpa, sem duplicação.
 *
 * Mocks:
 *   - @zappiq/database → prisma.flow.findMany retorna CALLER + SUB
 *   - ../services/cloud/index.js → cache in-memory (Map)
 *   - ../services/flowScheduler.js → no-op
 *   - ./evalContextBuilder.js → EvalContext mínimo
 *   - ../services/flowAnalytics.js → no-op
 *   - ../utils/logger.js → logger silencioso
 *
 * flowEngine.js, flowHop.js e flowRouter.js rodam SEM mock (integração real).
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (vi.mock é hoistado automaticamente pelo Vitest) ────────────────────

const cacheStore = new Map<string, string>();

vi.mock('@zappiq/database', () => ({
  prisma: {
    flow: {
      findMany: vi.fn(),
    },
    contact: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('../services/cloud/index.js', () => ({
  cache: {
    get: async (key: string) => cacheStore.get(key) ?? null,
    set: async (key: string, value: string) => { cacheStore.set(key, value); return true; },
    del: async (key: string) => { cacheStore.delete(key); return true; },
    mget: async (keys: string[]) => keys.map((k) => cacheStore.get(k) ?? null),
    incrby: async () => null,
    incrbyfloat: async () => null,
    expire: async () => true,
    ping: async () => true,
    setNX: async () => null,
  },
}));

vi.mock('../services/flowScheduler.js', () => ({
  scheduleFlowTimer: async () => {},
  cancelPendingWaitTimers: async () => {},
}));

vi.mock('./evalContextBuilder.js', () => ({
  buildEvalContext: async () => ({
    contact: { name: null, tags: [], leadStatus: null, leadScore: 0, funnelStage: null, customFields: {} },
    now: null,
    businessHours: null,
  }),
}));

vi.mock('../services/flowAnalytics.js', () => ({
  recordNodeStats: async () => {},
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
}));

// ── Importação pós-mock ───────────────────────────────────────────────────────
import { resolveActiveFlowStep } from './flowRuntime.js';
import { prisma } from '@zappiq/database';

// ── Definição dos fluxos de teste ─────────────────────────────────────────────

/** SUB: start → message('no sub') — sem nó após o message, fluxo encerra. */
const SUB = {
  id: 'SUB',
  isActive: true,
  version: 1,
  priority: 0,
  updatedAt: new Date(0),
  triggerType: 'MANUAL',
  triggerConfig: {},
  nodes: [
    { id: 's2', type: 'start' },
    { id: 'm2', type: 'message', data: { text: 'no sub' } },
  ],
  edges: [{ source: 's2', target: 'm2' }],
};

/**
 * CALLER: start → goto_flow(call→SUB) → message('voltei')
 * O nó 'g' tem edge para 'fim', então returnNodeId='fim'.
 */
const CALLER = {
  id: 'CALLER',
  isActive: true,
  version: 1,
  priority: 0,
  updatedAt: new Date(0),
  triggerType: 'FIRST_CONTACT',
  triggerConfig: {},
  nodes: [
    { id: 's', type: 'start' },
    { id: 'g', type: 'goto_flow', data: { targetFlowId: 'SUB', mode: 'call' } },
    { id: 'fim', type: 'message', data: { text: 'voltei' } },
  ],
  edges: [
    { source: 's', target: 'g' },
    { source: 'g', target: 'fim' },
  ],
};

/**
 * CALLER2: start → goto_flow(call→SUB) — sem aresta após 'g'.
 * returnNodeId será null (goto_flow é último nó do caller).
 * Bug: antes do fix, causaria restart do CALLER2 e mensagem duplicada.
 */
const CALLER2 = {
  id: 'CALLER2',
  isActive: true,
  version: 1,
  priority: 0,
  updatedAt: new Date(0),
  triggerType: 'FIRST_CONTACT',
  triggerConfig: {},
  nodes: [
    { id: 's3', type: 'start' },
    { id: 'g2', type: 'goto_flow', data: { targetFlowId: 'SUB', mode: 'call' } },
  ],
  edges: [{ source: 's3', target: 'g2' }],
  // sem aresta de 'g2' → firstTargetFrom(graph, 'g2') = null = returnNodeId
};

// ── Input base ────────────────────────────────────────────────────────────────
const BASE_INPUT = {
  organizationId: 'o',
  conversationId: 'c',
  messageContent: 'oi',
  orgSettings: { maestro: { enabled: true } },
  contactId: null,
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('flowRuntime — subfluxo call/return (1C)', () => {
  beforeEach(() => {
    cacheStore.clear();
    vi.clearAllMocks();
  });

  it('Test 1 — call+return: efeitos em ordem (no sub → voltei) e conversa encerra', async () => {
    (prisma.flow.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([CALLER, SUB]);

    const result = await resolveActiveFlowStep({ ...BASE_INPUT, conversationId: 'c1' });

    expect(result).not.toBeNull();

    const texts = result!.effects
      .filter((e) => e.kind === 'send_text')
      .map((e) => (e as { kind: 'send_text'; text: string }).text);

    // Deve haver exatamente 'no sub' seguido de 'voltei'
    expect(texts).toEqual(['no sub', 'voltei']);

    // Conversa deve estar marcada como ENDED no cache
    const stateRaw = cacheStore.get('flow_state:o:c1');
    expect(stateRaw).toBeDefined();
    const state = JSON.parse(stateRaw!);
    expect(state.cursor).toBe('__ended__');
  });

  it('Test 2 — returnNodeId null: subfluxo executa UMA vez e conversa encerra (sem restart/duplicação)', async () => {
    (prisma.flow.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([CALLER2, SUB]);

    const result = await resolveActiveFlowStep({ ...BASE_INPUT, conversationId: 'c2' });

    expect(result).not.toBeNull();

    const texts = result!.effects
      .filter((e) => e.kind === 'send_text')
      .map((e) => (e as { kind: 'send_text'; text: string }).text);

    // Deve conter 'no sub' exatamente UMA vez (sem duplicação pelo bug)
    expect(texts.filter((t) => t === 'no sub')).toHaveLength(1);

    // NÃO deve ter 'voltei' (CALLER2 não tem nó após o goto_flow)
    expect(texts).not.toContain('voltei');

    // Conversa deve estar marcada como ENDED (não await_input nem mid-flow)
    const stateRaw = cacheStore.get('flow_state:o:c2');
    expect(stateRaw).toBeDefined();
    const state = JSON.parse(stateRaw!);
    expect(state.cursor).toBe('__ended__');
  });
});
