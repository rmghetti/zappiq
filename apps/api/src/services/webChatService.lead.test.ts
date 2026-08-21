/**
 * webChatService.lead.test.ts — FEATURE 5a.4 (Webchat vira lead no CRM)
 * ============================================================================
 * Garante que o visitante do chat in-page do site vira um Contact no CRM,
 * ligado a uma Conversation channel='web', SEM duplicar a cada mensagem.
 *
 * Foco:
 *   1. buildWebChatLeadIdentity — identidade determinística `web:${sessionId}`
 *      na org canonical da Iza (pura, sem DB).
 *   2. ensureWebChatLead — idempotência: N chamadas da MESMA sessão =
 *      1 upsert de contato por chave + reuso da conversa aberta (não duplica).
 *
 * Mocks: prisma (contact.upsert / conversation.findFirst / conversation.create)
 * simula o comportamento real do banco (dedup por chave [whatsappId, org] e
 * find-or-create da conversa). LLM/facts são mockados só pra o import do módulo
 * não puxar infra real.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Estado in-memory que simula as duas tabelas ──────────────────────────────
interface FakeContact {
  id: string;
  whatsappId: string;
  organizationId: string;
  customFields: unknown;
  leadStatus: string;
  funnelStage: string;
}
interface FakeConversation {
  id: string;
  contactId: string;
  organizationId: string;
  channel: string;
  status: string;
}

const contacts: FakeContact[] = [];
const conversations: FakeConversation[] = [];
let contactSeq = 0;
let convSeq = 0;

vi.mock('@zappiq/database', () => ({
  prisma: {
    contact: {
      // Simula unique [whatsappId, organizationId]: mesma chave = mesmo registro.
      upsert: vi.fn(async (args: any) => {
        const { whatsappId, organizationId } = args.where.whatsappId_organizationId;
        const existing = contacts.find(
          (c) => c.whatsappId === whatsappId && c.organizationId === organizationId,
        );
        if (existing) return existing;
        const created: FakeContact = {
          id: `contact_${++contactSeq}`,
          whatsappId: args.create.whatsappId,
          organizationId: args.create.organizationId,
          customFields: args.create.customFields,
          leadStatus: args.create.leadStatus,
          funnelStage: args.create.funnelStage,
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
  },
}));

// Deps do módulo que não interessam ao teste de lead — mocks mínimos.
vi.mock('./llm/langchainClient.js', () => ({ chatCompletion: vi.fn() }));
vi.mock('../agents/coreAgentRules.js', () => ({ CORE_AGENT_RULES_V1: '' }));
vi.mock('./izaFactsService.js', () => ({ getIzaFactsBlock: vi.fn(async () => '') }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
// Resposta Meta 2026: o service passou a importar cache (débito sombra) e
// socketRegistry (realtime). Mock inerte: importar o real puxa redis + env.
vi.mock('./cloud/index.js', () => ({
  cache: {
    setNX: vi.fn(async () => true),
    incrby: vi.fn(async () => 1),
    expire: vi.fn(async () => true),
  },
}));
vi.mock('../utils/socketRegistry.js', () => ({ getIo: vi.fn(() => undefined) }));

const { buildWebChatLeadIdentity, ensureWebChatLead } = await import('./webChatService.js');

const IZA_ORG = 'cmo1ywwfe00ko1jskexiexsm4';

beforeEach(() => {
  contacts.length = 0;
  conversations.length = 0;
  contactSeq = 0;
  convSeq = 0;
  vi.clearAllMocks();
});

describe('buildWebChatLeadIdentity (5a.4)', () => {
  it('deriva identifier web:${sessionId} na org canonical da Iza', () => {
    expect(buildWebChatLeadIdentity('sess-123')).toEqual({
      identifier: 'web:sess-123',
      organizationId: IZA_ORG,
    });
  });

  it('faz fallback pra "anon" quando sessionId é vazio', () => {
    expect(buildWebChatLeadIdentity('').identifier).toBe('web:anon');
  });

  it('trunca sessionId longo em 64 chars', () => {
    const long = 'x'.repeat(200);
    const { identifier } = buildWebChatLeadIdentity(long);
    // 'web:' (4) + 64
    expect(identifier).toBe(`web:${'x'.repeat(64)}`);
  });
});

describe('ensureWebChatLead — idempotência (5a.4)', () => {
  it('cria Contact (leadStatus NEW, funnelStage new, source=webchat) + Conversation web na 1a chamada', async () => {
    const res = await ensureWebChatLead('sess-abc');
    expect(res.contactId).toBe('contact_1');
    expect(res.conversationId).toBe('conv_1');

    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      whatsappId: 'web:sess-abc',
      organizationId: IZA_ORG,
      leadStatus: 'NEW',
      funnelStage: 'new',
    });
    expect(contacts[0].customFields).toMatchObject({ source: 'webchat', sessionId: 'sess-abc' });

    expect(conversations).toHaveLength(1);
    expect(conversations[0]).toMatchObject({ channel: 'web', status: 'OPEN' });
  });

  it('NÃO duplica contato nem conversa quando a mesma sessão chama várias vezes', async () => {
    const a = await ensureWebChatLead('sess-repeat');
    const b = await ensureWebChatLead('sess-repeat');
    const c = await ensureWebChatLead('sess-repeat');

    // Mesmos ids nas 3 chamadas.
    expect(a).toEqual(b);
    expect(b).toEqual(c);

    // Exatamente 1 contato e 1 conversa persistidos.
    expect(contacts).toHaveLength(1);
    expect(conversations).toHaveLength(1);

    // conversation.create só foi chamado 1x (as chamadas seguintes acharam a aberta).
    const { prisma } = (await import('@zappiq/database')) as any;
    expect(prisma.conversation.create).toHaveBeenCalledTimes(1);
    expect(prisma.contact.upsert).toHaveBeenCalledTimes(3);
  });

  it('sessões diferentes geram contatos e conversas distintos', async () => {
    const a = await ensureWebChatLead('sess-1');
    const b = await ensureWebChatLead('sess-2');

    expect(a.contactId).not.toBe(b.contactId);
    expect(a.conversationId).not.toBe(b.conversationId);
    expect(contacts).toHaveLength(2);
    expect(conversations).toHaveLength(2);
  });
});
