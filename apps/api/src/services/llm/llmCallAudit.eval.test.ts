/**
 * llmCallAudit.eval.test.ts — A067 / A209 / A225
 * ============================================================================
 * O teste da Qualidade é gasto de BASTIDOR, não de atendimento. Ele precisa:
 *   ✓ gravar o custo COM a organização (hoje ia com organization_id nulo, e o
 *     painel por tenant não via nada)
 *   ✓ NÃO somar no teto de custo do trial (senão o teste da casa queima a
 *     franquia do cliente e o atendimento real cai em "modo limitado")
 *   ✓ NÃO somar no acumulador mensal do disjuntor (senão o teste arma o Modo
 *     Econômico sobre o atendimento real)
 *
 * As demais operações continuam somando nos dois lugares (regressão).
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, planLimitsMock, circuitBreakerMock } = vi.hoisted(() => ({
  prismaMock: { lLMCallLog: { create: vi.fn() } },
  planLimitsMock: {
    getTrialLlmStage: vi.fn(),
    recordTrialCost: vi.fn(),
  },
  circuitBreakerMock: { recordMonthlyLlmCost: vi.fn() },
}));

vi.mock('@zappiq/database', () => ({
  prisma: prismaMock,
  Prisma: {
    Decimal: class MockDecimal {
      constructor(public value: number) {}
    },
  },
}));
vi.mock('../../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../middleware/planLimits.js', () => planLimitsMock);
vi.mock('./circuitBreaker.js', () => circuitBreakerMock);

const { logLLMCall } = await import('./llmCallAudit.js');

// claude-sonnet-4-6: US$ 3/1M de entrada + US$ 15/1M de saída.
const CUSTO_SONNET_1K_1K = 0.018;

function chamadaDoAvaliador(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: 'org-cliente',
    conversationId: null,
    provider: 'anthropic-sonnet',
    model: 'claude-sonnet-4-6',
    operation: 'eval' as const,
    inputTokens: 1000,
    outputTokens: 1000,
    latencyMs: 1200,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.lLMCallLog.create.mockResolvedValue({ id: 'log-1' });
  // Org em TRIAL: é o cenário em que os dois acumuladores DISPARARIAM.
  planLimitsMock.getTrialLlmStage.mockResolvedValue({ capped: true, stage: 'TRIAL', capUsd: 15 });
  planLimitsMock.recordTrialCost.mockResolvedValue(undefined);
  circuitBreakerMock.recordMonthlyLlmCost.mockResolvedValue(undefined);
});

describe("logLLMCall — operação 'eval' tem dono mas fica fora do orçamento", () => {
  it('grava a linha de custo com a organização preenchida', async () => {
    await logLLMCall(chamadaDoAvaliador());

    expect(prismaMock.lLMCallLog.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.lLMCallLog.create.mock.calls[0][0].data;
    expect(data.organizationId).toBe('org-cliente');
    expect(data.operation).toBe('eval');
    expect(Number(data.costUsdEstimate.value)).toBeCloseTo(CUSTO_SONNET_1K_1K, 6);
  });

  it('não soma no teto de custo do trial, nem consulta o estágio', async () => {
    await logLLMCall(chamadaDoAvaliador());

    expect(planLimitsMock.recordTrialCost).not.toHaveBeenCalled();
    expect(planLimitsMock.getTrialLlmStage).not.toHaveBeenCalled();
  });

  it('não soma no acumulador mensal do disjuntor', async () => {
    await logLLMCall(chamadaDoAvaliador());

    expect(circuitBreakerMock.recordMonthlyLlmCost).not.toHaveBeenCalled();
  });

  it('o atalho orgIsTrialOrNew=true não reabre a porta do teto', async () => {
    await logLLMCall(chamadaDoAvaliador({ orgIsTrialOrNew: true }));

    expect(planLimitsMock.recordTrialCost).not.toHaveBeenCalled();
    expect(circuitBreakerMock.recordMonthlyLlmCost).not.toHaveBeenCalled();
  });
});

describe('logLLMCall — atendimento real segue somando (regressão)', () => {
  it("operação 'chat' soma no teto do trial e no disjuntor", async () => {
    await logLLMCall(chamadaDoAvaliador({ operation: 'chat', conversationId: 'conv-1' }));

    expect(planLimitsMock.recordTrialCost).toHaveBeenCalledTimes(1);
    expect(circuitBreakerMock.recordMonthlyLlmCost).toHaveBeenCalledTimes(1);
  });

  it('operação ausente (default chat) continua somando', async () => {
    await logLLMCall(chamadaDoAvaliador({ operation: undefined }));

    expect(planLimitsMock.recordTrialCost).toHaveBeenCalledTimes(1);
    expect(circuitBreakerMock.recordMonthlyLlmCost).toHaveBeenCalledTimes(1);
  });
});
