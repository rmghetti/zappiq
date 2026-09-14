/* ══════════════════════════════════════════════════════════════════════
 * agentEvalRunner com o montador de contexto injetado (C1a, A036).
 * --------------------------------------------------------------------
 * O runner não importa banco, base nem interruptor: recebe o montador por
 * opts.montarContexto. O que este teste prova:
 *   1. Sem montador (ou com montador que devolve null): o prompt de antes
 *      (buildEvalSystemPrompt) e nenhum rastro de contexto no resultado.
 *   2. Com montador: o modelo recebe o prompt do montador, e o resultado
 *      grava ragStatus e promptHash, inclusive em falha técnica.
 *   3. Montador que lança: cenário segue com o prompt de antes, com aviso.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { completeMock, classifyMock, warnMock } = vi.hoisted(() => ({
  completeMock: vi.fn(),
  classifyMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock('./llm/LLMRouter.js', () => ({
  llmRouter: { complete: (...a: any[]) => completeMock(...a) },
}));
vi.mock('./llm/intentClassifier.js', () => ({
  classifyIntent: (...a: any[]) => classifyMock(...a),
  shouldEscalateToSonnet: vi.fn().mockReturnValue(false),
}));
vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: (...a: any[]) => warnMock(...a), error: vi.fn() },
}));
vi.mock('../agents/coreAgentRules.js', () => ({
  CORE_AGENT_RULES_V1: '# REGRAS BASE',
  CORE_RULES_VERSION: 'v2',
}));

const { executeAgentEvalRun, buildEvalSystemPrompt } = await import('./agentEvalRunner.js');

const PERFIL = {
  organizationId: 'org-do-cliente',
  isZappIQ: false,
  agentName: 'Vera',
  businessName: 'CMJ',
  niche: 'servicos_b2b',
};
const AGENTE = { id: 'agent-1', name: 'Vera', systemPrompt: 'prompt do cliente' };
const CENARIO = {
  id: 'cr7_preco',
  category: 'cr7_no_invent' as const,
  description: 'preço da base',
  userMessage: 'quanto custa?',
  expectedBehavior: 'informar o preço',
  severity: 'critical' as const,
  passPatterns: [/890/],
};

function resposta(text: string, extra: Record<string, unknown> = {}) {
  return {
    text,
    provider: 'anthropic-sonnet',
    model: 'claude',
    latencyMs: 10,
    attempt: 1,
    usage: { inputTokens: 1, outputTokens: 1 },
    stopReason: 'end_turn',
    ...extra,
  };
}

const CONTEXTO = {
  systemPrompt: '# REGRAS BASE\nprompt do cliente\n# Contexto recuperado (RAG)\n[tabela] R$ 890',
  hash: 'f'.repeat(64),
  partes: [{ nome: 'core', chars: 13 }],
  ragStatus: 'ok' as const,
};

/** O system da PRIMEIRA chamada de chat (a resposta do agente). */
function systemDoAgente(): string {
  const chamada = completeMock.mock.calls.find((c: any[]) => c[0]?.operation !== 'eval' || c[0]?.maxTokens === 800);
  return String(chamada![0].system);
}

beforeEach(() => {
  vi.clearAllMocks();
  classifyMock.mockResolvedValue('normal');
  // 1ª chamada: agente responde; 2ª: juiz aprova.
  completeMock
    .mockResolvedValueOnce(resposta('<reply>Custa R$ 890.</reply>'))
    .mockResolvedValueOnce(resposta('{"passed": true, "confidence": 90, "reason": "ok"}'));
});

describe('sem montador: o prompt de antes', () => {
  it('usa buildEvalSystemPrompt e não grava rastro de contexto', async () => {
    const { results } = await executeAgentEvalRun([CENARIO], AGENTE, PERFIL);

    expect(systemDoAgente()).toBe(buildEvalSystemPrompt(AGENTE, CENARIO));
    expect(results[0].ragStatus).toBeUndefined();
    expect(results[0].promptHash).toBeUndefined();
    expect(results[0].combined).toBe('pass');
  });

  it('montador que devolve null (interruptor desligado) é o mesmo que nenhum', async () => {
    const montar = vi.fn(async () => null);

    const { results } = await executeAgentEvalRun([CENARIO], AGENTE, PERFIL, { montarContexto: montar });

    expect(montar).toHaveBeenCalledWith(CENARIO);
    expect(systemDoAgente()).toBe(buildEvalSystemPrompt(AGENTE, CENARIO));
    expect(results[0].promptHash).toBeUndefined();
  });
});

describe('com montador: o contexto de produção', () => {
  it('o modelo recebe o prompt do montador e o resultado grava ragStatus e promptHash', async () => {
    const montar = vi.fn(async () => CONTEXTO);

    const { results } = await executeAgentEvalRun([CENARIO], AGENTE, PERFIL, { montarContexto: montar });

    expect(systemDoAgente()).toBe(CONTEXTO.systemPrompt);
    expect(results[0]).toMatchObject({ combined: 'pass', ragStatus: 'ok', promptHash: 'f'.repeat(64) });
  });

  it('base fora do ar fica registrada no resultado, mesmo quando o cenário passa', async () => {
    const montar = vi.fn(async () => ({ ...CONTEXTO, ragStatus: 'servico_fora' as const }));

    const { results } = await executeAgentEvalRun([CENARIO], AGENTE, PERFIL, { montarContexto: montar });

    expect(results[0].ragStatus).toBe('servico_fora');
  });

  it('falha técnica também leva o rastro do contexto', async () => {
    completeMock.mockReset();
    completeMock.mockResolvedValue(resposta(''));
    const montar = vi.fn(async () => CONTEXTO);

    const { results } = await executeAgentEvalRun([CENARIO], AGENTE, PERFIL, { montarContexto: montar });

    expect(results[0].combined).toBe('erro');
    expect(results[0].promptHash).toBe('f'.repeat(64));
    expect(results[0].ragStatus).toBe('ok');
  });

  it('montador que lança: o cenário roda com o prompt de antes e o aviso fica no log', async () => {
    const montar = vi.fn(async () => {
      throw new Error('banco fora');
    });

    const { results } = await executeAgentEvalRun([CENARIO], AGENTE, PERFIL, { montarContexto: montar });

    expect(systemDoAgente()).toBe(buildEvalSystemPrompt(AGENTE, CENARIO));
    expect(results[0].combined).toBe('pass');
    expect(results[0].promptHash).toBeUndefined();
    expect(warnMock).toHaveBeenCalledWith(
      expect.stringContaining('montador de contexto falhou'),
      expect.objectContaining({ scenarioId: 'cr7_preco' }),
    );
  });
});
