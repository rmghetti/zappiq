/* ══════════════════════════════════════════════════════════════════════
 * agentOrchestrator.saidaUnica.test.ts (C1b, Passo 12 parte B)
 * --------------------------------------------------------------------
 * WhatsApp e Instagram pelo pós-processador único (A189): a guarda de
 * marca roda sobre a resposta real e o caminho agêntico do Maestro passa
 * a extrair <reply> e a aplicar o filtro de voz.
 *
 * Tudo dublê: nenhum modelo, nenhum banco, nenhuma fila de verdade.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// O orquestrador importa o motor de fluxos, e o agendador dele cria a fila
// BullMQ no import. Fila falsa, o mesmo padrão dos PRs #375 e #377.
vi.mock('bullmq', () => ({
  Queue: class {
    add = vi.fn();
    on = vi.fn();
  },
  Worker: class {
    on = vi.fn();
  },
}));

const enforceAiReplyQuotaStub = vi.fn();
const getTrialLlmStageStub = vi.fn();
vi.mock('../middleware/planLimits.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    enforceAiReplyQuota: (...a: unknown[]) => enforceAiReplyQuotaStub(...a),
    recordAttendanceShadow: vi.fn(async () => undefined),
    getTrialLlmStage: (...a: unknown[]) => getTrialLlmStageStub(...a),
    assertTrialCostCap: vi.fn(async () => ({ allowed: true, spentUsd: 0, capUsd: 15 })),
    consumeTrialContactReplyBudget: vi.fn(async () => ({ allowed: true, count: 1 })),
  };
});
vi.mock('../config/env.js', () => ({
  env: { QUOTA_OVERAGE_MODE: 'audit_only', RESOURCE_LIMITS_MODE: 'audit_only', REDIS_URL: 'redis://x' },
}));

const prismaMock = {
  organization: { findUnique: vi.fn() },
  conversation: { findUnique: vi.fn(), updateMany: vi.fn() },
  message: { findMany: vi.fn(), create: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  contact: { findUnique: vi.fn(), update: vi.fn() },
  agent: { findFirst: vi.fn() },
  prefilterEvent: { create: vi.fn() },
  orgFeatureFlag: { findMany: vi.fn(), findUnique: vi.fn() },
  appointmentType: { findMany: vi.fn() },
  agentRule: { findMany: vi.fn() },
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
const cacheGet = vi.fn(async (k: string) => cacheStore.get(k) ?? null);
vi.mock('../services/cloud/index.js', () => ({
  cache: {
    get: (...a: any[]) => (cacheGet as any)(...a),
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

const sendReplyTextMock = vi.fn();
const sendReplyInteractiveMock = vi.fn();
vi.mock('../services/channelDispatcher.js', () => ({
  sendReplyText: (...a: unknown[]) => sendReplyTextMock(...(a as [])),
  sendReplyInteractive: (...a: unknown[]) => sendReplyInteractiveMock(...(a as [])),
  markIncomingAsRead: vi.fn(async () => undefined),
}));

const sendAudioMock = vi.fn();
vi.mock('../services/whatsappService.js', () => ({ sendAudio: (...a: unknown[]) => sendAudioMock(...(a as [])) }));
vi.mock('../services/ragService.js', () => ({
  searchDetailed: vi.fn(async () => ({ context: '', sources: [], status: 'sem_resultado' })),
}));

const classifyMock = vi.fn(async () => '{"intent":"faq","consulta":""}');
vi.mock('../services/llm/langchainClient.js', () => ({
  chatCompletion: vi.fn(),
  classify: (...a: unknown[]) => classifyMock(...(a as [])),
}));
vi.mock('../services/crmAutomationService.js', () => ({ syncContactToCrm: vi.fn(async () => undefined) }));

const routeIzaTurnMock = vi.fn();
vi.mock('../services/llm/izaTurnRouter.js', () => ({
  routeIzaTurn: (...a: unknown[]) => routeIzaTurnMock(...(a as [])),
}));
vi.mock('../services/llm/tools.js', () => ({ getToolsForContext: vi.fn(() => []) }));
vi.mock('../services/llm/LLMRouter.js', async (importOriginal) => {
  const real = (await importOriginal()) as Record<string, unknown>;
  return { ...real, llmRouter: { complete: vi.fn() } };
});
const transcribeAudioMock = vi.fn();
vi.mock('../services/llm/audioTranscription.js', () => ({
  transcribeAudio: (...a: unknown[]) => transcribeAudioMock(...(a as [])),
}));
vi.mock('../services/izaFactsService.js', () => ({
  getIzaFactsBlock: vi.fn(async () => ''),
  invalidateIzaFactsCache: vi.fn(),
}));
vi.mock('../services/llm/circuitBreaker.js', () => ({ evaluateCostBreaker: vi.fn(async () => false) }));

const resolveActiveFlowStepMock = vi.fn(async () => null as unknown);
vi.mock('./flowRuntime.js', () => ({
  resolveActiveFlowStep: (...a: unknown[]) => resolveActiveFlowStepMock(...(a as [])),
}));
vi.mock('./flowEffects.js', () => ({ executeFlowEffects: vi.fn(async () => undefined) }));
const runAgenticTurnMock = vi.fn();
vi.mock('./flowAiAgent.js', () => ({ runAgenticTurn: (...a: unknown[]) => runAgenticTurnMock(...(a as [])) }));
vi.mock('./webhookTool.js', () => ({
  buildWebhookToolDef: vi.fn((t: any) => ({ name: t.name, description: 'x', input_schema: {} })),
  executeWebhook: vi.fn(),
}));

const emitMock = vi.fn();
const ioMock = { to: vi.fn(() => ({ emit: emitMock })) };
vi.mock('../utils/socketRegistry.js', () => ({ getIo: vi.fn(() => ioMock) }));

const { processIncomingMessage } = await import('./agentOrchestrator.js');
const { TEXTO_SEGURO_AO_CLIENTE } = await import('./postProcessReply.js');

function inputBase(over: Record<string, unknown> = {}) {
  return {
    organizationId: 'org-cliente',
    conversationId: 'conv-1',
    contactId: 'contact-1',
    contactPhone: '+5511999998888',
    contactName: 'Cliente Teste',
    messageContent: 'quanto custa a consultoria?',
    messageType: 'text',
    whatsappMessageId: 'wamid-in-1',
    orgSettings: { businessName: 'CMJ', agentName: 'Vera' },
    channel: 'whatsapp' as const,
    ...over,
  };
}

function respostaDoModelo(texto: string) {
  routeIzaTurnMock.mockResolvedValue({
    kind: 'llm',
    response: { text: texto, provider: 'g', model: 'm', latencyMs: 10 },
    intent: 'faq',
    escalated: false,
    tierUsed: 'GROWTH',
    llmCallsMade: 2,
  });
}

function textosEnviados(): string[] {
  return sendReplyTextMock.mock.calls.map((c) => String((c[0] as any).content ?? ''));
}

beforeEach(() => {
  vi.clearAllMocks();
  cacheStore.clear();
  delete process.env.IZA_AUTOREPLY_TEMPLATE;

  prismaMock.organization.findUnique.mockResolvedValue({
    plan: 'GROWTH',
    settings: {},
    whatsappPhoneNumberId: 'phone-1',
    whatsappAccessToken: null,
    trialStartedAt: null,
    trialEndsAt: null,
    isTrialActive: false,
    trialConverted: true,
    stripeSubscriptionId: 'sub_1',
  });
  prismaMock.conversation.findUnique.mockResolvedValue({ aiPaused: false, status: 'OPEN', assignedToId: null });
  prismaMock.conversation.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.message.findMany.mockResolvedValue([]);
  prismaMock.message.create.mockImplementation(async (args: any) => ({
    id: `msg-${prismaMock.message.create.mock.calls.length}`,
    createdAt: new Date('2026-09-14T12:00:00Z'),
    ...args.data,
  }));
  prismaMock.message.count.mockResolvedValue(1);
  prismaMock.contact.findUnique.mockResolvedValue({ leadStatus: 'NEW', name: 'Cliente Teste', _count: {} });
  prismaMock.agent.findFirst.mockResolvedValue({ id: 'a1', name: 'Vera', systemPrompt: 'Você é a Vera, da CMJ.' });
  prismaMock.prefilterEvent.create.mockResolvedValue({ id: 'ev-1' });
  prismaMock.orgFeatureFlag.findMany.mockResolvedValue([]);
  prismaMock.orgFeatureFlag.findUnique.mockResolvedValue(null);
  prismaMock.appointmentType.findMany.mockResolvedValue([]);
  prismaMock.agentRule.findMany.mockResolvedValue([]);

  enforceAiReplyQuotaStub.mockResolvedValue({ allowed: true, mode: 'audit_only' });
  getTrialLlmStageStub.mockResolvedValue({ capped: false, stage: 'OTHER', capUsd: 0 });
  resolveActiveFlowStepMock.mockResolvedValue(null);
  classifyMock.mockResolvedValue('{"intent":"faq","consulta":""}');
  sendReplyTextMock.mockResolvedValue({ channel: 'whatsapp', externalMessageId: 'wamid-out' });
  sendReplyInteractiveMock.mockResolvedValue({ channel: 'whatsapp', externalMessageId: 'wamid-btn' });
  respostaDoModelo('A consultoria dura 3 meses.');
});

describe('Passo 1: WhatsApp pelo pós-processador único', () => {
  it('marca da ZappIQ na resposta de um cliente: sai a resposta segura, nunca o vazamento', async () => {
    respostaDoModelo('Aqui é a Vera, da ZappIQ, a plataforma que a CMJ usa.');
    await processIncomingMessage(inputBase());

    expect(textosEnviados()).toEqual([TEXTO_SEGURO_AO_CLIENTE]);
    expect(prismaMock.prefilterEvent.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.prefilterEvent.create.mock.calls[0][0].data).toMatchObject({
      organizationId: 'org-cliente',
      conversationId: 'conv-1',
      canal: 'whatsapp',
      categoria: 'guarda-de-marca',
      regra: 'ZappIQ',
      acao: 'resposta_segura',
    });
  });

  it('Instagram: mesma guarda, canal registrado como instagram', async () => {
    respostaDoModelo('Somos da ZappIQ.');
    await processIncomingMessage(inputBase({ channel: 'instagram' }));

    expect(textosEnviados()).toEqual([TEXTO_SEGURO_AO_CLIENTE]);
    expect(prismaMock.prefilterEvent.create.mock.calls[0][0].data.canal).toBe('instagram');
  });

  it('resposta limpa sai como sempre saiu, sem alerta', async () => {
    respostaDoModelo('Claro!\n<reply>A consultoria dura 3 meses.</reply>');
    await processIncomingMessage(inputBase());

    expect(textosEnviados()).toEqual(['A consultoria dura 3 meses.']);
    expect(prismaMock.prefilterEvent.create).not.toHaveBeenCalled();
  });

  it('caminho agêntico do Maestro: extrai <reply> e aplica o filtro de voz (antes saía cru)', async () => {
    resolveActiveFlowStepMock.mockResolvedValue({
      next: 'ai',
      effects: [],
      aiPrompt: 'Consulte o estoque.',
      aiTools: [{ type: 'webhook', name: 'estoque', url: 'https://x' }],
    });
    runAgenticTurnMock.mockResolvedValue({
      text: 'Temos sim.\n<reply>Temos sim \u2014 chegou ontem.</reply>',
      toolsUsed: ['estoque'],
    });

    await processIncomingMessage(inputBase());

    expect(routeIzaTurnMock).not.toHaveBeenCalled();
    expect(textosEnviados()).toEqual(['Temos sim, chegou ontem.']);
  });
});
