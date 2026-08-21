/**
 * agentOrchestrator.history.test.ts — janela de histórico do contexto da Iza
 * ============================================================================
 * Bug pego pelo benchmark do gate D4: o carregamento do histórico usava
 * `orderBy createdAt asc + take 20`, ou seja, as 20 PRIMEIRAS mensagens da
 * conversa. Em conversa longa a Iza enxergava o começo e não o fim.
 * Correção: `desc + take 20 + reverse` (as 20 ÚLTIMAS, em ordem cronológica),
 * mesmo padrão já usado no flowAiResume e na paginação da UI.
 *
 * O mock do prisma aqui SIMULA a semântica real de orderBy/take/skip sobre uma
 * tabela semeada com 25 mensagens: se o código voltar pro padrão errado, o
 * routeIzaTurn recebe as mensagens 1..20 e o teste quebra.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../middleware/planLimits.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    enforceAiReplyQuota: vi.fn(async () => ({ allowed: true, mode: 'audit_only' })),
    recordAttendanceShadow: vi.fn(async () => undefined),
    getTrialLlmStage: vi.fn(async () => ({ capped: false, stage: 'OTHER', capUsd: 0 })),
    assertTrialCostCap: vi.fn(async () => ({ allowed: true, spentUsd: 0, capUsd: 15 })),
    consumeTrialContactReplyBudget: vi.fn(async () => ({ allowed: true, count: 1 })),
  };
});

vi.mock('../config/env.js', () => ({
  env: { QUOTA_OVERAGE_MODE: 'audit_only', RESOURCE_LIMITS_MODE: 'audit_only' },
}));

// ── Tabela fake de mensagens + findMany que honra orderBy/take/skip ─────────
type FakeMessageRow = { direction: 'INBOUND' | 'OUTBOUND'; content: string; createdAt: Date };

let messageTable: FakeMessageRow[] = [];

function fakeFindMany(args: {
  orderBy?: { createdAt?: 'asc' | 'desc' };
  take?: number;
  skip?: number;
}) {
  let rows = [...messageTable];
  const dir = args?.orderBy?.createdAt ?? 'asc';
  rows.sort((a, b) =>
    dir === 'desc'
      ? b.createdAt.getTime() - a.createdAt.getTime()
      : a.createdAt.getTime() - b.createdAt.getTime(),
  );
  if (typeof args?.skip === 'number') rows = rows.slice(args.skip);
  if (typeof args?.take === 'number') rows = rows.slice(0, args.take);
  // select {direction, content}: devolve só o shape consumido pelo orchestrator
  return Promise.resolve(rows.map((r) => ({ direction: r.direction, content: r.content })));
}

const prismaMock = {
  organization: { findUnique: vi.fn() },
  conversation: { findUnique: vi.fn() },
  message: {
    findMany: vi.fn(fakeFindMany),
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

vi.mock('../services/cloud/index.js', () => ({
  cache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => true),
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

vi.mock('../services/llm/langchainClient.js', () => ({
  chatCompletion: vi.fn(),
  classify: vi.fn(async () => 'faq'),
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

const { processIncomingMessage } = await import('./agentOrchestrator.js');

const DIA = 24 * 3600 * 1000;

/** Semeia a tabela fake com N mensagens "msg 1".."msg N", createdAt crescente. */
function seedConversation(total: number) {
  const base = Date.now() - 2 * 3600 * 1000;
  messageTable = Array.from({ length: total }, (_, i) => ({
    // Alterna cliente/Iza pra provar também o mapeamento de roles.
    direction: i % 2 === 0 ? ('INBOUND' as const) : ('OUTBOUND' as const),
    content: `msg ${i + 1}`,
    createdAt: new Date(base + i * 60_000),
  }));
}

function inputBase() {
  return {
    organizationId: 'org-cliente',
    conversationId: 'conv-longa',
    contactId: 'contact-1',
    contactPhone: '+5511999998888',
    contactName: 'Cliente Teste',
    messageContent: 'e aí, fechamos?',
    messageType: 'text',
    whatsappMessageId: 'wamid-in-26',
    orgSettings: {},
    channel: 'whatsapp' as const,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  messageTable = [];
  prismaMock.message.findMany.mockImplementation(fakeFindMany);

  prismaMock.organization.findUnique.mockResolvedValue({
    plan: 'GROWTH',
    settings: {},
    whatsappPhoneNumberId: 'phone-1',
    whatsappAccessToken: 'token-1',
    trialStartedAt: new Date(Date.now() - 40 * DIA),
    trialEndsAt: new Date(Date.now() - 26 * DIA),
    isTrialActive: false,
    trialConverted: true,
    stripeSubscriptionId: 'sub_real',
    trialCostCapUsd: 15,
  });
  prismaMock.conversation.findUnique.mockResolvedValue({
    aiPaused: false,
    status: 'OPEN',
    assignedToId: null,
  });
  prismaMock.message.create.mockResolvedValue({ id: 'msg-out-1' });
  prismaMock.message.count.mockResolvedValue(25);
  prismaMock.contact.findUnique.mockResolvedValue({
    leadStatus: 'NEW',
    name: 'Cliente Teste',
    _count: { conversations: 1 },
  });
  prismaMock.agent.findFirst.mockResolvedValue({ systemPrompt: 'PROMPT DO AGENTE', name: 'Iza' });

  routeIzaTurnMock.mockResolvedValue({
    kind: 'llm',
    response: {
      text: 'Fechamos sim!',
      provider: 'google-gemini-flash',
      model: 'gemini-2.5-flash',
      latencyMs: 120,
    },
    intent: 'faq',
    escalated: false,
    tierUsed: 'GROWTH',
    llmCallsMade: 2,
  });
});

describe('histórico do contexto — janela das ÚLTIMAS 20 mensagens', () => {
  it('conversa com 25 mensagens: contexto contém as msgs 6..25 em ordem cronológica (não as 1..20)', async () => {
    seedConversation(25);

    await processIncomingMessage(inputBase());

    expect(routeIzaTurnMock).toHaveBeenCalledTimes(1);
    const { history } = routeIzaTurnMock.mock.calls[0][0] as {
      history: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    // Janela de 20 mensagens: da 6ª à 25ª, em ordem cronológica.
    expect(history).toHaveLength(20);
    expect(history.map((h) => h.content)).toEqual(
      Array.from({ length: 20 }, (_, i) => `msg ${i + 6}`),
    );

    // Prova do bug antigo: o começo da conversa (msgs 1..5) fica DE FORA,
    // e o fim (msg 25, a mais recente) fica DENTRO e por último.
    expect(history[0].content).toBe('msg 6');
    expect(history[19].content).toBe('msg 25');
    expect(history.map((h) => h.content)).not.toContain('msg 1');

    // Mapeamento de roles preservado: INBOUND → user, OUTBOUND → assistant.
    // msg 6 (índice 5 na semeadura) é OUTBOUND; msg 25 (índice 24) é INBOUND.
    expect(history[0].role).toBe('assistant');
    expect(history[19].role).toBe('user');
  });

  it('conversa curta (3 mensagens): histórico completo, ordem cronológica intacta', async () => {
    seedConversation(3);

    await processIncomingMessage(inputBase());

    expect(routeIzaTurnMock).toHaveBeenCalledTimes(1);
    const { history } = routeIzaTurnMock.mock.calls[0][0] as {
      history: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    expect(history.map((h) => h.content)).toEqual(['msg 1', 'msg 2', 'msg 3']);
    expect(history.map((h) => h.role)).toEqual(['user', 'assistant', 'user']);
  });
});
