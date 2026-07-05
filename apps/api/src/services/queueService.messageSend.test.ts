/**
 * queueService.messageSend.test.ts — W1.1 (audit fix)
 * ============================================================================
 * Cobre processMessageSendJob: o handler que substitui o antigo STUB do
 * message-send worker. Antes o worker marcava SENT sem enviar nada; agora
 * ele delega o envio real ao channelDispatcher.sendReplyText (mesmo caminho
 * da IA) e persiste status/externalMessageId de acordo com o resultado.
 *
 * Testa:
 *   - Sucesso (inbox humano): envia, grava whatsappMessageId, marca SENT.
 *   - Sucesso (Instagram): grava externalMessageId no campo certo.
 *   - Falha: marca FAILED com o erro e relança pra BullMQ fazer retry.
 *   - Nunca marca SENT às cegas quando o dispatcher lança.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock bullmq ANTES de importar queueService ───────────────────────────────
// queueService constrói `new Queue(...)` no top-level; sem esse mock o teste
// tentaria abrir conexão Redis real. Worker/Queue viram stubs inertes.
vi.mock('bullmq', () => ({
  Queue: class {
    add = vi.fn();
    addBulk = vi.fn();
    getJobCounts = vi.fn().mockResolvedValue({});
    getWaiting = vi.fn().mockResolvedValue([]);
    close = vi.fn();
  },
  Worker: class {
    on = vi.fn();
    close = vi.fn();
  },
  Job: class {},
}));

// ── Mock channelDispatcher (import dinâmico dentro do handler) ────────────────
const sendReplyText = vi.fn();
vi.mock('./channelDispatcher.js', () => ({
  sendReplyText: (...args: any[]) => sendReplyText(...args),
}));

// ── Mock @zappiq/database (import dinâmico dentro do handler) ─────────────────
const messageFindUnique = vi.fn();
const messageUpdate = vi.fn();
const messageCreate = vi.fn();
const conversationFindFirst = vi.fn();
const conversationCreate = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: {
    message: {
      findUnique: (...a: any[]) => messageFindUnique(...a),
      update: (...a: any[]) => messageUpdate(...a),
      create: (...a: any[]) => messageCreate(...a),
    },
    conversation: {
      findFirst: (...a: any[]) => conversationFindFirst(...a),
      create: (...a: any[]) => conversationCreate(...a),
    },
  },
}));

import { processMessageSendJob } from './queueService.js';

beforeEach(() => {
  vi.clearAllMocks();
  messageUpdate.mockResolvedValue({});
  messageCreate.mockResolvedValue({ id: 'msg-created' });
});

describe('processMessageSendJob — inbox humano (messageId)', () => {
  it('envia via dispatcher, grava whatsappMessageId e marca SENT no sucesso', async () => {
    messageFindUnique.mockResolvedValue({
      conversationId: 'conv-1',
      conversation: { organizationId: 'org-1' },
    });
    sendReplyText.mockResolvedValue({ channel: 'whatsapp', externalMessageId: 'wamid.ABC' });

    const res = await processMessageSendJob({
      messageId: 'msg-1',
      conversationId: 'conv-1',
      content: 'Olá do inbox',
      to: '5511999999999',
    });

    // Resolveu org/conversa a partir da mensagem
    expect(messageFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'msg-1' } }),
    );
    // Delegou o envio real ao dispatcher (mesmo caminho da IA)
    expect(sendReplyText).toHaveBeenCalledWith({
      organizationId: 'org-1',
      conversationId: 'conv-1',
      content: 'Olá do inbox',
    });
    // Persistiu SENT + externalMessageId no campo whatsapp
    expect(messageUpdate).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: { status: 'SENT', whatsappMessageId: 'wamid.ABC' },
    });
    expect(res).toEqual({ success: true, messageId: 'msg-1', externalMessageId: 'wamid.ABC' });
  });

  it('grava externalMessageId (não whatsappMessageId) quando o canal é instagram', async () => {
    messageFindUnique.mockResolvedValue({
      conversationId: 'conv-ig',
      conversation: { organizationId: 'org-1' },
    });
    sendReplyText.mockResolvedValue({ channel: 'instagram', externalMessageId: 'ig-mid-9' });

    await processMessageSendJob({ messageId: 'msg-ig', content: 'oi ig' });

    expect(messageUpdate).toHaveBeenCalledWith({
      where: { id: 'msg-ig' },
      data: { status: 'SENT', externalMessageId: 'ig-mid-9' },
    });
  });

  it('lança se a mensagem não existe (não marca SENT às cegas)', async () => {
    messageFindUnique.mockResolvedValue(null);

    await expect(
      processMessageSendJob({ messageId: 'ghost', content: 'x' }),
    ).rejects.toThrow(/not found/);
    expect(sendReplyText).not.toHaveBeenCalled();
    expect(messageUpdate).not.toHaveBeenCalled();
  });
});

describe('processMessageSendJob — falha de envio', () => {
  it('marca FAILED com o erro e relança pra BullMQ fazer retry', async () => {
    messageFindUnique.mockResolvedValue({
      conversationId: 'conv-1',
      conversation: { organizationId: 'org-1' },
    });
    sendReplyText.mockRejectedValue(new Error('WA token inválido'));

    await expect(
      processMessageSendJob({ messageId: 'msg-1', content: 'falha' }),
    ).rejects.toThrow('WA token inválido');

    // NUNCA marcou SENT
    const sentCalls = messageUpdate.mock.calls.filter(
      ([arg]: any[]) => arg?.data?.status === 'SENT',
    );
    expect(sentCalls).toHaveLength(0);

    // Marcou FAILED com a mensagem de erro
    expect(messageUpdate).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: { status: 'FAILED', metadata: { sendError: 'WA token inválido' } },
    });
  });
});

describe('processMessageSendJob — campanha (sem messageId)', () => {
  it('get-or-create conversa + cria message OUTBOUND e envia', async () => {
    conversationFindFirst.mockResolvedValue(null);
    conversationCreate.mockResolvedValue({ id: 'conv-new' });
    messageCreate.mockResolvedValue({ id: 'msg-camp' });
    sendReplyText.mockResolvedValue({ channel: 'whatsapp', externalMessageId: 'wamid.CAMP' });

    const res = await processMessageSendJob({
      campaignId: 'camp-1',
      contactId: 'contact-1',
      organizationId: 'org-1',
      content: 'promo',
      to: '5511888888888',
    });

    expect(conversationCreate).toHaveBeenCalled();
    expect(messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: 'OUTBOUND',
          conversationId: 'conv-new',
          metadata: { campaignId: 'camp-1' },
        }),
      }),
    );
    expect(sendReplyText).toHaveBeenCalledWith({
      organizationId: 'org-1',
      conversationId: 'conv-new',
      content: 'promo',
    });
    expect(messageUpdate).toHaveBeenCalledWith({
      where: { id: 'msg-camp' },
      data: { status: 'SENT', whatsappMessageId: 'wamid.CAMP' },
    });
    expect(res.externalMessageId).toBe('wamid.CAMP');
  });

  it('lança se job de campanha vier sem organizationId/contactId', async () => {
    await expect(
      processMessageSendJob({ campaignId: 'camp-1', content: 'x' }),
    ).rejects.toThrow(/organizationId\/contactId/);
    expect(sendReplyText).not.toHaveBeenCalled();
  });
});
