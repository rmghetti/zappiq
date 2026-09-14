/* ══════════════════════════════════════════════════════════════════════
 * Rede de crise e transbordo do pré-filtro (P62, A251, A232)
 * --------------------------------------------------------------------
 * A DETECÇÃO mora em blockedVerticalFilter.ts (pura, com corpus de
 * positivos e de negativos). Aqui mora o que se FAZ com ela:
 *
 *   1. acrescentar a linha de acolhimento à resposta do agente (nunca
 *      substituir a resposta por template);
 *   2. marcar a conversa como aguardando humano (aiPaused);
 *   3. avisar o dono com notificação persistente (tarefa no Planner, que
 *      é o mecanismo que já existe e que não rola para fora da tela);
 *   4. gravar o evento em prefilter_events, SEM o texto da mensagem.
 *
 * Tudo aqui é fail-soft. Esta camada roda no meio do turno do cliente
 * final: uma falha de banco não pode transformar um pedido de ajuda em
 * erro 500.
 *
 * LGPD: nem o evento nem a tarefa carregam o que a pessoa escreveu. O que
 * sai é o id da regra. O conteúdo continua onde sempre esteve, na
 * conversa, com o controle de acesso dela.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';
import {
  LINHA_DE_ACOLHIMENTO_CVV,
  LINHA_DE_TRANSBORDO_DE_CRISE,
} from './blockedVerticalFilter.js';

/** Onde o turno aconteceu. 'playground' é o Testar minha IA do dono. */
export type CanalDoTurno = 'whatsapp' | 'instagram' | 'site' | 'playground';

export type CategoriaDeEvento = 'crise' | 'compliance' | 'politica-comercial-zappiq';
export type AcaoDeEvento = 'acolhimento' | 'transbordo' | 'recusa';

export interface EventoDePrefiltro {
  organizationId: string;
  conversationId: string | null;
  canal: CanalDoTurno;
  categoria: CategoriaDeEvento;
  regra: string;
  acao: AcaoDeEvento;
}

/**
 * Acrescenta a linha de acolhimento ao que o agente respondeu.
 *
 * `comTransbordo` só é verdade onde o transbordo existe de fato (WhatsApp,
 * Instagram, chat do site). No Testar minha IA não existe fila de
 * atendimento, e prometer uma pessoa ali seria inventar recurso.
 */
export function acrescentarAcolhimento(
  resposta: string | null | undefined,
  opcoes: { comTransbordo: boolean },
): string {
  const base = String(resposta ?? '').trim();

  // Já tem a linha? Não empilha. O agente pode ter repetido o CVV sozinho
  // depois que a regra do CORE entrou em cena.
  const jaTemCvv = base.includes('188') && /cvv/i.test(base);

  const partes: string[] = [];
  if (base) partes.push(base);
  if (!jaTemCvv) partes.push(LINHA_DE_ACOLHIMENTO_CVV);
  if (opcoes.comTransbordo && !base.includes(LINHA_DE_TRANSBORDO_DE_CRISE)) {
    partes.push(LINHA_DE_TRANSBORDO_DE_CRISE);
  }

  return partes.join('\n\n');
}

/** O que esta camada toca fora dela. Injetável para o teste. */
export interface DependenciasDaRede {
  pausarIa?: (conversationId: string, organizationId: string) => Promise<void>;
  avisarDono?: (aviso: {
    organizationId: string;
    conversationId: string | null;
    titulo: string;
    descricao: string;
  }) => Promise<string | null>;
  registrarEvento?: (evento: EventoDePrefiltro) => Promise<string | null>;
}

/**
 * Marca a conversa como aguardando humano. Mesmo par (aiPaused, status) que
 * o transbordo manual e o PUT /assign usam, para o Inbox mostrar a conversa
 * no topo como "precisa de uma pessoa".
 */
async function pausarIaPadrao(conversationId: string, organizationId: string): Promise<void> {
  await prisma.conversation.updateMany({
    where: { id: conversationId, organizationId },
    data: { aiPaused: true, status: 'WAITING' },
  });
}

/** Notificação persistente: tarefa no Planner da organização do dono. */
async function avisarDonoPadrao(aviso: {
  organizationId: string;
  conversationId: string | null;
  titulo: string;
  descricao: string;
}): Promise<string> {
  const tarefa = await prisma.task.create({
    data: {
      title: aviso.titulo,
      description: aviso.descricao,
      status: 'PENDING',
      organizationId: aviso.organizationId,
      conversationId: aviso.conversationId,
    },
    select: { id: true },
  });
  return tarefa.id;
}

/** Grava o evento. Sem o texto da mensagem, por decisão de LGPD. */
async function registrarEventoPadrao(evento: EventoDePrefiltro): Promise<string> {
  const criado = await prisma.prefilterEvent.create({
    data: {
      organizationId: evento.organizationId,
      conversationId: evento.conversationId,
      canal: evento.canal,
      categoria: evento.categoria,
      regra: evento.regra,
      acao: evento.acao,
    },
    select: { id: true },
  });
  return criado.id;
}

export interface ResultadoDaRede {
  pausou: boolean;
  avisou: boolean;
  registrou: boolean;
}

interface EntradaDaRede {
  organizationId: string;
  conversationId: string | null;
  canal: CanalDoTurno;
  regra: string;
}

/** Núcleo comum de crise e de compliance. Fail-soft em cada etapa. */
async function acionar(
  entrada: EntradaDaRede,
  categoria: CategoriaDeEvento,
  acao: AcaoDeEvento,
  aviso: { titulo: string; descricao: string },
  deps: DependenciasDaRede,
): Promise<ResultadoDaRede> {
  const pausarIa = deps.pausarIa ?? pausarIaPadrao;
  const avisarDono = deps.avisarDono ?? avisarDonoPadrao;
  const registrarEvento = deps.registrarEvento ?? registrarEventoPadrao;

  const resultado: ResultadoDaRede = { pausou: false, avisou: false, registrou: false };

  logger.warn({
    msg: 'prefiltro_disparo',
    categoria,
    acao,
    regra: entrada.regra,
    canal: entrada.canal,
    organizationId: entrada.organizationId,
    conversationId: entrada.conversationId,
  });

  // Sem conversa real (playground) não há o que pausar nem a quem passar.
  if (entrada.conversationId) {
    try {
      await pausarIa(entrada.conversationId, entrada.organizationId);
      resultado.pausou = true;
    } catch (err) {
      logger.error({
        msg: 'prefiltro_pausa_falhou',
        error: String((err as Error)?.message ?? err),
      });
    }

    try {
      await avisarDono({
        organizationId: entrada.organizationId,
        conversationId: entrada.conversationId,
        titulo: aviso.titulo,
        descricao: aviso.descricao,
      });
      resultado.avisou = true;
    } catch (err) {
      logger.error({
        msg: 'prefiltro_aviso_falhou',
        error: String((err as Error)?.message ?? err),
      });
    }
  }

  try {
    await registrarEvento({
      organizationId: entrada.organizationId,
      conversationId: entrada.conversationId,
      canal: entrada.canal,
      categoria,
      regra: entrada.regra,
      acao,
    });
    resultado.registrou = true;
  } catch (err) {
    logger.error({
      msg: 'prefiltro_registro_falhou',
      error: String((err as Error)?.message ?? err),
    });
  }

  return resultado;
}

/**
 * Sinal de crise: a IA para, uma pessoa assume e o dono fica sabendo.
 * A resposta do agente já saiu, com a linha do CVV acrescentada.
 */
export async function acionarRedeDeCrise(
  entrada: EntradaDaRede,
  deps: DependenciasDaRede = {},
): Promise<ResultadoDaRede> {
  return acionar(entrada, 'crise', 'acolhimento', {
    titulo: 'Conversa precisa de uma pessoa agora',
    descricao: [
      'A IA identificou sinais de que a pessoa do outro lado pode estar em',
      'sofrimento e pausou o atendimento automático nesta conversa.',
      '',
      'A resposta enviada incluiu o contato do CVV (188, 24 horas,',
      'cvv.org.br). Abra a conversa e fale com ela.',
      '',
      'O conteúdo da mensagem não é copiado para cá de propósito: ele está',
      'na conversa, com o mesmo controle de acesso de sempre.',
    ].join('\n'),
  }, deps);
}

/**
 * Compliance: a mensagem tocou uma regra que vale para todos os clientes.
 * Antes isso virava recusa fixa, sem registro e sem aviso (A251, A232).
 * Agora vira transbordo, e quem decide se atende é a pessoa.
 */
export async function acionarTransbordoDeCompliance(
  entrada: EntradaDaRede,
  deps: DependenciasDaRede = {},
): Promise<ResultadoDaRede> {
  return acionar(entrada, 'compliance', 'transbordo', {
    titulo: 'Conversa encaminhada para uma pessoa (regra de conteúdo)',
    descricao: [
      `A IA pausou esta conversa por uma regra de conteúdo (${entrada.regra}).`,
      '',
      'Até 14/09/2026 a plataforma respondia com uma recusa fixa e não',
      'avisava ninguém. Agora quem decide se atende é você: abra a conversa',
      'e veja o caso.',
      '',
      'O texto da mensagem não é copiado para cá.',
    ].join('\n'),
  }, deps);
}
