/* ══════════════════════════════════════════════════════════════════════
 * transbordoHumano: a IA para e uma pessoa da equipe assume.
 * --------------------------------------------------------------------
 * Tarefa C1b (Passo 2 e Passo 3), achados A167, A193, A158 e A169.
 *
 * Até aqui o transbordo pausava a IA só no cache, por 3.600 segundos, e
 * deixava a conversa em WAITING, que o guarda durável do orquestrador não
 * considera. Passada 1 hora sem ninguém da equipe, a próxima mensagem de
 * quem pediu uma pessoa voltava a ser respondida pela IA, que nem sabia que
 * tinha prometido um humano. O chat do site nem isso tinha: a tag de
 * transbordo era jogada fora.
 *
 * Agora a pausa mora no banco (conversation.aiPaused), com o espelho no
 * cache pelo mesmo prazo das outras pausas humanas (7 dias). A IA só volta
 * quando alguém da equipe devolver a conversa pelo Inbox: o botão
 * "Retomar <agente>" (PUT /api/conversations/:id/resume-ai) ou desatribuir
 * a conversa (PUT /assign sem responsável). Os dois limpam aiPaused e o
 * espelho, e já existiam.
 *
 * Este módulo NÃO manda mensagem ao cliente: quem chama decide o quê e por
 * onde (o orquestrador manda a mensagem de espera pelo canal da conversa; o
 * chat do site devolve a resposta no próprio POST do widget). Ele também
 * não importa o orquestrador, para o chat do site poder usar o MESMO
 * transbordo sem carregar a fila, o WhatsApp e o motor de fluxos.
 *
 * Fail-soft por etapa: um transbordo roda justamente quando algo pede
 * gente, e uma falha de banco não pode virar silêncio para o cliente.
 * ══════════════════════════════════════════════════════════════════════ */

import type { Server as SocketIOServer } from 'socket.io';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { cache } from './cloud/index.js';
import { getIo } from '../utils/socketRegistry.js';
import { aiPauseCacheKey, AI_PAUSE_TTL_SECONDS } from '../routes/conversations.handoff.js';

/** Valor do espelho de pausa no cache quando a IA pediu uma pessoa. */
export const VALOR_DA_PAUSA_DE_TRANSBORDO = 'handoff';

/** A mensagem de espera de sempre, quando o dono não configurou a dele. */
export const TEXTO_DE_ESPERA_PADRAO =
  'Vou te conectar com um de nossos especialistas agora. Em instantes você será atendido! 😊';

/** A mensagem de espera da organização (settings.handoffMessage) ou a padrão. */
export function mensagemDeEspera(orgSettings: Record<string, any> | null | undefined): string {
  const configurada = typeof orgSettings?.handoffMessage === 'string' ? orgSettings.handoffMessage.trim() : '';
  return configurada || TEXTO_DE_ESPERA_PADRAO;
}

export interface TransbordoInput {
  organizationId: string;
  conversationId: string;
  contactId: string;
  /**
   * Identificador do contato na chave de pausa do cache: o telefone no
   * WhatsApp, `ig:<id>` no Instagram, `web:<sessão>` no chat do site. É a
   * mesma chave que o Inbox limpa ao devolver a conversa.
   */
  contactPhone: string;
  /** Como a notificação chama o cliente. Padrão: "Cliente <contactPhone>". */
  rotuloDoCliente?: string;
  io?: SocketIOServer;
}

export interface ResultadoDoTransbordo {
  /** A conversa ficou pausada no banco (aiPaused) e em WAITING. */
  pausou: boolean;
  /** A equipe recebeu a notificação em tempo real. */
  avisou: boolean;
}

/**
 * Pausa a IA de verdade, marca a conversa como aguardando uma pessoa e
 * avisa a equipe. Não manda nada ao cliente.
 */
export async function marcarTransbordo(input: TransbordoInput): Promise<ResultadoDoTransbordo> {
  const { organizationId, conversationId, contactId, contactPhone } = input;
  const resultado: ResultadoDoTransbordo = { pausou: false, avisou: false };

  logger.info('[Transbordo] a IA pediu uma pessoa', { organizationId, conversationId });

  // Espelho no cache: o caminho rápido que o orquestrador e o agendador de
  // fluxos consultam. Mesmo prazo das pausas humanas; quem manda é o banco.
  try {
    await cache.set(
      aiPauseCacheKey(organizationId, contactPhone),
      VALOR_DA_PAUSA_DE_TRANSBORDO,
      AI_PAUSE_TTL_SECONDS,
    );
  } catch (err) {
    logger.warn('[Transbordo] espelho da pausa no cache falhou (o banco segue valendo)', {
      organizationId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // A pausa durável. Mesmo recorte de antes (as conversas abertas do
  // contato), agora com aiPaused: o guarda durável do orquestrador passa a
  // enxergar o transbordo, e o Inbox mostra o botão de devolver à IA.
  try {
    await prisma.conversation.updateMany({
      where: { contactId, organizationId, status: { in: ['OPEN', 'ASSIGNED'] } },
      data: { status: 'WAITING', aiPaused: true },
    });
    resultado.pausou = true;
  } catch (err) {
    logger.error('[Transbordo] não consegui pausar a conversa no banco', {
      organizationId,
      conversationId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  const io = input.io ?? getIo();
  if (io) {
    try {
      io.to(`org:${organizationId}`).emit('notification', {
        type: 'warning',
        title: 'Transbordo solicitado',
        message: `${input.rotuloDoCliente ?? `Cliente ${contactPhone}`} precisa de atendimento humano`,
        conversationId,
      });
      resultado.avisou = true;
    } catch (err) {
      logger.warn('[Transbordo] notificação à equipe falhou', {
        organizationId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return resultado;
}
