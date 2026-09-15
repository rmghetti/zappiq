/* ══════════════════════════════════════════════════════════════════════
 * alertasDeSaida: o que o pós-processador de saída avisou, com rastro.
 * --------------------------------------------------------------------
 * Tarefa C1b (Passo 1, A189). Quando a guarda de marca segura uma
 * resposta, o alerta vai para dois lugares:
 *   1. o log do contêiner (logger.warn), para quem está olhando agora;
 *   2. a tabela prefilter_events, com a categoria 'guarda-de-marca', que o
 *      Raio-X do prompt (/api/admin/ai-xray) lê e mostra por organização.
 *
 * prefilter_events já é o registro das travas determinísticas (crise e
 * compliance, PR #374), com RLS ligada e sem o texto da mensagem. A guarda
 * de marca é a trava da saída, e segue a mesma regra de LGPD: o evento
 * guarda o termo que vazou, o canal e o que foi feito, nunca a resposta.
 *
 * Fail-soft em tudo: este registro roda no meio do turno do cliente final.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { PREFIXO_ALERTA_DE_MARCA, type CanalDaSaida } from '../agents/postProcessReply.js';

/** Categoria do evento em prefilter_events. O Raio-X filtra por ela. */
export const CATEGORIA_GUARDA_DE_MARCA = 'guarda-de-marca';

export interface EventoDeSaida {
  organizationId: string;
  conversationId: string | null;
  canal: string;
  categoria: string;
  regra: string;
  /** 'resposta_segura' = o texto foi trocado; 'alerta' = só registrado (Qualidade). */
  acao: 'resposta_segura' | 'alerta';
}

export interface DependenciasDoRegistro {
  criarEvento?: (evento: EventoDeSaida) => Promise<unknown>;
}

async function criarEventoPadrao(evento: EventoDeSaida): Promise<unknown> {
  return prisma.prefilterEvent.create({ data: evento, select: { id: true } });
}

export interface AlertasDoTurno {
  organizationId: string;
  conversationId: string | null;
  canal: CanalDaSaida;
  alertas: string[];
  /** A guarda trocou o texto? (postProcessReply().bloqueada) */
  bloqueada: boolean;
}

/**
 * Registra os alertas do pós-processador. Sem alerta, não faz nada.
 * Nunca lança.
 */
export async function registrarAlertasDeSaida(
  turno: AlertasDoTurno,
  deps: DependenciasDoRegistro = {},
): Promise<void> {
  if (!turno.alertas.length) return;
  const criarEvento = deps.criarEvento ?? criarEventoPadrao;

  logger.warn('[Saída] guarda de marca disparou', {
    organizationId: turno.organizationId,
    conversationId: turno.conversationId,
    canal: turno.canal,
    alertas: turno.alertas,
    respostaTrocada: turno.bloqueada,
  });

  for (const alerta of turno.alertas) {
    if (!alerta.startsWith(PREFIXO_ALERTA_DE_MARCA)) continue;
    try {
      await criarEvento({
        organizationId: turno.organizationId,
        conversationId: turno.conversationId,
        canal: turno.canal,
        categoria: CATEGORIA_GUARDA_DE_MARCA,
        regra: alerta.slice(PREFIXO_ALERTA_DE_MARCA.length),
        acao: turno.bloqueada ? 'resposta_segura' : 'alerta',
      });
    } catch (err) {
      logger.error('[Saída] registro do alerta falhou (fail-soft)', {
        organizationId: turno.organizationId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
