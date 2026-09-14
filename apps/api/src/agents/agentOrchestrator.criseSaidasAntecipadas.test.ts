/**
 * agentOrchestrator.criseSaidasAntecipadas.test.ts (I3 da revisão do PR #374)
 * ============================================================================
 * A rede de crise só cobria o caminho que passa pelo routeIzaTurn. O turno
 * tem SEIS saídas antecipadas que terminam antes dele, e em todas elas uma
 * mensagem de risco à vida era respondida sem o CVV, ou com silêncio:
 *
 *   ✓ fluxo do Maestro que se resolve sem IA (await_input, end, scheduled)
 *   ✓ rate limit de respostas do trial (a IA sai calada)
 *   ✓ cap de custo do trial (mensagem fixa degradada)
 *   ✓ quota do plano estourada em modo enforce (a IA sai calada)
 *   ✓ caminho agêntico do Maestro (resposta já enviada)
 *   ✓ pedido de humano (request_human) que sai pelo handleHandoff
 *
 * O caso mais duro é a quota: a pessoa escreve pedindo ajuda e a plataforma
 * não responde nada porque a organização passou do limite do plano. Limite
 * comercial não pode calar um pedido de socorro.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  conversation: { findUnique: vi.fn(), updateMany: vi.fn() },
  message: { findMany: vi.fn(), create: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
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

// A rede de crise (pausa, aviso ao dono, registro) é dublê: o que este teste
// prova é que o orquestrador a CHAMA nas saídas antecipadas. O que ela faz
// por dentro já está provado em crisisSafetyNet.test.ts.
const acionarRedeDeCriseMock = vi.fn(async () => ({
  pausou: true,
  avisou: true,
  registrou: true,
}));
vi.mock('../services/llm/crisisSafetyNet.js', async (importOriginal) => {
  const real = (await importOriginal()) as Record<string, unknown>;
  return {
    ...real,
    acionarRedeDeCrise: (...a: unknown[]) => acionarRedeDeCriseMock(...(a as [])),
  };
});

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
vi.mock('../services/llm/LLMRouter.js', () => ({ llmRouter: { complete: vi.fn() } }));
vi.mock('../services/llm/audioTranscription.js', () => ({ transcribeAudio: vi.fn() }));
vi.mock('./promptEngine.js', () => ({ getSystemPrompt: vi.fn(() => 'PROMPT FALLBACK') }));
vi.mock('./coreAgentRules.js', () => ({ CORE_AGENT_RULES_V1: 'CORE RULES' }));
vi.mock('./vozHumanaFilter.js', () => ({ applyVozHumanaFilter: (t: string) => t }));
vi.mock('../services/izaFactsService.js', () => ({ getIzaFactsBlock: vi.fn(async () => '') }));

const resolveActiveFlowStepMock = vi.fn(async () => null as unknown);
vi.mock('./flowRuntime.js', () => ({
  resolveActiveFlowStep: (...a: unknown[]) => resolveActiveFlowStepMock(...(a as [])),
}));
vi.mock('./flowEffects.js', () => ({ executeFlowEffects: vi.fn(async () => undefined) }));
vi.mock('./flowAiAgent.js', () => ({ runAgenticTurn: vi.fn() }));
vi.mock('./webhookTool.js', () => ({ buildWebhookToolDef: vi.fn(), executeWebhook: vi.fn() }));
vi.mock('../utils/socketRegistry.js', () => ({ getIo: vi.fn(() => undefined) }));

const { processIncomingMessage } = await import('./agentOrchestrator.js');
const { LINHA_DE_ACOLHIMENTO_CVV } = await import('../services/llm/blockedVerticalFilter.js');

const MENSAGEM_DEGRADADA =
  'Estou em modo limitado neste período de teste; um humano continua te atendendo.';

/** Mensagem que a rede de crise TEM de reconhecer. */
const PEDIDO_DE_AJUDA = 'não aguento mais viver, não vejo sentido em continuar';

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

function inputBase(messageContent = PEDIDO_DE_AJUDA) {
  return {
    organizationId: 'org-cliente',
    conversationId: 'conv-1',
    contactId: 'contact-1',
    contactPhone: '+5511999998888',
    contactName: 'Cliente Teste',
    messageContent,
    messageType: 'text',
    whatsappMessageId: 'wamid-in-1',
    orgSettings: {},
    channel: 'whatsapp' as const,
  };
}

/** Todo texto que o orquestrador mandou para o cliente neste turno. */
function textosEnviados(): string[] {
  return sendReplyTextMock.mock.calls.map((c) => String((c[0] as any).content ?? ''));
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
  prismaMock.conversation.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.message.findMany.mockResolvedValue([]);
  prismaMock.message.create.mockResolvedValue({ id: 'msg-out-1' });
  prismaMock.message.count.mockResolvedValue(1);
  prismaMock.contact.findUnique.mockResolvedValue({
    leadStatus: 'NEW',
    name: 'Cliente Teste',
    _count: { conversations: 1 },
  });
  prismaMock.agent.findFirst.mockResolvedValue({ systemPrompt: 'PROMPT', name: 'Vera' });

  enforceAiReplyQuotaStub.mockResolvedValue({ allowed: true, mode: 'audit_only' });
  getTrialLlmStageStub.mockResolvedValue({ capped: false, stage: 'OTHER', capUsd: 0 });
  consumeTrialContactReplyBudgetStub.mockResolvedValue({ allowed: true, count: 1 });
  assertTrialCostCapStub.mockResolvedValue({ allowed: true, spentUsd: 0, capUsd: 15 });
  resolveActiveFlowStepMock.mockResolvedValue(null);
  // clearAllMocks limpa chamadas, não implementações: o bloco do
  // request_human troca o rótulo e aqui ele volta ao padrão.
  classifyMock.mockResolvedValue('faq');

  routeIzaTurnMock.mockResolvedValue({
    kind: 'llm',
    response: { text: 'Olá! Posso ajudar?', provider: 'g', model: 'm', latencyMs: 10 },
    intent: 'faq',
    escalated: false,
    tierUsed: 'STARTER',
    llmCallsMade: 2,
  });
});

describe('quota do plano estourada: limite comercial não cala pedido de socorro', () => {
  beforeEach(() => {
    enforceAiReplyQuotaStub.mockResolvedValue({
      allowed: false,
      mode: 'enforce',
      current: 5000,
      limit: 5000,
      planId: 'STARTER',
    });
  });

  it('com sinal de crise, o CVV sai mesmo com a organização estourada', async () => {
    await processIncomingMessage(inputBase());

    expect(routeIzaTurnMock, 'a quota continua barrando o LLM').not.toHaveBeenCalled();
    const textos = textosEnviados();
    expect(textos).toHaveLength(1);
    expect(textos[0]).toContain(LINHA_DE_ACOLHIMENTO_CVV);
    expect(textos[0]).toContain('188');
    expect(textos[0]).toContain('cvv.org.br');
  });

  it('a rede de crise é acionada: a IA para e o dono é avisado', async () => {
    await processIncomingMessage(inputBase());

    expect(acionarRedeDeCriseMock).toHaveBeenCalledTimes(1);
    expect(acionarRedeDeCriseMock.mock.calls[0][0]).toMatchObject({
      organizationId: 'org-cliente',
      conversationId: 'conv-1',
      canal: 'whatsapp',
    });
  });

  it('a mensagem do acolhimento fica persistida na conversa', async () => {
    await processIncomingMessage(inputBase());

    expect(prismaMock.message.create).toHaveBeenCalledTimes(1);
    const dados = prismaMock.message.create.mock.calls[0][0].data;
    expect(dados.content).toContain('188');
    expect(dados.isFromBot).toBe(true);
    expect(dados.direction).toBe('OUTBOUND');
  });

  it('SEM sinal de crise, a quota continua calando o turno (nada muda)', async () => {
    await processIncomingMessage(inputBase('quanto custa o plano Growth?'));

    expect(sendReplyTextMock).not.toHaveBeenCalled();
    expect(prismaMock.message.create).not.toHaveBeenCalled();
    expect(acionarRedeDeCriseMock).not.toHaveBeenCalled();
  });
});

describe('guardas do trial: a linha do CVV atravessa as duas', () => {
  it('rate limit por contato (IA calada) passa a mandar o CVV quando há crise', async () => {
    getTrialLlmStageStub.mockResolvedValue({ capped: true, stage: 'NOVO', capUsd: 15 });
    consumeTrialContactReplyBudgetStub.mockResolvedValue({ allowed: false, count: 31 });

    await processIncomingMessage(inputBase());

    const textos = textosEnviados();
    expect(textos).toHaveLength(1);
    expect(textos[0]).toContain('188');
    expect(acionarRedeDeCriseMock).toHaveBeenCalledTimes(1);
  });

  it('cap de custo: a mensagem degradada sai COM o CVV, numa mensagem só', async () => {
    getTrialLlmStageStub.mockResolvedValue({ capped: true, stage: 'TRIAL', capUsd: 15 });
    assertTrialCostCapStub.mockResolvedValue({
      allowed: false,
      reason: 'cap',
      spentUsd: 15.4,
      capUsd: 15,
    });

    await processIncomingMessage(inputBase());

    const textos = textosEnviados();
    expect(textos, 'o cliente não pode receber duas mensagens seguidas').toHaveLength(1);
    expect(textos[0]).toContain(MENSAGEM_DEGRADADA);
    expect(textos[0]).toContain('188');
    expect(acionarRedeDeCriseMock).toHaveBeenCalledTimes(1);
  });

  it('cap de custo SEM crise devolve a mensagem degradada byte a byte', async () => {
    getTrialLlmStageStub.mockResolvedValue({ capped: true, stage: 'TRIAL', capUsd: 15 });
    assertTrialCostCapStub.mockResolvedValue({
      allowed: false,
      reason: 'cap',
      spentUsd: 15.4,
      capUsd: 15,
    });

    await processIncomingMessage(inputBase('quanto custa?'));

    expect(textosEnviados()).toEqual([MENSAGEM_DEGRADADA]);
    expect(acionarRedeDeCriseMock).not.toHaveBeenCalled();
  });
});

describe('fluxo do Maestro que termina sem IA', () => {
  it('await_input com sinal de crise manda o CVV antes de encerrar o turno', async () => {
    resolveActiveFlowStepMock.mockResolvedValue({
      next: 'await_input',
      effects: [],
      aiPrompt: undefined,
    });

    await processIncomingMessage(inputBase());

    expect(routeIzaTurnMock).not.toHaveBeenCalled();
    const textos = textosEnviados();
    expect(textos).toHaveLength(1);
    expect(textos[0]).toContain('188');
    expect(acionarRedeDeCriseMock).toHaveBeenCalledTimes(1);
  });

  it('timer agendado (scheduled) com crise também manda o CVV', async () => {
    resolveActiveFlowStepMock.mockResolvedValue({
      next: 'scheduled',
      effects: [],
      aiPrompt: undefined,
    });

    await processIncomingMessage(inputBase());

    expect(textosEnviados()[0]).toContain('188');
    expect(acionarRedeDeCriseMock).toHaveBeenCalledTimes(1);
  });

  it('await_input SEM crise não manda nada (comportamento de hoje)', async () => {
    resolveActiveFlowStepMock.mockResolvedValue({
      next: 'end',
      effects: [],
      aiPrompt: undefined,
    });

    await processIncomingMessage(inputBase('quero falar do orçamento'));

    expect(sendReplyTextMock).not.toHaveBeenCalled();
    expect(acionarRedeDeCriseMock).not.toHaveBeenCalled();
  });
});

describe('pedido de humano (request_human) com sinal de crise', () => {
  beforeEach(() => {
    classifyMock.mockResolvedValue('request_human');
  });

  it('a linha do CVV sai ANTES do "vou te conectar" do transbordo', async () => {
    await processIncomingMessage(inputBase());

    expect(routeIzaTurnMock, 'o transbordo continua sem passar pelo LLM').not.toHaveBeenCalled();
    const textos = textosEnviados();
    expect(textos.length).toBeGreaterThanOrEqual(2);
    expect(textos[0]).toContain(LINHA_DE_ACOLHIMENTO_CVV);
    expect(textos[textos.length - 1]).toContain('especialistas');
  });

  it('a rede de crise é acionada uma vez e o registro é da regra que casou', async () => {
    await processIncomingMessage(inputBase());

    expect(acionarRedeDeCriseMock).toHaveBeenCalledTimes(1);
    expect(acionarRedeDeCriseMock.mock.calls[0][0]).toMatchObject({
      organizationId: 'org-cliente',
      conversationId: 'conv-1',
      canal: 'whatsapp',
    });
    expect(String((acionarRedeDeCriseMock.mock.calls[0][0] as any).regra)).toMatch(/^crise_/);
  });

  it('SEM crise, o transbordo manda só a mensagem de espera (nada muda)', async () => {
    await processIncomingMessage(inputBase('quero falar com um atendente humano'));

    const textos = textosEnviados();
    expect(textos).toHaveLength(1);
    expect(textos[0]).toContain('especialistas');
    expect(acionarRedeDeCriseMock).not.toHaveBeenCalled();
  });
});

describe('o caminho normal continua acionando a rede uma vez só', () => {
  it('crise no caminho do routeIzaTurn não duplica o acolhimento', async () => {
    routeIzaTurnMock.mockResolvedValue({
      kind: 'llm',
      response: { text: 'Sinto muito que você esteja assim.', provider: 'g', model: 'm' },
      intent: 'faq',
      escalated: false,
      tierUsed: 'STARTER',
      llmCallsMade: 2,
      crise: { regra: 'crise_nao_aguento_viver' },
    });

    await processIncomingMessage(inputBase());

    const textos = textosEnviados();
    expect(textos).toHaveLength(1);
    expect(textos[0]).toContain('Sinto muito');
    expect(textos[0]).toContain('188');
    // Uma chamada só: a saída antecipada não roda quando o turno chega ao fim.
    expect(acionarRedeDeCriseMock).toHaveBeenCalledTimes(1);
  });
});
