/**
 * llmCallAudit.trialCost.test.ts — Resposta Meta out/2026 (PR-E)
 * ============================================================================
 * logLLMCall passa a acumular o custo estimado da chamada no teto do trial
 * (recordTrialCost) quando a org está em regime TRIAL/NOVO:
 *   ✓ org em TRIAL: acumula o custo exato calculado pela tabela de preços
 *   ✓ org pagante (capped=false): NÃO acumula
 *   ✓ atalho orgIsTrialOrNew=true: acumula sem consultar o estágio
 *   ✓ falha no persist do audit não impede o acúmulo (blocos independentes)
 *   ✓ falha no acúmulo não derruba a chamada (fail-soft, nunca lança)
 *   ✓ sem org ou sem custo: não acumula
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, planLimitsMock } = vi.hoisted(() => ({
  prismaMock: { lLMCallLog: { create: vi.fn() } },
  planLimitsMock: {
    getTrialLlmStage: vi.fn(),
    recordTrialCost: vi.fn(),
  },
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

const { logLLMCall } = await import('./llmCallAudit.js');

// claude-sonnet-4-6: $3/1M in + $15/1M out. 1000 in + 1000 out = US$ 0.018.
const CUSTO_SONNET_1K_1K = 0.018;

function chamadaBase(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: 'org-1',
    conversationId: 'conv-1',
    provider: 'anthropic-sonnet',
    model: 'claude-sonnet-4-6',
    inputTokens: 1000,
    outputTokens: 1000,
    latencyMs: 900,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.lLMCallLog.create.mockResolvedValue({ id: 'log-1' });
  planLimitsMock.getTrialLlmStage.mockResolvedValue({ capped: false, stage: 'OTHER', capUsd: 0 });
  planLimitsMock.recordTrialCost.mockResolvedValue(undefined);
});

describe('logLLMCall — acúmulo de custo do TRIAL/NOVO', () => {
  it('org em TRIAL: acumula o custo estimado via recordTrialCost', async () => {
    planLimitsMock.getTrialLlmStage.mockResolvedValue({ capped: true, stage: 'TRIAL', capUsd: 15 });

    await logLLMCall(chamadaBase());

    expect(planLimitsMock.getTrialLlmStage).toHaveBeenCalledWith('org-1');
    expect(planLimitsMock.recordTrialCost).toHaveBeenCalledTimes(1);
    const [orgId, custo] = planLimitsMock.recordTrialCost.mock.calls[0];
    expect(orgId).toBe('org-1');
    expect(custo).toBeCloseTo(CUSTO_SONNET_1K_1K, 6);
  });

  it('org pagante (capped=false): não acumula nada', async () => {
    await logLLMCall(chamadaBase());

    expect(planLimitsMock.getTrialLlmStage).toHaveBeenCalledWith('org-1');
    expect(planLimitsMock.recordTrialCost).not.toHaveBeenCalled();
  });

  it('atalho orgIsTrialOrNew=true: acumula sem consultar o estágio', async () => {
    await logLLMCall(chamadaBase({ orgIsTrialOrNew: true }));

    expect(planLimitsMock.getTrialLlmStage).not.toHaveBeenCalled();
    expect(planLimitsMock.recordTrialCost).toHaveBeenCalledTimes(1);
  });

  it('atalho orgIsTrialOrNew=false: não consulta nem acumula', async () => {
    await logLLMCall(chamadaBase({ orgIsTrialOrNew: false }));

    expect(planLimitsMock.getTrialLlmStage).not.toHaveBeenCalled();
    expect(planLimitsMock.recordTrialCost).not.toHaveBeenCalled();
  });

  it('falha no persist do audit não impede o acúmulo do custo', async () => {
    prismaMock.lLMCallLog.create.mockRejectedValue(new Error('db off'));
    planLimitsMock.getTrialLlmStage.mockResolvedValue({ capped: true, stage: 'NOVO', capUsd: 15 });

    await expect(logLLMCall(chamadaBase())).resolves.toBeUndefined();

    expect(planLimitsMock.recordTrialCost).toHaveBeenCalledTimes(1);
  });

  it('falha no acúmulo é fail-soft: logLLMCall resolve sem lançar', async () => {
    planLimitsMock.getTrialLlmStage.mockResolvedValue({ capped: true, stage: 'TRIAL', capUsd: 15 });
    planLimitsMock.recordTrialCost.mockRejectedValue(new Error('redis off'));

    await expect(logLLMCall(chamadaBase())).resolves.toBeUndefined();
  });

  it('sem organizationId: não consulta estágio nem acumula', async () => {
    await logLLMCall(chamadaBase({ organizationId: null }));

    expect(planLimitsMock.getTrialLlmStage).not.toHaveBeenCalled();
    expect(planLimitsMock.recordTrialCost).not.toHaveBeenCalled();
  });

  it('chamada sem tokens (custo 0): não acumula', async () => {
    planLimitsMock.getTrialLlmStage.mockResolvedValue({ capped: true, stage: 'TRIAL', capUsd: 15 });

    await logLLMCall(chamadaBase({ inputTokens: null, outputTokens: null }));

    expect(planLimitsMock.recordTrialCost).not.toHaveBeenCalled();
  });

  it('audit continua sendo persistido normalmente (regressão)', async () => {
    await logLLMCall(chamadaBase());

    expect(prismaMock.lLMCallLog.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.lLMCallLog.create.mock.calls[0][0].data;
    expect(data.organizationId).toBe('org-1');
    expect(data.provider).toBe('anthropic-sonnet');
  });
});
