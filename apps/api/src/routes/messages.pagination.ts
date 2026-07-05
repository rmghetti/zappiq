import { z } from 'zod';
import type { Prisma } from '@zappiq/database';

/* ═══════════════════════════════════════════════════════════════════════
 * W2.3 — paginação de mensagens (janela deslizante das MAIS RECENTES)
 * --------------------------------------------------------------------
 * Bug original: `orderBy asc + take limit` retornava as N mensagens MAIS
 * ANTIGAS. Em conversas com >100 msgs, a UI abria mostrando o começo do
 * histórico e nunca as mensagens recentes.
 *
 * Correção: consultar `orderBy desc + take limit` (pega as MAIS RECENTES)
 * e REVERTER o array no retorno, de forma que o payload continue em ordem
 * cronológica ascendente (contrato que o front espera para renderizar de
 * cima pra baixo).
 *
 * "Carregar anteriores": front envia `?before=<messageId>` (o id da msg
 * mais antiga que já tem em tela). A API usa cursor keyset — busca as
 * `limit` mensagens imediatamente ANTERIORES a esse cursor, ainda em desc,
 * e reverte. Sem `before`, retorna a janela mais recente.
 * ═══════════════════════════════════════════════════════════════════════ */

export const messagesQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  // Cursor keyset opcional: id da mensagem mais antiga já carregada.
  // Quando presente, retorna a página IMEDIATAMENTE anterior a ela.
  before: z.string().min(1).optional(),
});

export type MessagesQuery = z.infer<typeof messagesQuerySchema>;

/**
 * Monta os argumentos do `findMany` do Prisma para a janela pedida.
 * Sempre ordena por `createdAt desc` (+ `id desc` como desempate estável)
 * e usa cursor keyset quando `before` está presente.
 */
export function buildMessagesFindArgs(
  conversationId: string,
  query: MessagesQuery,
): Prisma.MessageFindManyArgs {
  const args: Prisma.MessageFindManyArgs = {
    where: { conversationId },
    take: query.limit,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
    },
  };

  if (query.before) {
    // cursor aponta para a msg já carregada; `skip: 1` a exclui do resultado.
    args.cursor = { id: query.before };
    args.skip = 1;
  }

  return args;
}

/**
 * A query devolve as mensagens em ordem DESC (mais recentes primeiro).
 * O contrato do payload é ASC (cronológico), então revertemos.
 * `hasMore` = ainda existem mensagens mais antigas antes desta janela.
 */
export function buildMessagesPayload<T extends { id: string }>(
  rowsDesc: T[],
  query: MessagesQuery,
): { data: T[]; nextBefore: string | null; hasMore: boolean } {
  // Cópia revertida → ordem cronológica ascendente.
  const data = [...rowsDesc].reverse();

  // Se veio a página cheia, provavelmente há mais histórico para trás.
  const hasMore = rowsDesc.length === query.limit;

  // Cursor para o próximo "carregar anteriores" = msg mais antiga da janela
  // atual (primeiro elemento em ordem ASC / último em DESC).
  const nextBefore = data.length > 0 ? data[0]!.id : null;

  return { data, nextBefore, hasMore };
}
