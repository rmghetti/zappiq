/**
 * agentOrchestrator.trialGuards.test.ts — Resposta Meta out/2026 (PR-E)
 * ============================================================================
 * Guardas do regime TRIAL/NOVO no pipeline de resposta (passo 5.5a):
 *   ✓ cap de custo estourado: resposta degradada FIXA sem chamar LLM
 *   ✓ rate limit por contato estourado: IA sai em silêncio (nenhum envio)
 *   ✓ org pagante: pipeline normal intocado (nenhuma guarda consultada)
 * E o roteamento de modelo (pickTierAndOverride):
 *   ✓ org em TRIAL/NOVO: tier STARTER forçado (primário Gemini Flash),
 *     vencendo inclusive o override settings.llm_routing
 *   ✓ org pagante: tier do plano e overrides preservados byte a byte
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── stubs das guardas de trial (o resto do planLimits é o REAL) ──────────
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
vi.mock('../services/ragService.js', () => ({ search: vi.fn(async () => '') }));

const classifyMock = vi.fn(async () => 'faq');
vi.mock('../services/llm/langchainClient.js', () => ({
  chatCompletion: vi.fn(),
  classify: (...a: unknown[]) => classifyMock(...(a as [])),
}));

vi.mock('../services/crmAutomationService.js', () => ({
  syncContactToCrm: vi.fn(async () => undefined),
}));

const routeIzaTurnMock = vi.fn();
vi.mock('../services/llm/izaTurnRouter.js', () => ({
  routeIzaTurn: (...a: unknown[]) => routeIzaTurnMock(...(a as [])),
}));

vi.mock('../services/llm/tools.js', () => ({ getToolsForContext: vi.fn(() => []) }));
vi.mock('./tenantConversionUrls.js', () => ({
  extractConversionUrls: vi.fn(() => ({})),
  buildTenantLinksBlock: vi.fn(() => ''),
}));
vi.mock('../services/llm/LLMRouter.js', () => ({
  llmRouter: { complete: vi.fn() },
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

const { processIncomingMessage, pickTierAndOverride } = await import('./agentOrchestrator.js');

const MENSAGEM_DEGRADADA =
  'Estou em modo limitado neste período de teste; um humano continua te atendendo.';

const DIA = 24 * 3600 * 1000;

function orgRow(overrides: Record<string, unknown> = {}) {
  return {
    plan: 'STARTER',
    settings: {},
    whatsappPhoneNumberId: 'phone-1',
    whatsappAccessToken: 'token-1',
    trialStartedAt: new Date(Date.now() - 3 * DIA),
    trialEndsAt: new Date(Date.now() + 7 * DIA),
    isTrialActive: true,
    trialConverted: false,
    stripeSubscriptionId: null,
    trialCostCapUsd: 15,
    ...overrides,
  };
}

function inputBase() {
  return {
    organizationId: 'org-cliente',
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
  delete process.env.IZA_AUTOREPLY_TEMPLATE;

  prismaMock.organization.findUnique.mockResolvedValue(orgRow());
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

  routeIzaTurnMock.mockResolvedValue({
    kind: 'llm',
    response: {
      text: 'Olá! Posso ajudar?',
      provider: 'google-gemini-flash',
      model: 'gemini-2.5-flash',
      latencyMs: 120,
    },
    intent: 'faq',
    escalated: false,
    tierUsed: 'STARTER',
    llmCallsMade: 2,
  });
});

describe('passo 5.5a — cap de custo do TRIAL/NOVO', () => {
  it('cap estourado: responde a mensagem fixa degradada SEM chamar o LLM', async () => {
    getTrialLlmStageStub.mockResolvedValue({ capped: true, stage: 'TRIAL', capUsd: 15 });
    assertTrialCostCapStub.mockResolvedValue({
      allowed: false,
      reason: 'cap',
      spentUsd: 15.4,
      capUsd: 15,
    });

    await processIncomingMessage(inputBase());

    // Mensagem fixa foi pro cliente pelo canal normal e ficou persistida.
    expect(sendReplyTextMock).toHaveBeenCalledTimes(1);
    expect(sendReplyTextMock.mock.calls[0][0]).toMatchObject({
      organizationId: 'org-cliente',
      conversationId: 'conv-1',
      content: MENSAGEM_DEGRADADA,
    });
    expect(prismaMock.message.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.message.create.mock.calls[0][0].data).toMatchObject({
      content: MENSAGEM_DEGRADADA,
      isFromBot: true,
    });

    // Nenhuma chamada LLM de resposta, nenhum crédito consumido, sem sombra.
    expect(routeIzaTurnMock).not.toHaveBeenCalled();
    expect(enforceAiReplyQuotaStub).not.toHaveBeenCalled();
    expect(recordAttendanceShadowStub).not.toHaveBeenCalled();
  });

  it('org em TRIAL dentro do cap: fluxo normal segue até o LLM', async () => {
    getTrialLlmStageStub.mockResolvedValue({ capped: true, stage: 'TRIAL', capUsd: 15 });

    await processIncomingMessage(inputBase());

    expect(consumeTrialContactReplyBudgetStub).toHaveBeenCalledWith('org-cliente', 'contact-1');
    expect(assertTrialCostCapStub).toHaveBeenCalledWith('org-cliente');
    expect(routeIzaTurnMock).toHaveBeenCalledTimes(1);
    expect(sendReplyTextMock).toHaveBeenCalledTimes(1);
    expect(sendReplyTextMock.mock.calls[0][0]).toMatchObject({ content: 'Olá! Posso ajudar?' });
  });
});

describe('passo 5.5a — rate limit de respostas por contato', () => {
  it('31ª resposta na mesma hora: IA sai em silêncio (nenhum envio, nenhum LLM)', async () => {
    getTrialLlmStageStub.mockResolvedValue({ capped: true, stage: 'NOVO', capUsd: 15 });
    consumeTrialContactReplyBudgetStub.mockResolvedValue({ allowed: false, count: 31 });

    await processIncomingMessage(inputBase());

    expect(sendReplyTextMock).not.toHaveBeenCalled();
    expect(prismaMock.message.create).not.toHaveBeenCalled();
    expect(routeIzaTurnMock).not.toHaveBeenCalled();
    // Nem chega a consultar o cap: o silêncio corta antes.
    expect(assertTrialCostCapStub).not.toHaveBeenCalled();
  });
});

describe('org pagante: nada disso encosta no pipeline', () => {
  it('capped=false: responde normal e não consulta rate limit nem cap', async () => {
    await processIncomingMessage(inputBase());

    expect(routeIzaTurnMock).toHaveBeenCalledTimes(1);
    expect(sendReplyTextMock).toHaveBeenCalledTimes(1);
    expect(sendReplyTextMock.mock.calls[0][0]).toMatchObject({ content: 'Olá! Posso ajudar?' });
    expect(consumeTrialContactReplyBudgetStub).not.toHaveBeenCalled();
    expect(assertTrialCostCapStub).not.toHaveBeenCalled();
    // Caminho existente preservado: quota + sombra de atendimento rodaram.
    expect(enforceAiReplyQuotaStub).toHaveBeenCalledWith('org-cliente');
    expect(recordAttendanceShadowStub).toHaveBeenCalledWith('org-cliente', 'conv-1');
  });

  it('guarda com erro interno: fail-soft, fluxo normal segue (nunca lança)', async () => {
    getTrialLlmStageStub.mockRejectedValue(new Error('redis fora'));

    await expect(processIncomingMessage(inputBase())).resolves.toBeUndefined();

    expect(routeIzaTurnMock).toHaveBeenCalledTimes(1);
    expect(sendReplyTextMock).toHaveBeenCalledTimes(1);
  });
});

describe('pickTierAndOverride — modelo leve no TRIAL/NOVO', () => {
  it('org em TRIAL: força tier STARTER (Gemini Flash primário) mesmo com plano maior', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(orgRow({ plan: 'SCALE' }));

    await expect(pickTierAndOverride('org-trial')).resolves.toEqual({ tier: 'STARTER' });
  });

  it('org em TRIAL: vence até o override settings.llm_routing.forceProvider', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(
      orgRow({
        plan: 'SCALE',
        settings: { llm_routing: { forceProvider: 'anthropic-sonnet' } },
      }),
    );

    await expect(pickTierAndOverride('org-trial')).resolves.toEqual({ tier: 'STARTER' });
  });

  it('org NOVA (sem trial iniciado, sem assinatura): também roda em STARTER', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(
      orgRow({ plan: 'GROWTH', trialStartedAt: null, trialEndsAt: null, isTrialActive: false }),
    );

    await expect(pickTierAndOverride('org-nova')).resolves.toEqual({ tier: 'STARTER' });
  });

  it('org PAGANTE: tier do plano preservado (SCALE continua Sonnet primário)', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(
      orgRow({
        plan: 'SCALE',
        stripeSubscriptionId: 'sub_real',
        isTrialActive: false,
        trialConverted: true,
      }),
    );

    await expect(pickTierAndOverride('org-paga')).resolves.toEqual({ tier: 'SCALE' });
  });

  it('org PAGANTE com forceProvider: override continua valendo (comportamento intocado)', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(
      orgRow({
        plan: 'SCALE',
        stripeSubscriptionId: 'sub_real',
        settings: { llm_routing: { forceProvider: 'anthropic-sonnet' } },
      }),
    );

    await expect(pickTierAndOverride('org-paga')).resolves.toEqual({
      forceProvider: 'anthropic-sonnet',
    });
  });
});
