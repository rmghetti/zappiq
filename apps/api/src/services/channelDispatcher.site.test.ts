/* ══════════════════════════════════════════════════════════════════════
 * channelDispatcher: o canal 'site' (C1b, Passo 3, A158 e A169).
 * --------------------------------------------------------------------
 * O despachante só conhecia Instagram e WhatsApp. Uma conversa do chat do
 * site (channel 'web', contato `web:<sessão>`) caía no ramo do WhatsApp, e
 * a resposta humana do Inbox ia para a Cloud API com um destino que não é
 * telefone: o visitante nunca via nada.
 *
 * Agora o canal site entrega pelo socket.io, na sala da sessão do
 * visitante (o adaptador Redis faz o emit cruzar as máquinas), e NUNCA
 * toca o WhatsApp. Quem grava a mensagem é quem chama (o Inbox grava na
 * mesma transação; o agente grava em deliverAgentReply), como nos outros
 * canais: o despachante não grava duas vezes.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirstMock = vi.fn();
const waSendText = vi.fn();
const waSendButtons = vi.fn();
const waSendTemplate = vi.fn();
const waMarkAsRead = vi.fn();
const igSendText = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    conversation: { findFirst: (...a: any[]) => findFirstMock(...a) },
    organization: { findUnique: vi.fn().mockResolvedValue({}) },
  },
}));
vi.mock('./whatsappService.js', () => ({
  sendText: (...a: any[]) => waSendText(...a),
  sendButtons: (...a: any[]) => waSendButtons(...a),
  sendTemplate: (...a: any[]) => waSendTemplate(...a),
  markAsRead: (...a: any[]) => waMarkAsRead(...a),
}));
vi.mock('./instagramService.js', () => ({ sendText: (...a: any[]) => igSendText(...a) }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const emit = vi.fn();
const to = vi.fn(() => ({ emit }));
const of = vi.fn(() => ({ to }));
let ioAtual: any = { of };
vi.mock('../utils/socketRegistry.js', () => ({ getIo: () => ioAtual }));

const { sendReplyText, sendReplyInteractive, sendReplyTemplate, markIncomingAsRead } = await import(
  './channelDispatcher.js'
);
const { NAMESPACE_DO_CHAT_DO_SITE, EVENTO_MENSAGEM_DA_EQUIPE, salaDoVisitante } = await import('./webChatSala.js');

const CONVERSA_DO_SITE = { channel: 'web', contact: { whatsappId: 'web:sessao-123', phone: 'web:sessao-123' } };

beforeEach(() => {
  vi.clearAllMocks();
  ioAtual = { of };
  findFirstMock.mockResolvedValue(CONVERSA_DO_SITE);
});

describe('canal site no despachante', () => {
  it('texto numa conversa do site: nunca vai ao WhatsApp e é emitido na sala da sessão do visitante', async () => {
    const r = await sendReplyText({
      organizationId: 'org-1',
      conversationId: 'conv-web',
      content: 'Oi! Aqui é a Ana, da equipe.',
      messageId: 'msg-9',
    });

    expect(waSendText).not.toHaveBeenCalled();
    expect(igSendText).not.toHaveBeenCalled();
    expect(of).toHaveBeenCalledWith(NAMESPACE_DO_CHAT_DO_SITE);
    expect(to).toHaveBeenCalledWith(salaDoVisitante('org-1', 'sessao-123'));
    expect(emit).toHaveBeenCalledWith(
      EVENTO_MENSAGEM_DA_EQUIPE,
      expect.objectContaining({ id: 'msg-9', content: 'Oi! Aqui é a Ana, da equipe.' }),
    );
    expect(r).toEqual({ channel: 'site' });
  });

  it('a busca da conversa continua travada pela organização', async () => {
    await sendReplyText({ organizationId: 'org-1', conversationId: 'conv-web', content: 'x' });
    expect(findFirstMock.mock.calls[0][0].where).toEqual({ id: 'conv-web', organizationId: 'org-1' });
  });

  it('sem socket no processo (worker), não lança: a mensagem já está gravada e aparece quando o visitante voltar', async () => {
    ioAtual = undefined;
    await expect(
      sendReplyText({ organizationId: 'org-1', conversationId: 'conv-web', content: 'x' }),
    ).resolves.toEqual({ channel: 'site' });
    expect(waSendText).not.toHaveBeenCalled();
  });

  it('conversa do site sem sessão reconhecível: erro claro, e nada vai ao WhatsApp', async () => {
    findFirstMock.mockResolvedValue({ channel: 'web', contact: { whatsappId: '5511999999999', phone: '5511999999999' } });
    await expect(
      sendReplyText({ organizationId: 'org-1', conversationId: 'conv-web', content: 'x' }),
    ).rejects.toThrow(/sessão/);
    expect(waSendText).not.toHaveBeenCalled();
  });

  it('botões no site viram texto numerado, pelo mesmo canal', async () => {
    await sendReplyInteractive({
      organizationId: 'org-1',
      conversationId: 'conv-web',
      kind: 'button',
      body: 'Qual você prefere?',
      options: [
        { id: 'a', title: 'Ver planos' },
        { id: 'b', title: 'Falar com alguém' },
      ],
    });
    expect(waSendButtons).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      EVENTO_MENSAGEM_DA_EQUIPE,
      expect.objectContaining({ content: 'Qual você prefere?\n1. Ver planos\n2. Falar com alguém' }),
    );
  });

  it('template da Meta não existe no site: erro claro, sem tocar o WhatsApp', async () => {
    await expect(
      sendReplyTemplate({ organizationId: 'org-1', conversationId: 'conv-web', templateName: 't', languageCode: 'pt_BR' }),
    ).rejects.toThrow(/WhatsApp/);
    expect(waSendTemplate).not.toHaveBeenCalled();
  });

  it('marcar como lida no site não chama o WhatsApp', async () => {
    findFirstMock.mockResolvedValue({ channel: 'web', contact: { instagramScopedId: null } });
    await markIncomingAsRead({ organizationId: 'org-1', conversationId: 'conv-web', externalMessageId: 'x' });
    expect(waMarkAsRead).not.toHaveBeenCalled();
  });

  it('WhatsApp segue igual (regressão)', async () => {
    findFirstMock.mockResolvedValue({ channel: 'whatsapp', contact: { whatsappId: '5511999999999', phone: '5511999999999' } });
    waSendText.mockResolvedValue({ messages: [{ id: 'wamid-1' }] });
    const r = await sendReplyText({ organizationId: 'org-1', conversationId: 'conv-wa', content: 'oi' });
    expect(waSendText).toHaveBeenCalledTimes(1);
    expect(emit).not.toHaveBeenCalled();
    expect(r).toEqual({ channel: 'whatsapp', externalMessageId: 'wamid-1' });
  });
});
