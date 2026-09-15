/* ══════════════════════════════════════════════════════════════════════
 * webChatVisitante: leituras públicas do widget (C1b, Passos 3 e 4).
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { mensagensDaEquipe, MAX_MENSAGENS_DA_EQUIPE } = await import('./webChatVisitante.js');

const contactFindUnique = vi.fn();
const messageFindMany = vi.fn();
const db = {
  contact: { findUnique: (...a: any[]) => contactFindUnique(...a) },
  message: { findMany: (...a: any[]) => messageFindMany(...a) },
} as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('mensagensDaEquipe (Passo 3: o visitante que voltou vê a resposta humana)', () => {
  it('procura o contato da sessão NA organização e lê só a resposta humana do canal web', async () => {
    contactFindUnique.mockResolvedValue({ id: 'contato-1' });
    messageFindMany.mockResolvedValue([
      { id: 'm2', content: 'Pode me mandar seu e-mail?', createdAt: new Date('2026-09-14T15:02:00Z') },
      { id: 'm1', content: 'Oi! Aqui é a Ana.', createdAt: new Date('2026-09-14T15:01:00Z') },
    ]);

    const lista = await mensagensDaEquipe('org-1', 'sessao-1', db);

    expect(contactFindUnique.mock.calls[0][0].where).toEqual({
      whatsappId_organizationId: { whatsappId: 'web:sessao-1', organizationId: 'org-1' },
    });
    expect(messageFindMany.mock.calls[0][0]).toMatchObject({
      where: {
        direction: 'OUTBOUND',
        isFromBot: false,
        conversation: { contactId: 'contato-1', organizationId: 'org-1', channel: 'web' },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_MENSAGENS_DA_EQUIPE,
    });
    // Da mais antiga para a mais recente, como o widget mostra.
    expect(lista).toEqual([
      { id: 'm1', content: 'Oi! Aqui é a Ana.', createdAt: '2026-09-14T15:01:00.000Z' },
      { id: 'm2', content: 'Pode me mandar seu e-mail?', createdAt: '2026-09-14T15:02:00.000Z' },
    ]);
  });

  it('sessão sem contato: lista vazia, sem consultar mensagens', async () => {
    contactFindUnique.mockResolvedValue(null);
    await expect(mensagensDaEquipe('org-1', 'sessao-x', db)).resolves.toEqual([]);
    expect(messageFindMany).not.toHaveBeenCalled();
  });

  it('banco fora: lista vazia, nunca lança', async () => {
    contactFindUnique.mockRejectedValue(new Error('db down'));
    await expect(mensagensDaEquipe('org-1', 'sessao-1', db)).resolves.toEqual([]);
  });
});
