/**
 * ISOLAMENTO DE TENANT no sendReplyText.
 *
 * Achado na auditoria (18/07/2026): `POST /api/impulso/pix` aceita
 * `conversationId` do body do cliente e o passa a `sendReplyText`, que ANTES
 * fazia `conversation.findUnique({ where: { id } })` SEM filtro de org. Cliente
 * A referenciava a conversa do cliente B → o dispatcher lia o contato do B e
 * tentava enviar pelas credenciais do A. Em produção a RLS não filtra pra API
 * (conecta como postgres), então este filtro na aplicação é a barreira.
 *
 * O fix: `findFirst({ where: { id, organizationId } })`. Conversa de outra org
 * → null → throw (nenhum envio). Estes testes travam isso.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirstMock = vi.fn();
const waSendMock = vi.fn();
const igSendMock = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    conversation: { findFirst: findFirstMock },
    organization: {
      findUnique: vi.fn().mockResolvedValue({
        whatsappPhoneNumberId: 'pn_A',
        whatsappAccessToken: 'tok_A',
        instagramAccountId: 'ig_A',
        instagramAccessToken: 'igtok_A',
      }),
    },
  },
}));

vi.mock('./whatsappService.js', () => ({ sendText: waSendMock }));
vi.mock('./instagramService.js', () => ({ sendText: igSendMock }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { sendReplyText } = await import('./channelDispatcher.js');

beforeEach(() => {
  vi.clearAllMocks();
  waSendMock.mockResolvedValue({ messages: [{ id: 'wamid_1' }] });
  igSendMock.mockResolvedValue({ message_id: 'igmid_1' });
});

describe('sendReplyText — isolamento de tenant', () => {
  it('a query trava por organizationId, não só por id', async () => {
    // findFirst retorna null = conversa não é da org (ou não existe).
    findFirstMock.mockResolvedValue(null);
    await expect(
      sendReplyText({ organizationId: 'orgA', conversationId: 'conv_de_orgB', content: 'x' }),
    ).rejects.toThrow(/not found/);

    // A prova que importa: o where levou organizationId junto com o id.
    const where = findFirstMock.mock.calls[0][0].where;
    expect(where.id).toBe('conv_de_orgB');
    expect(where.organizationId).toBe('orgA');
  });

  it('conversa de OUTRA org NÃO dispara envio nenhum (nem WA nem IG)', async () => {
    // O cenário do bug do Pix: A referencia conversa do B. findFirst com a org
    // do A não acha a conversa do B → null → throw ANTES de qualquer envio.
    findFirstMock.mockResolvedValue(null);
    await expect(
      sendReplyText({ organizationId: 'orgA', conversationId: 'conv_de_orgB', content: 'cobrança' }),
    ).rejects.toThrow();
    expect(waSendMock).not.toHaveBeenCalled();
    expect(igSendMock).not.toHaveBeenCalled();
  });

  it('conversa DA PRÓPRIA org envia normalmente (não quebrei o caminho legítimo)', async () => {
    findFirstMock.mockResolvedValue({
      channel: 'whatsapp',
      contact: { whatsappId: '5511999999999', instagramScopedId: null, phone: '5511999999999' },
    });
    const r = await sendReplyText({ organizationId: 'orgA', conversationId: 'conv_de_orgA', content: 'oi' });
    expect(r.channel).toBe('whatsapp');
    expect(waSendMock).toHaveBeenCalledTimes(1);
  });
});
