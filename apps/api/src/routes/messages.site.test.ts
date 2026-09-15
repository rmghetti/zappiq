/* ══════════════════════════════════════════════════════════════════════
 * Inbox respondendo uma conversa do chat do site (C1b, Passo 3, A158).
 * --------------------------------------------------------------------
 * Antes: o POST do Inbox gravava a mensagem, pausava a IA e enfileirava o
 * envio para `contact.whatsappId`. Na conversa do site esse id é
 * `web:<sessão>`, e o despachante mandava para o WhatsApp como se fosse
 * telefone. O visitante nunca via a resposta humana.
 *
 * Agora: na conversa do site, a fila do WhatsApp não é tocada. A mensagem
 * continua gravada (mesma transação de sempre) e sai pelo canal 'site' do
 * despachante, que emite no socket da sessão do visitante.
 *
 * Dublês só nas pontas: banco, fila, WhatsApp e socket. O despachante é o
 * de verdade.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const txConversationFindFirst = vi.fn();
const txMessageCreate = vi.fn();
const txConversationUpdate = vi.fn();
const dispatcherConversationFindFirst = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    conversation: { findFirst: (...a: any[]) => dispatcherConversationFindFirst(...a) },
    organization: { findUnique: vi.fn(async () => ({})) },
  },
}));
vi.mock('../middleware/rlsTenant.js', () => ({
  withTenant: async (_req: any, fn: (tx: any) => any) =>
    fn({
      conversation: {
        findFirst: (...a: any[]) => txConversationFindFirst(...a),
        update: (...a: any[]) => txConversationUpdate(...a),
      },
      message: { create: (...a: any[]) => txMessageCreate(...a) },
    }),
}));
const queueAdd = vi.fn();
vi.mock('../services/queueService.js', () => ({ messageSendQueue: { add: (...a: any[]) => queueAdd(...a) } }));
vi.mock('../services/cloud/index.js', () => ({
  cache: { set: vi.fn(async () => true), del: vi.fn(async () => true), get: vi.fn(async () => null) },
}));
const waSendText = vi.fn();
vi.mock('../services/whatsappService.js', () => ({ sendText: (...a: any[]) => waSendText(...a) }));
vi.mock('../services/instagramService.js', () => ({ sendText: vi.fn() }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// O socket do processo: o despachante emite na sala do visitante por aqui.
const emitVisitante = vi.fn();
const toVisitante = vi.fn(() => ({ emit: emitVisitante }));
const emitOrg = vi.fn();
const ioFalso = {
  of: vi.fn(() => ({ to: toVisitante })),
  to: vi.fn(() => ({ emit: emitOrg })),
};
vi.mock('../utils/socketRegistry.js', () => ({ getIo: () => ioFalso }));

const { default: router } = await import('./messages.js');
const { NAMESPACE_DO_CHAT_DO_SITE, EVENTO_MENSAGEM_DA_EQUIPE, salaDoVisitante } = await import(
  '../services/webChatSala.js'
);

type Camada = { route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: any }> } };
function handlerDoPost() {
  const stack = (router as unknown as { stack: Camada[] }).stack;
  const camada = stack.find((l) => l.route?.path === '/:id/messages' && !!l.route?.methods?.post);
  const rs = camada!.route!.stack;
  return rs[rs.length - 1].handle as (req: any, res: any, next: any) => Promise<void>;
}

function fazerRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn((b: any) => {
    res.body = b;
    return res;
  });
  return res;
}

function pedido(conversationId: string) {
  return {
    params: { id: conversationId },
    body: { content: 'Oi! Aqui é a Ana, da equipe. Já vou te ajudar.' },
    organizationId: 'org-1',
    user: { userId: 'user-ana', organizationId: 'org-1' },
    app: { get: (k: string) => (k === 'io' ? ioFalso : undefined) },
  };
}

const MENSAGEM_GRAVADA = {
  id: 'msg-humana-1',
  content: 'Oi! Aqui é a Ana, da equipe. Já vou te ajudar.',
  direction: 'OUTBOUND',
  type: 'TEXT',
  createdAt: new Date('2026-09-14T15:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  txMessageCreate.mockResolvedValue(MENSAGEM_GRAVADA);
  txConversationUpdate.mockResolvedValue({});
});

describe('Inbox numa conversa do chat do site', () => {
  beforeEach(() => {
    const conversa = {
      id: 'conv-web',
      organizationId: 'org-1',
      channel: 'web',
      contact: { whatsappId: 'web:sessao-123', phone: 'web:sessao-123' },
    };
    txConversationFindFirst.mockResolvedValue(conversa);
    dispatcherConversationFindFirst.mockResolvedValue({ channel: 'web', contact: conversa.contact });
  });

  it('não vai para a fila do WhatsApp nem para a Cloud API, e é emitida na sala do visitante', async () => {
    const res = fazerRes();
    await handlerDoPost()(pedido('conv-web'), res, (e: any) => {
      throw e;
    });

    expect(res.statusCode).toBe(201);
    expect(queueAdd).not.toHaveBeenCalled();
    expect(waSendText).not.toHaveBeenCalled();
    expect(ioFalso.of).toHaveBeenCalledWith(NAMESPACE_DO_CHAT_DO_SITE);
    expect(toVisitante).toHaveBeenCalledWith(salaDoVisitante('org-1', 'sessao-123'));
    expect(emitVisitante).toHaveBeenCalledWith(
      EVENTO_MENSAGEM_DA_EQUIPE,
      expect.objectContaining({ id: 'msg-humana-1', content: MENSAGEM_GRAVADA.content }),
    );
  });

  it('continua gravando a mensagem e pausando a IA na mesma transação (o visitante que voltar depois a encontra)', async () => {
    await handlerDoPost()(pedido('conv-web'), fazerRes(), () => undefined);

    expect(txMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        direction: 'OUTBOUND',
        conversationId: 'conv-web',
        senderId: 'user-ana',
        isFromBot: false,
      }),
    });
    expect(txConversationUpdate).toHaveBeenCalledWith({
      where: { id: 'conv-web' },
      data: { assignedToId: 'user-ana', status: 'ASSIGNED', aiPaused: true },
    });
    // O Inbox da equipe também recebe em tempo real, como sempre.
    expect(emitOrg).toHaveBeenCalledWith('new_message', expect.objectContaining({ conversationId: 'conv-web' }));
  });

  it('socket fora do ar não derruba a resposta da equipe: a mensagem está gravada (201)', async () => {
    toVisitante.mockImplementationOnce(() => {
      throw new Error('socket caiu');
    });
    const res = fazerRes();
    await handlerDoPost()(pedido('conv-web'), res, (e: any) => {
      throw e;
    });
    expect(res.statusCode).toBe(201);
    expect(queueAdd).not.toHaveBeenCalled();
  });
});

describe('Inbox numa conversa de WhatsApp (regressão)', () => {
  it('segue pela fila de envio, com o telefone do contato', async () => {
    txConversationFindFirst.mockResolvedValue({
      id: 'conv-wa',
      organizationId: 'org-1',
      channel: 'whatsapp',
      contact: { whatsappId: '5511999999999', phone: '5511999999999' },
    });

    await handlerDoPost()(pedido('conv-wa'), fazerRes(), () => undefined);

    expect(queueAdd).toHaveBeenCalledWith('send', {
      messageId: 'msg-humana-1',
      conversationId: 'conv-wa',
      content: MENSAGEM_GRAVADA.content,
      to: '5511999999999',
    });
    expect(ioFalso.of).not.toHaveBeenCalled();
  });
});
