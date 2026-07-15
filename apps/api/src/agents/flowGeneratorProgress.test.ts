/* ══════════════════════════════════════════════════════════════════════
 * Maestro · progresso emitido pelo pipeline de geração (integração)
 *
 * maestroProgress.test.ts prova a matemática da régua isolada. Aqui roda o
 * generateSmartFlows/generateJourney DE VERDADE (só o Postgres, o LLM e o
 * Socket.io são dublês) e checa o que o cliente realmente receberia: a ordem
 * dos marcos, a monotonicidade e o isolamento por org.
 *
 * O conteúdo dos drafts não importa nestes testes: o LLM dublê devolve um JSON
 * que não vira block plan, então a geração cai no fallback determinístico do
 * blueprint de propósito. Os marcos são emitidos no loop de fora, então o
 * caminho do conteúdo não muda nada aqui — e o formato do block plan já tem
 * testes próprios.
 *
 * Cobertura:
 *   ✓ 1 objetivo: context → draft → done, percentuais só crescendo
 *   ✓ multi-agente: um marco por objetivo, com step/totalSteps certos
 *   ✓ Sem runId (cliente antigo): não emite NADA, mas ainda gera os fluxos
 *   ✓ Todo evento vai pra sala da própria org e carrega o runId do cliente
 *   ✓ Socket.io fora do ar não derruba a geração
 *   ✓ Jornada: drafts → handoffs → fiação, na ordem, sem passar de 100
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetIo, mockEmit, mockTo, mockComplete, mockOrgFindUnique } = vi.hoisted(() => {
  const mockEmit = vi.fn();
  const mockTo = vi.fn(() => ({ emit: mockEmit }));
  return {
    mockGetIo: vi.fn(),
    mockEmit,
    mockTo,
    mockComplete: vi.fn(),
    mockOrgFindUnique: vi.fn(),
  };
});

vi.mock('../utils/socketRegistry.js', () => ({ getIo: mockGetIo }));

vi.mock('../services/llm/LLMRouter.js', () => ({
  llmRouter: { complete: mockComplete },
}));

vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: { findUnique: mockOrgFindUnique },
    kBDocument: { findMany: vi.fn().mockResolvedValue([]) },
    QAPair: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { generateSmartFlows, generateJourney } from './flowGenerator.js';

const ORG = 'org-teste-123';

/** Os eventos que o cliente receberia, na ordem em que foram emitidos. */
function emitted() {
  return mockEmit.mock.calls.map((c) => c[1]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetIo.mockReturnValue({ to: mockTo });
  mockOrgFindUnique.mockResolvedValue({
    plan: 'GROWTH',
    settings: { businessName: 'Clínica Teste', segmento: 'odontologia', agentName: 'Vera' },
  });
  // Não vira block plan de propósito: a geração cai no fallback do blueprint.
  mockComplete.mockResolvedValue({ text: '{}' });
});

describe('generateSmartFlows · progresso', () => {
  it('1 objetivo: emite context → draft → done, sempre pra frente', async () => {
    const res = await generateSmartFlows({
      organizationId: ORG, objectives: ['atendimento'], runId: 'run-abc12345',
    });
    expect(res.drafts).toHaveLength(1);

    const evs = emitted();
    expect(evs.map((e) => e.phase)).toEqual(['context', 'draft', 'done']);
    expect(evs[0].label).toBe('Lendo o treinamento da sua IA');
    expect(evs[1].label).toContain('Montando o fluxo de');

    // A barra nunca anda pra trás, e o marco nunca ultrapassa o teto que ele
    // mesmo anuncia — é isso que impede a UI de mentir que terminou.
    for (let i = 0; i < evs.length; i++) {
      expect(evs[i].percent).toBeLessThanOrEqual(evs[i].nextPercent);
      expect(evs[i].nextPercent).toBeLessThanOrEqual(100);
      if (i > 0) expect(evs[i].percent).toBeGreaterThanOrEqual(evs[i - 1].percent);
    }
    // O pipeline entrega a régua cheia pro cliente fechar em 100 na resposta HTTP.
    expect(evs[evs.length - 1].percent).toBe(97);
  });

  it('multi-agente: um marco por objetivo, numerado pro cliente', async () => {
    const res = await generateSmartFlows({
      organizationId: ORG,
      objectives: ['atendimento', 'vendas', 'agendamento'],
      multiAgent: true,
      runId: 'run-abc12345',
    });
    expect(res.drafts).toHaveLength(3);

    const drafts = emitted().filter((e) => e.phase === 'draft');
    expect(drafts).toHaveLength(3);
    expect(drafts.map((e) => e.step)).toEqual([1, 2, 3]);
    expect(drafts.every((e) => e.totalSteps === 3)).toBe(true);
    // Fatias contíguas: o teto de um objetivo é o piso do próximo, sem buraco.
    expect(drafts[1].percent).toBe(drafts[0].nextPercent);
    expect(drafts[2].percent).toBe(drafts[1].nextPercent);
  });

  it('sem runId o cliente antigo não quebra: não emite nada e gera igual', async () => {
    const res = await generateSmartFlows({ organizationId: ORG, objectives: ['atendimento'] });
    expect(res.drafts).toHaveLength(1);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('cada evento vai pra sala da própria org e carrega o runId do cliente', async () => {
    await generateSmartFlows({ organizationId: ORG, objectives: ['vendas'], runId: 'run-abc12345' });
    // Isolamento multi-tenant: nada de vazar progresso pra outra organização.
    expect(mockTo).toHaveBeenCalledWith(`org:${ORG}`);
    expect(mockTo.mock.calls.every((c) => c[0] === `org:${ORG}`)).toBe(true);
    // O runId é o que separa duas gerações simultâneas dentro da mesma org.
    expect(emitted().every((e) => e.runId === 'run-abc12345')).toBe(true);
  });

  it('Socket.io fora do ar não derruba a geração', async () => {
    mockGetIo.mockReturnValue(undefined);
    const res = await generateSmartFlows({
      organizationId: ORG, objectives: ['atendimento'], runId: 'run-abc12345',
    });
    // Progresso é cosmético: sem socket o cliente perde a barra, nunca o fluxo.
    expect(res.drafts).toHaveLength(1);
  });
});

describe('generateJourney · progresso', () => {
  it('drafts → handoffs → fiação, na ordem e sem passar de 100', async () => {
    const res = await generateJourney({
      organizationId: ORG, objectives: ['atendimento', 'vendas'], runId: 'run-jornada1',
    });
    expect(res.flows).toHaveLength(2);

    const evs = emitted();
    expect(evs.map((e) => e.phase)).toEqual(['context', 'draft', 'draft', 'handoffs', 'wiring', 'done']);
    expect(evs.find((e) => e.phase === 'handoffs')?.label).toBe('Ligando os fluxos entre si');

    for (let i = 1; i < evs.length; i++) {
      expect(evs[i].percent).toBeGreaterThanOrEqual(evs[i - 1].percent);
      expect(evs[i].nextPercent).toBeLessThanOrEqual(100);
    }
  });

  it('1 objetivo só: o handoff não rouba régua, porque nem vai rodar', async () => {
    // designHandoffs volta [] sem chamar LLM com menos de 2 objetivos. Se ele
    // ainda pesasse na régua, a barra empacaria esperando uma etapa instantânea.
    await generateJourney({ organizationId: ORG, objectives: ['atendimento'], runId: 'run-jornada1' });
    const handoff = emitted().find((e) => e.phase === 'handoffs');
    expect(handoff).toBeDefined();
    expect(handoff!.nextPercent).toBe(handoff!.percent);
  });
});
