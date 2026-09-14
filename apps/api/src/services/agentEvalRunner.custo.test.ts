/**
 * agentEvalRunner.custo.test.ts — A067 / A192
 * ============================================================================
 * Toda chamada de LLM do avaliador ia para llm_call_logs com organization_id
 * NULO e operation 'chat'/'classify': USD 164 em 90 dias sem dono, invisíveis
 * no painel por tenant e indistinguíveis do atendimento real.
 *
 * E nenhuma delas tinha tempo limite: 23 chamadas passaram de 30 s, uma chegou
 * a 207 s e uma execução levou 38 minutos.
 *
 * Aqui provamos, com um llmRouter falso que registra as chamadas:
 *   ✓ as quatro chamadas (classify, agente, juiz, sugestão) levam operation
 *     'eval' e o orgId da organização do agente
 *   ✓ chamada pendurada vira falha do cenário em 60 s, não trava a execução
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { completeMock, classifyMock } = vi.hoisted(() => ({
  completeMock: vi.fn(),
  classifyMock: vi.fn(),
}));

vi.mock('./llm/LLMRouter.js', () => ({
  llmRouter: { complete: (...a: any[]) => completeMock(...a) },
}));
vi.mock('./llm/intentClassifier.js', () => ({
  classifyIntent: (...a: any[]) => classifyMock(...a),
  shouldEscalateToSonnet: vi.fn().mockReturnValue(false),
}));
vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../agents/coreAgentRules.js', () => ({
  CORE_AGENT_RULES_V1: '# REGRAS BASE',
  CORE_RULES_VERSION: 'v2',
}));

const { executeAgentEvalRun, runJudge } = await import('./agentEvalRunner.js');

const PERFIL = {
  organizationId: 'org-do-cliente',
  isZappIQ: false,
  agentName: 'Vera',
  businessName: 'CMJ',
  niche: 'servicos_b2b',
};

const AGENTE = { id: 'agent-1', name: 'Vera', systemPrompt: 'prompt do cliente' };

/** Cenário que REPROVA no determinístico, para acionar também o suggestFix. */
const CENARIO_QUE_REPROVA = {
  id: 'cr1_teste',
  category: 'cr1_acceptance' as const,
  description: 'cenário de teste',
  userMessage: 'oi',
  expectedBehavior: 'saudar e conduzir',
  passPatterns: [/jamais vai casar/],
  severity: 'high' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  classifyMock.mockResolvedValue('normal');
  // O juiz reprova, então o runner também gera sugestão: as 4 chamadas.
  completeMock.mockResolvedValue({
    text: JSON.stringify({
      passed: false,
      confidence: 80,
      reason: 'não conduziu',
      summary: 'ajuste',
      // A188: a regra fecha a frase de propósito. Sem o ponto final, o
      // sugeridor pede o patch de novo e a contagem de chamadas muda.
      patches: [{ where: 'A', diff: '+ conduza a conversa.' }],
    }),
    usage: { inputTokens: 10, outputTokens: 5 },
  });
});

describe('o teste da Qualidade tem dono em toda chamada de LLM', () => {
  it("classify, agente, juiz e sugestão levam operation 'eval' e o orgId", async () => {
    await executeAgentEvalRun([CENARIO_QUE_REPROVA], AGENTE, PERFIL);

    // 3 chamadas diretas ao router (agente, juiz, sugestão) + 1 classify.
    expect(completeMock).toHaveBeenCalledTimes(3);
    for (const [req] of completeMock.mock.calls) {
      expect(req.operation).toBe('eval');
      expect(req.orgId).toBe('org-do-cliente');
    }

    expect(classifyMock).toHaveBeenCalledTimes(1);
    const ctx = classifyMock.mock.calls[0][2];
    expect(ctx.orgId).toBe('org-do-cliente');
    expect(ctx.operation).toBe('eval');
  });

  it('perfil sem organizationId não inventa dono (orgId nulo)', async () => {
    await executeAgentEvalRun([CENARIO_QUE_REPROVA], AGENTE, {
      isZappIQ: false,
      agentName: 'X',
      businessName: 'Y',
    });

    for (const [req] of completeMock.mock.calls) {
      expect(req.orgId).toBeNull();
      expect(req.operation).toBe('eval');
    }
  });
});

/* Rodada 4 do PR #375: a conta que o re-teste declara. Com `pularSugestao`
 * (é o que o re-teste passa), cada amostra são TRÊS chamadas ao modelo: a
 * classificação da intenção, a resposta do agente e o juiz. O re-teste roda
 * 3 amostras, então declara 9. */
describe('custo de uma amostra do re-teste', () => {
  it('com pularSugestao, uma amostra reprovada são 3 chamadas: classificação, agente e juiz', async () => {
    await executeAgentEvalRun([CENARIO_QUE_REPROVA], AGENTE, PERFIL, { pularSugestao: true });

    expect(classifyMock).toHaveBeenCalledTimes(1);
    expect(completeMock).toHaveBeenCalledTimes(2);
  });
});

describe('o juiz não é gasto de bastidor fora do avaliador', () => {
  it("sem operação explícita, runJudge grava 'classify'", async () => {
    // É o caso da simulação do Maestro (agents/flowSimulation.ts), que é
    // recurso DO CLIENTE: tem de continuar dentro do teto do trial e do
    // disjuntor mensal da organização dele.
    completeMock.mockResolvedValue({
      text: JSON.stringify({ passed: true, confidence: 90, reason: 'ok' }),
      usage: { inputTokens: 5, outputTokens: 5 },
    });

    await runJudge('atender bem', 'oi, tudo bem?', PERFIL);

    const [req] = completeMock.mock.calls[0];
    expect(req.operation).toBe('classify');
    expect(req.orgId).toBe('org-do-cliente');
  });

  it("o avaliador passa 'eval' explicitamente", async () => {
    await executeAgentEvalRun([CENARIO_QUE_REPROVA], AGENTE, PERFIL);

    for (const [req] of completeMock.mock.calls) {
      expect(req.operation).toBe('eval');
    }
  });
});

describe('chamada de LLM pendurada não trava a execução', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('corta em 60 s e registra o cenário como FALHA TÉCNICA, fora da nota', async () => {
    // Chamada do agente nunca resolve: é o caso real de 207 s observado.
    completeMock.mockImplementation(() => new Promise(() => {}));

    const promessa = executeAgentEvalRun([CENARIO_QUE_REPROVA], AGENTE, PERFIL);
    await vi.advanceTimersByTimeAsync(61_000);
    const { results, summary } = await promessa;

    expect(results).toHaveLength(1);
    // A171 (14/09/2026): antes isto virava 'fail' e entrava na nota. Tempo
    // limite do provedor não é erro do agente: vira 'erro', fica fora do
    // denominador e não gera sugestão.
    expect(results[0].combined).toBe('erro');
    expect(results[0].falhaTecnica).toMatch(/tempo limite da chamada de LLM/i);
    expect(results[0].suggestedFix).toBeUndefined();
    expect(summary.failed).toBe(0);
    expect(summary.erros).toBe(1);
  });

  it('a classificação de intenção pendurada também é cortada em 60 s', async () => {
    // Ela ficou de fora do tempo limite na primeira versão, e é a PRIMEIRA
    // chamada do cenário: pendurada ali, nem a resposta do agente era pedida.
    classifyMock.mockImplementation(() => new Promise(() => {}));

    const promessa = executeAgentEvalRun([CENARIO_QUE_REPROVA], AGENTE, PERFIL);
    await vi.advanceTimersByTimeAsync(61_000);
    const { results } = await promessa;

    // O cenário seguiu com o tier padrão, que é o comportamento de erro já
    // previsto para a classificação, em vez de segurar a execução inteira.
    expect(results).toHaveLength(1);
    expect(completeMock).toHaveBeenCalled();
    expect(completeMock.mock.calls[0][0].preferProvider).toBeUndefined();
  });
});
