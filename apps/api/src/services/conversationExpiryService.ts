/**
 * Expiração de conversa por inatividade (Resposta Meta out/2026).
 *
 * Regra: conversa OPEN ou WAITING sem NENHUMA mensagem nas últimas 72 horas
 * fecha sozinha com closeReason 'auto_72h'. ASSIGNED nunca fecha aqui: se um
 * humano assumiu, só ele (ou a rota manual) encerra. A reabertura pós-CLOSED
 * já é coberta pelo webhook, que cria conversa nova quando o contato volta.
 *
 * Por que 72h: é a borda temporal da unidade "atendimento de IA" do novo
 * modelo comercial (hoje em sombra). Sem o fechamento automático, uma conversa
 * eterna viraria um atendimento eterno.
 *
 * Performance: o filtro "sem mensagem na janela" vira NOT EXISTS por
 * (conversationId, createdAt) e resolve pelo índice composto
 * messages(conversationId, createdAt), criado junto com closeReason.
 * Processa em lotes de 500 para não segurar transação longa em tenant grande.
 */
import { prisma } from '@zappiq/database';

import { logger } from '../utils/logger.js';

/** Janela de inatividade que encerra a conversa. */
export const EXPIRY_HOURS = 72;

/** Tamanho do lote por iteração. */
const BATCH_SIZE = 500;

export interface ConversationExpiryResult {
  conversationsClosed: number;
  batches: number;
  durationMs: number;
}

export async function runConversationExpiryCycle(): Promise<ConversationExpiryResult> {
  const started = Date.now();
  const cutoff = new Date(started - EXPIRY_HOURS * 60 * 60 * 1000);

  let conversationsClosed = 0;
  let batches = 0;

  // Loop até esgotar: cada lote fechado sai do filtro na iteração seguinte
  // (status vira CLOSED), então não precisa de cursor.
  for (;;) {
    const lote = await prisma.conversation.findMany({
      where: {
        // ASSIGNED fica de fora por definição: humano no comando.
        status: { in: ['OPEN', 'WAITING'] },
        deletedAt: null,
        // Conversa recém-criada (ainda sem mensagem) não é conversa parada:
        // só entra no radar depois de existir há 72h.
        createdAt: { lt: cutoff },
        // Nenhuma mensagem na janela — NOT EXISTS pelo índice composto.
        messages: { none: { createdAt: { gte: cutoff } } },
      },
      select: { id: true },
      take: BATCH_SIZE,
    });
    if (lote.length === 0) break;

    // Recheca o status no UPDATE: se um humano assumiu (ASSIGNED) entre o
    // SELECT e o UPDATE, a conversa fica de fora da escrita também.
    const updated = await prisma.conversation.updateMany({
      where: {
        id: { in: lote.map((c) => c.id) },
        status: { in: ['OPEN', 'WAITING'] },
      },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closeReason: 'auto_72h',
      },
    });

    conversationsClosed += updated.count;
    batches += 1;

    // Último lote (menor que o take) ou corrida improvável em que nada foi
    // atualizado: encerra em vez de arriscar loop infinito.
    if (lote.length < BATCH_SIZE || updated.count === 0) break;
  }

  const durationMs = Date.now() - started;
  logger.info(
    `[ConversationExpiry] Ciclo concluído — fechadas=${conversationsClosed}, lotes=${batches}, ${durationMs}ms`,
  );

  return { conversationsClosed, batches, durationMs };
}
