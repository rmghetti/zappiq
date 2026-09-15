/* ══════════════════════════════════════════════════════════════════════
 * webChatVisitante: o que o widget do chat do site lê do servidor.
 * --------------------------------------------------------------------
 * Tarefa C1b (Passos 3 e 4). Três leituras públicas, por organização, que
 * o script colado no site do cliente faz sem login:
 *
 *   1. as mensagens que a EQUIPE escreveu para a sessão do visitante
 *      (Passo 3, A158): se ele saiu antes da resposta humana, ela aparece
 *      quando ele voltar;
 *   2. o nome e a saudação do widget, do Treinar IA (Passo 4, A247);
 *   3. as origens em que o widget pode rodar, de settings (Passo 4, A241).
 *
 * Tudo aqui é leve e com cache curto: o script roda em toda página do site
 * do cliente. Nada devolve dado que o visitante não tenha acesso de outro
 * jeito: a sessão é o segredo que o próprio navegador dele guarda.
 *
 * `deps` injetado (padrão agentProvisioningService): testável sem banco.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';

/** Quantas mensagens da equipe o widget recebe de uma vez. */
export const MAX_MENSAGENS_DA_EQUIPE = 50;

export interface MensagemDaEquipe {
  id: string;
  content: string;
  createdAt: string;
}

export interface VisitanteDb {
  contact: { findUnique: (args: any) => Promise<{ id: string } | null> };
  message: { findMany: (args: any) => Promise<Array<{ id: string; content: string | null; createdAt: Date }>> };
}

function dbPadrao(): VisitanteDb {
  return prisma as unknown as VisitanteDb;
}

/**
 * As mensagens que alguém da equipe escreveu para esta sessão, da mais
 * antiga para a mais recente. Só OUTBOUND humana (isFromBot false): as
 * respostas da IA o widget já recebeu no próprio POST.
 *
 * Fail-soft: banco fora devolve lista vazia (o widget tenta de novo depois).
 */
export async function mensagensDaEquipe(
  organizationId: string,
  sessionId: string,
  db: VisitanteDb = dbPadrao(),
): Promise<MensagemDaEquipe[]> {
  try {
    const contato = await db.contact.findUnique({
      where: { whatsappId_organizationId: { whatsappId: `web:${sessionId}`, organizationId } },
      select: { id: true },
    });
    if (!contato) return [];
    const linhas = await db.message.findMany({
      where: {
        direction: 'OUTBOUND',
        isFromBot: false,
        conversation: { contactId: contato.id, organizationId, channel: 'web' },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_MENSAGENS_DA_EQUIPE,
      select: { id: true, content: true, createdAt: true },
    });
    return linhas
      .reverse()
      .filter((m) => typeof m.content === 'string' && m.content.trim())
      .map((m) => ({ id: m.id, content: String(m.content), createdAt: new Date(m.createdAt).toISOString() }));
  } catch (err) {
    logger.warn('[webChat] mensagens da equipe indisponíveis', {
      organizationId,
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
