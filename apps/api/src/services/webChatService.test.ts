/**
 * webChatService.test.ts — Resposta Meta 2026 (persistência espelho do turno)
 * ============================================================================
 * Garante que cada turno do webchat espelha as mensagens na Conversation do
 * lead (5a.4) SEM mudar o contrato público do widget:
 *
 *   1. Turno grava Message INBOUND (antes da LLM) e OUTBOUND (depois) na
 *      conversa certa, e emite `new_message` no room da org (padrão do
 *      agentOrchestrator) pra conversa aparecer viva em /conversations.
 *   2. Falha de prisma (espelho ou lead) NUNCA quebra a resposta ao widget.
 *   3. Débito de atendimento em SOMBRA: SET NX por conversa conta 1 único
 *      atendimento por conversa no contador mensal `aiAttendancesPerMonth`,
 *      e erro de backend do cache não conta nada.
 *
 * Mocks: prisma (tabelas fake in-memory), cache (Map simulando Redis com
 * semântica de SET NX), socketRegistry (io fake com to().emit()). LLM/facts
 * mockados pro import do módulo não puxar infra real.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── Estado in-memory que simula as tabelas ─────────────────────────────── */
interface FakeContact {
  id: string;
  whatsappId: string;
  organizationId: string;
}
interface FakeConversation {
  id: string;
  contactId: string;
  organizationId: string;
  channel: string;
  status: string;
}
interface FakeMessage {
  id: string;
  direction: string;
  type: string;
  content: string;
  status: string;
  conversationId: string;
  isFromBot: boolean;
}

const contacts: FakeContact[] = [];
const conversations: FakeConversation[] = [];
const messages: FakeMessage[] = [];
let contactSeq = 0;
let convSeq = 0;
let msgSeq = 0;

// Flags de falha por teste (caso 2: resiliência).
let contactUpsertShouldFail = false;
let messageCreateShouldFail = false;

vi.mock('@zappiq/database', () => ({
  prisma: {
    contact: {
      upsert: vi.fn(async (args: any) => {
        if (contactUpsertShouldFail) throw new Error('db down (upsert)');
        const { whatsappId, organizationId } = args.where.whatsappId_organizationId;
        const existing = contacts.find(
          (c) => c.whatsappId === whatsappId && c.organizationId === organizationId,
        );
        if (existing) return existing;
        const created: FakeContact = {
          id: `contact_${++contactSeq}`,
          whatsappId: args.create.whatsappId,
          organizationId: args.create.organizationId,
        };
        contacts.push(created);
        return created;
      }),
    },
    conversation: {
      findFirst: vi.fn(async (args: any) => {
        const { contactId, organizationId, channel } = args.where;
        const statuses: string[] = args.where.status?.in ?? [];
        const found = conversations.find(
          (c) =>
            c.contactId === contactId &&
            c.organizationId === organizationId &&
            c.channel === channel &&
            statuses.includes(c.status),
        );
        return found ? { id: found.id } : null;
      }),
      create: vi.fn(async (args: any) => {
        const created: FakeConversation = {
          id: `conv_${++convSeq}`,
          contactId: args.data.contactId,
          organizationId: args.data.organizationId,
          channel: args.data.channel,
          status: args.data.status,
        };
        conversations.push(created);
        return { id: created.id };
      }),
    },
    message: {
      create: vi.fn(async (args: any) => {
        if (messageCreateShouldFail) throw new Error('db down (message)');
        const created: FakeMessage = {
          id: `msg_${++msgSeq}`,
          direction: args.data.direction,
          type: args.data.type,
          content: args.data.content,
          status: args.data.status,
          conversationId: args.data.conversationId,
          isFromBot: args.data.isFromBot,
        };
        messages.push(created);
        return created;
      }),
    },
    // loadOrgSystemPrompt busca o system_prompt do agente comercial da org.
    $queryRawUnsafe: vi.fn(async () => [{ system_prompt: 'PROMPT DA ORG' }]),
  },
}));

/* ── Cache fake com semântica Redis (SET NX + INCRBY) ───────────────────── */
const cacheStore = new Map<string, string>();
const setNXMock = vi.fn(async (key: string, value: string, _ttlSeconds: number) => {
  if (cacheStore.has(key)) return false;
  cacheStore.set(key, value);
  return true;
});
const incrbyMock = vi.fn(async (key: string, amount = 1) => {
  const next = (parseInt(cacheStore.get(key) ?? '0', 10) || 0) + amount;
  cacheStore.set(key, String(next));
  return next;
});
const expireMock = vi.fn(async () => true);

vi.mock('./cloud/index.js', () => ({
  cache: {
    setNX: (...args: any[]) => (setNXMock as any)(...args),
    incrby: (...args: any[]) => (incrbyMock as any)(...args),
    expire: (...args: any[]) => (expireMock as any)(...args),
  },
}));

/* ── Socket.io fake via socketRegistry (mesmo caminho do orchestrator) ──── */
const emitMock = vi.fn();
const toMock = vi.fn(() => ({ emit: emitMock }));
vi.mock('../utils/socketRegistry.js', () => ({
  getIo: vi.fn(() => ({ to: toMock })),
}));

/* ── Deps que não interessam aqui ───────────────────────────────────────── */
const chatCompletionMock = vi.fn(async () => ({
  text: 'Oi! Posso ajudar?',
  inputTokens: 10,
  outputTokens: 5,
  provider: 'anthropic',
  model: 'sonnet',
}));
vi.mock('./llm/langchainClient.js', () => ({
  chatCompletion: (...args: any[]) => (chatCompletionMock as any)(...args),
}));
vi.mock('../agents/coreAgentRules.js', () => ({ CORE_AGENT_RULES_V1: 'CORE' }));
vi.mock('./izaFactsService.js', () => ({ getIzaFactsBlock: vi.fn(async () => '') }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { processWebChatTurn } = await import('./webChatService.js');

const IZA_ORG = 'cmo1ywwfe00ko1jskexiexsm4';

function currentUsageKey(): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `zappiq:usage:${IZA_ORG}:${ym}:aiAttendancesPerMonth`;
}

beforeEach(() => {
  contacts.length = 0;
  conversations.length = 0;
  messages.length = 0;
  contactSeq = 0;
  convSeq = 0;
  msgSeq = 0;
  contactUpsertShouldFail = false;
  messageCreateShouldFail = false;
  cacheStore.clear();
  vi.clearAllMocks();
});

describe('processWebChatTurn: espelho INBOUND/OUTBOUND (Resposta Meta 2026)', () => {
  it('grava INBOUND antes da LLM e OUTBOUND depois, na conversa certa, e emite new_message', async () => {
    const res = await processWebChatTurn({
      sessionId: 'sess-mirror',
      message: 'quero saber os preços',
      history: [],
    });

    // Contrato do widget intocado: resposta chega normalmente.
    expect(res.reply).toBe('Oi! Posso ajudar?');
    expect(res.provider).toBe('anthropic');

    // Exatamente 2 mensagens na MESMA conversa do lead.
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      direction: 'INBOUND',
      type: 'TEXT',
      content: 'quero saber os preços',
      status: 'DELIVERED',
      conversationId: 'conv_1',
      isFromBot: false,
    });
    expect(messages[1]).toMatchObject({
      direction: 'OUTBOUND',
      type: 'TEXT',
      content: 'Oi! Posso ajudar?',
      status: 'SENT',
      conversationId: 'conv_1',
      isFromBot: true,
    });

    // Ordem: INBOUND persiste ANTES da chamada LLM; OUTBOUND depois.
    const { prisma } = (await import('@zappiq/database')) as any;
    const [inboundOrder, outboundOrder] = prisma.message.create.mock.invocationCallOrder;
    const [llmOrder] = chatCompletionMock.mock.invocationCallOrder;
    expect(inboundOrder).toBeLessThan(llmOrder);
    expect(llmOrder).toBeLessThan(outboundOrder);

    // Realtime: new_message no room da org, mesmo shape do agentOrchestrator.
    expect(toMock).toHaveBeenCalledWith(`org:${IZA_ORG}`);
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith('new_message', {
      conversationId: 'conv_1',
      message: expect.objectContaining({
        content: 'Oi! Posso ajudar?',
        direction: 'OUTBOUND',
        isFromBot: true,
        createdAt: expect.any(String),
      }),
    });
  });

  it('turnos seguintes da MESMA sessão acumulam mensagens na MESMA conversa', async () => {
    await processWebChatTurn({ sessionId: 'sess-2t', message: 'oi', history: [] });
    await processWebChatTurn({
      sessionId: 'sess-2t',
      message: 'e o trial?',
      history: [{ role: 'user', content: 'oi' }, { role: 'assistant', content: 'Oi! Posso ajudar?' }],
    });

    expect(conversations).toHaveLength(1);
    expect(messages).toHaveLength(4);
    expect(messages.every((m) => m.conversationId === 'conv_1')).toBe(true);
  });
});

describe('processWebChatTurn: falha de persistência nunca quebra a resposta', () => {
  it('prisma.message.create fora do ar: resposta segue, sem emit e sem débito', async () => {
    messageCreateShouldFail = true;

    const res = await processWebChatTurn({
      sessionId: 'sess-db-down',
      message: 'olá',
      history: [],
    });

    expect(res.reply).toBe('Oi! Posso ajudar?');
    expect(messages).toHaveLength(0);
    // Sem OUTBOUND persistido, não anuncia no socket nem conta atendimento.
    expect(emitMock).not.toHaveBeenCalled();
    expect(setNXMock).not.toHaveBeenCalled();
  });

  it('ensureWebChatLead fora do ar: resposta segue e nenhum espelho é tentado', async () => {
    contactUpsertShouldFail = true;

    const res = await processWebChatTurn({
      sessionId: 'sess-lead-down',
      message: 'olá',
      history: [],
    });

    expect(res.reply).toBe('Oi! Posso ajudar?');
    const { prisma } = (await import('@zappiq/database')) as any;
    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(setNXMock).not.toHaveBeenCalled();
  });
});

describe('processWebChatTurn: débito de atendimento em sombra (SET NX)', () => {
  it('conta 1 único atendimento por conversa, mesmo com vários turnos', async () => {
    // Turno 1: marcador novo, incrementa o contador mensal.
    await processWebChatTurn({ sessionId: 'sess-att', message: 'oi', history: [] });
    expect(setNXMock).toHaveBeenCalledWith(
      `zappiq:att:${IZA_ORG}:conv_1`,
      '1',
      90 * 24 * 3600,
    );
    expect(incrbyMock).toHaveBeenCalledTimes(1);
    expect(cacheStore.get(currentUsageKey())).toBe('1');
    // TTL do contador só na criação (padrão incr+expire do planLimits).
    expect(expireMock).toHaveBeenCalledTimes(1);
    expect(expireMock).toHaveBeenCalledWith(currentUsageKey(), 35 * 24 * 3600);

    // Turno 2 da MESMA sessão/conversa: SET NX devolve false, não conta de novo.
    await processWebChatTurn({ sessionId: 'sess-att', message: 'mais uma', history: [] });
    expect(incrbyMock).toHaveBeenCalledTimes(1);
    expect(cacheStore.get(currentUsageKey())).toBe('1');

    // Sessão nova (conversa nova): conta o 2o atendimento, sem novo expire.
    await processWebChatTurn({ sessionId: 'sess-att-2', message: 'oi', history: [] });
    expect(incrbyMock).toHaveBeenCalledTimes(2);
    expect(cacheStore.get(currentUsageKey())).toBe('2');
    expect(expireMock).toHaveBeenCalledTimes(1);
  });

  it('backend do cache fora (setNX null) não conta nada', async () => {
    setNXMock.mockResolvedValueOnce(null as any);

    await processWebChatTurn({ sessionId: 'sess-cache-down', message: 'oi', history: [] });

    expect(incrbyMock).not.toHaveBeenCalled();
    // A resposta e o espelho seguem normais.
    expect(messages).toHaveLength(2);
  });
});
