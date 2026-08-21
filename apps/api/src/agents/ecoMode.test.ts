/**
 * ecoMode.test.ts — Resposta Meta out/2026 (PR-I)
 * ============================================================================
 * Modo Econômico no pipeline de resposta (breaker de custo armado). Roda o
 * orchestrator com o izaTurnRouter REAL (LLMRouter mockado por baixo) pra
 * provar os parâmetros que chegam na chamada LLM de verdade:
 *   ✓ tier STARTER forçado pra org PAGANTE (pickTierAndOverride com ecoMode)
 *   ✓ maxTokens do turno 2048 -> 512
 *   ✓ RAG top-k 5 -> 3
 *   ✓ skipClassify quando a intent do turno é conhecida; classify mantido
 *     quando a intent é 'other' (desconhecida)
 *   ✓ escalada pra Sonnet SÓ pra handoff (pedido de humano escala MESMO em
 *     ecomode; objection não escala)
 *   ✓ resposta SEMPRE sai (ecomode nunca silencia)
 *   ✓ breaker com erro: fail-soft, turno 100% normal
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── guardas de plano (mesmo padrão do agentOrchestrator.trialGuards) ─────
const enforceAiReplyQuotaStub = vi.fn();
const recordAttendanceShadowStub = vi.fn(async () => undefined);
const getTrialLlmStageStub = vi.fn();
const assertTrialCostCapStub = vi.fn();
const consumeTrialContactReplyBudgetStub = vi.fn();

vi.mock('../middleware/planLimits.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    enforceAiReplyQuota: (...a: unknown[]) => enforceAiReplyQuotaStub(...a),
    recordAttendanceShadow: (...a: unknown[]) => recordAttendanceShadowStub(...(a as [])),
    getTrialLlmStage: (...a: unknown[]) => getTrialLlmStageStub(...a),
    assertTrialCostCap: (...a: unknown[]) => assertTrialCostCapStub(...a),
    consumeTrialContactReplyBudget: (...a: unknown[]) =>
      consumeTrialContactReplyBudgetStub(...a),
  };
});

vi.mock('../config/env.js', () => ({
  env: { QUOTA_OVERAGE_MODE: 'audit_only', RESOURCE_LIMITS_MODE: 'audit_only' },
}));

// ── PR-I: breaker de custo controlado pelo teste ─────────────────────────
const evaluateCostBreakerMock = vi.fn(async () => false);
vi.mock('../services/llm/circuitBreaker.js', () => ({
  evaluateCostBreaker: (...a: unknown[]) => evaluateCostBreakerMock(...(a as [string])),
  recordMonthlyLlmCost: vi.fn(async () => undefined),
}));

const prismaMock = {
  organization: { findUnique: vi.fn() },
  conversation: { findUnique: vi.fn() },
  message: {
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  contact: { findUnique: vi.fn(), update: vi.fn() },
  agent: { findFirst: vi.fn() },
};
vi.mock('@zappiq/database', () => ({ prisma: prismaMock }));

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../services/quotaOverageService.js', () => ({
  reportOverageMeterEvent: vi.fn(async () => ({ reported: false, skipped: 'mode_audit_only' })),
  estimateOverageBrl: (n: number) => n * 0.03,
}));

const cacheStore = new Map<string, string>();
vi.mock('../services/cloud/index.js', () => ({
  cache: {
    get: vi.fn(async (k: string) => cacheStore.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      cacheStore.set(k, v);
      return true;
    }),
    del: vi.fn(async () => true),
    incrby: vi.fn(async () => 1),
    incrbyfloat: vi.fn(async () => 0),
    expire: vi.fn(async () => true),
    setNX: vi.fn(async () => true),
    mget: vi.fn(async () => []),
    ping: vi.fn(async () => true),
  },
}));

const sendReplyTextMock = vi.fn(async () => ({
  channel: 'whatsapp' as const,
  externalMessageId: 'wamid-out',
}));
vi.mock('../services/channelDispatcher.js', () => ({
  sendReplyText: (...a: unknown[]) => sendReplyTextMock(...(a as [])),
  sendReplyInteractive: vi.fn(async () => ({ channel: 'whatsapp', externalMessageId: 'x' })),
  markIncomingAsRead: vi.fn(async () => undefined),
}));

vi.mock('../services/whatsappService.js', () => ({ sendAudio: vi.fn() }));

const ragSearchMock = vi.fn(async () => '');
vi.mock('../services/ragService.js', () => ({
  search: (...a: unknown[]) => ragSearchMock(...(a as [])),
}));

// classify do PASSO 4 do orchestrator (langchainClient) — sempre roda.
const classifyTurnoMock = vi.fn(async () => 'faq');
vi.mock('../services/llm/langchainClient.js', () => ({
  chatCompletion: vi.fn(),
  classify: (...a: unknown[]) => classifyTurnoMock(...(a as [])),
}));

vi.mock('../services/crmAutomationService.js', () => ({
  syncContactToCrm: vi.fn(async () => undefined),
}));

// izaTurnRouter é REAL neste teste. Mockamos as bordas dele:
const llmCompleteMock = vi.fn();
vi.mock('../services/llm/LLMRouter.js', () => ({
  llmRouter: { complete: (...a: unknown[]) => llmCompleteMock(...(a as [])) },
}));

// classify de SEGUNDA camada (intentClassifier, dentro do izaTurnRouter).
const izaClassifyMock = vi.fn(async () => 'normal');
vi.mock('../services/llm/intentClassifier.js', () => ({
  classifyIntent: (...a: unknown[]) => izaClassifyMock(...(a as [])),
  shouldEscalateToSonnet: (intent: string) => intent !== 'normal',
}));

vi.mock('../services/llm/blockedVerticalFilter.js', () => ({
  detectBlockedVertical: vi.fn(() => ({ blocked: false })),
}));

vi.mock('../services/llm/tools.js', () => ({
  getToolsForContext: vi.fn(() => []),
  executeToolCall: vi.fn(),
}));

vi.mock('./tenantConversionUrls.js', () => ({
  extractConversionUrls: vi.fn(() => ({})),
  buildTenantLinksBlock: vi.fn(() => ''),
}));
vi.mock('../services/llm/audioTranscription.js', () => ({ transcribeAudio: vi.fn() }));
vi.mock('./promptEngine.js', () => ({ getSystemPrompt: vi.fn(() => 'PROMPT FALLBACK') }));
vi.mock('./coreAgentRules.js', () => ({ CORE_AGENT_RULES_V1: 'CORE RULES' }));
vi.mock('./vozHumanaFilter.js', () => ({ applyVozHumanaFilter: (t: string) => t }));
vi.mock('../services/izaFactsService.js', () => ({ getIzaFactsBlock: vi.fn(async () => '') }));
vi.mock('./flowRuntime.js', () => ({ resolveActiveFlowStep: vi.fn(async () => null) }));
vi.mock('./flowEffects.js', () => ({ executeFlowEffects: vi.fn(async () => undefined) }));
vi.mock('./flowAiAgent.js', () => ({ runAgenticTurn: vi.fn() }));
vi.mock('./webhookTool.js', () => ({
  buildWebhookToolDef: vi.fn(),
  executeWebhook: vi.fn(),
}));
vi.mock('../utils/socketRegistry.js', () => ({ getIo: vi.fn(() => undefined) }));

const { ZAPPIQ_ORG_ID } = await import('../config/zappiqOrg.js');
const { processIncomingMessage, pickTierAndOverride } = await import('./agentOrchestrator.js');

const DIA = 24 * 3600 * 1000;

/** Org PAGANTE (assinatura viva): fora do regime TRIAL/NOVO, plano SCALE. */
function orgPagante(overrides: Record<string, unknown> = {}) {
  return {
    plan: 'SCALE',
    settings: {},
    whatsappPhoneNumberId: 'phone-1',
    whatsappAccessToken: 'token-1',
    trialStartedAt: new Date(Date.now() - 90 * DIA),
    trialEndsAt: new Date(Date.now() - 76 * DIA),
    isTrialActive: false,
    trialConverted: true,
    stripeSubscriptionId: 'sub_real',
    trialCostCapUsd: 15,
    ...overrides,
  };
}

function inputBase() {
  return {
    organizationId: 'org-eco',
    conversationId: 'conv-1',
    contactId: 'contact-1',
    contactPhone: '+5511999998888',
    contactName: 'Cliente Teste',
    messageContent: 'oi, queria saber mais sobre o produto',
    messageType: 'text',
    whatsappMessageId: 'wamid-in-1',
    orgSettings: {},
    channel: 'whatsapp' as const,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  cacheStore.clear();

  prismaMock.organization.findUnique.mockResolvedValue(orgPagante());
  prismaMock.conversation.findUnique.mockResolvedValue({
    aiPaused: false,
    status: 'OPEN',
    assignedToId: null,
  });
  prismaMock.message.findMany.mockResolvedValue([]);
  prismaMock.message.create.mockResolvedValue({ id: 'msg-out-1' });
  prismaMock.message.count.mockResolvedValue(1);
  prismaMock.contact.findUnique.mockResolvedValue({
    leadStatus: 'NEW',
    name: 'Cliente Teste',
    _count: { conversations: 1 },
  });
  prismaMock.agent.findFirst.mockResolvedValue({ systemPrompt: 'PROMPT DO AGENTE', name: 'Vera' });

  enforceAiReplyQuotaStub.mockResolvedValue({ allowed: true, mode: 'audit_only' });
  getTrialLlmStageStub.mockResolvedValue({ capped: false, stage: 'OTHER', capUsd: 0 });
  consumeTrialContactReplyBudgetStub.mockResolvedValue({ allowed: true, count: 1 });
  assertTrialCostCapStub.mockResolvedValue({ allowed: true, spentUsd: 0, capUsd: 15 });

  evaluateCostBreakerMock.mockResolvedValue(false);
  classifyTurnoMock.mockResolvedValue('faq');
  izaClassifyMock.mockResolvedValue('normal');
  ragSearchMock.mockResolvedValue('');
  llmCompleteMock.mockResolvedValue({
    text: 'Resposta curta e barata.',
    provider: 'google-gemini-flash',
    model: 'gemini-2.5-flash',
    latencyMs: 100,
    stopReason: 'end_turn',
  });
});

describe('Modo Econômico LIGADO (breaker armado) em org PAGANTE', () => {
  beforeEach(() => {
    evaluateCostBreakerMock.mockResolvedValue(true);
  });

  it('aplica tier STARTER + maxTokens 512 + RAG top-k 3, e a resposta SAI', async () => {
    await processIncomingMessage(inputBase());

    // RAG encolhido: top-k 3 (era 5).
    expect(ragSearchMock).toHaveBeenCalledWith('org-eco', 'oi, queria saber mais sobre o produto', 3);

    // Chamada LLM principal com o corte de custo aplicado.
    expect(llmCompleteMock).toHaveBeenCalledTimes(1);
    const call = llmCompleteMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.maxTokens).toBe(512);
    expect(call.tier).toBe('STARTER'); // org SCALE pagante rebaixada no turno
    expect(call.forceProvider).toBeUndefined();
    expect(call.preferProvider).toBeUndefined();

    // Resposta SEMPRE sai: ecomode nunca silencia.
    expect(sendReplyTextMock).toHaveBeenCalledTimes(1);
    expect(sendReplyTextMock.mock.calls[0][0]).toMatchObject({
      organizationId: 'org-eco',
      conversationId: 'conv-1',
      content: 'Resposta curta e barata.',
    });
  });

  it('intent do turno conhecida (faq): pula o SEGUNDO classify (skipClassify)', async () => {
    classifyTurnoMock.mockResolvedValue('faq');

    await processIncomingMessage(inputBase());

    expect(izaClassifyMock).not.toHaveBeenCalled();
    expect(llmCompleteMock).toHaveBeenCalledTimes(1);
    expect(sendReplyTextMock).toHaveBeenCalledTimes(1);
  });

  it("intent do turno desconhecida ('other'): classify mantido", async () => {
    classifyTurnoMock.mockResolvedValue('other');

    await processIncomingMessage(inputBase());

    expect(izaClassifyMock).toHaveBeenCalledTimes(1);
    expect(sendReplyTextMock).toHaveBeenCalledTimes(1);
  });

  it('pedido de humano (handoff) ESCALA pra Sonnet mesmo em ecomode', async () => {
    classifyTurnoMock.mockResolvedValue('other'); // mantém o classify da 2ª camada
    izaClassifyMock.mockResolvedValue('handoff');

    await processIncomingMessage(inputBase());

    expect(llmCompleteMock).toHaveBeenCalledTimes(1);
    const call = llmCompleteMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.preferProvider).toBe('anthropic-sonnet'); // escalada preservada
    expect(call.maxTokens).toBe(512); // ainda no corte de tokens do ecomode
    expect(sendReplyTextMock).toHaveBeenCalledTimes(1); // e a resposta sai
  });

  it('objection NÃO escala em ecomode (fica no tier STARTER)', async () => {
    classifyTurnoMock.mockResolvedValue('other');
    izaClassifyMock.mockResolvedValue('objection');

    await processIncomingMessage(inputBase());

    const call = llmCompleteMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.preferProvider).toBeUndefined();
    expect(call.tier).toBe('STARTER');
    expect(sendReplyTextMock).toHaveBeenCalledTimes(1);
  });
});

describe('Modo Econômico DESLIGADO: pipeline byte a byte preservado', () => {
  it('RAG top-k 5, maxTokens 2048 (default), tier do plano (SCALE)', async () => {
    await processIncomingMessage(inputBase());

    expect(ragSearchMock).toHaveBeenCalledWith('org-eco', 'oi, queria saber mais sobre o produto', 5);

    const call = llmCompleteMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.maxTokens).toBe(2048);
    expect(call.tier).toBe('SCALE');

    // Sem ecomode, o segundo classify roda normalmente.
    expect(izaClassifyMock).toHaveBeenCalledTimes(1);
    expect(sendReplyTextMock).toHaveBeenCalledTimes(1);
  });

  it('breaker com erro interno: fail-soft, turno 100% normal', async () => {
    evaluateCostBreakerMock.mockRejectedValue(new Error('redis fora'));

    await expect(processIncomingMessage(inputBase())).resolves.toBeUndefined();

    expect(ragSearchMock).toHaveBeenCalledWith('org-eco', 'oi, queria saber mais sobre o produto', 5);
    const call = llmCompleteMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.maxTokens).toBe(2048);
    expect(call.tier).toBe('SCALE');
    expect(sendReplyTextMock).toHaveBeenCalledTimes(1);
  });
});

describe('pickTierAndOverride com ecoMode', () => {
  it('org PAGANTE + ecoMode: força STARTER', async () => {
    await expect(pickTierAndOverride('org-paga', { ecoMode: true })).resolves.toEqual({
      tier: 'STARTER',
    });
  });

  it('org PAGANTE + ecoMode: vence até settings.llm_routing.forceProvider', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(
      orgPagante({ settings: { llm_routing: { forceProvider: 'anthropic-sonnet' } } }),
    );

    await expect(pickTierAndOverride('org-paga', { ecoMode: true })).resolves.toEqual({
      tier: 'STARTER',
    });
  });

  it('sem ecoMode (ou false): comportamento intocado', async () => {
    await expect(pickTierAndOverride('org-paga')).resolves.toEqual({ tier: 'SCALE' });
    await expect(pickTierAndOverride('org-paga', { ecoMode: false })).resolves.toEqual({
      tier: 'SCALE',
    });
  });

  it('org da casa (ZappIQ): ecoMode NUNCA rebaixa o tier dela', async () => {
    await expect(pickTierAndOverride(ZAPPIQ_ORG_ID, { ecoMode: true })).resolves.toEqual({
      tier: 'SCALE',
    });
  });

  it('regressão: org em TRIAL segue forçando STARTER (lógica do PR-E intacta)', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(
      orgPagante({
        stripeSubscriptionId: null,
        isTrialActive: true,
        trialConverted: false,
        trialEndsAt: new Date(Date.now() + 7 * DIA),
      }),
    );

    await expect(pickTierAndOverride('org-trial')).resolves.toEqual({ tier: 'STARTER' });
  });
});
