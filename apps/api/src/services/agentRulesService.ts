/* ══════════════════════════════════════════════════════════════════════
 * agentRulesService: leitura e escrita das regras aprovadas pelo dono.
 * --------------------------------------------------------------------
 * A parte PURA (montar o bloco, resumir o CORE, verificar conflito) mora em
 * agents/regrasDoAgente.ts. Aqui fica só o que toca banco e interruptor.
 *
 * Três garantias, e cada uma é um achado do laudo:
 *
 *   A081  aplicar de novo o MESMO cenário substitui a regra anterior, não
 *         acumula. O índice único parcial do Postgres é a rede de baixo; a
 *         transação daqui é a rede de cima.
 *   A083  reverter desativa SÓ aquela regra. Não regrava o prompt, não
 *         encosta nas outras regras, não volta no tempo.
 *   A075  leitura fail-soft: banco fora ou interruptor ilegível devolve
 *         bloco vazio. A resposta ao cliente final nunca trava por causa
 *         de uma regra que não conseguimos ler.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { isFlagOn } from './featureFlags.js';
import {
  montarBlocoDeRegras,
  TETO_DE_REGRAS_ATIVAS,
  type OrigemDaRegra,
  type RegraDoAgente,
} from '../agents/regrasDoAgente.js';

export { TETO_DE_REGRAS_ATIVAS };

/** A regra como sai do banco, com o que a tela precisa mostrar. */
export interface RegraGravada extends RegraDoAgente {
  organizationId: string;
  agentId: string;
  status: string;
  motivo: string | null;
  decisionId: string | null;
  createdBy?: string | null;
  createdAt: Date;
}

/** Subconjunto do PrismaClient (ou de um `tx`) que este service usa. */
export interface AgentRulesDb {
  agentRule: {
    findMany: (args: any) => Promise<any[]>;
    findFirst: (args: any) => Promise<any | null>;
    updateMany: (args: any) => Promise<{ count: number }>;
    update: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    count: (args: any) => Promise<number>;
  };
  $transaction?: (fn: (tx: AgentRulesDb) => Promise<any>) => Promise<any>;
}

function dbPadrao(): AgentRulesDb {
  return prisma as unknown as AgentRulesDb;
}

/** Passou do teto de regras ativas (A081): a saída é consolidar, não empilhar. */
export class TetoDeRegrasError extends Error {
  readonly code = 'teto_de_regras';
  constructor(public readonly ativas: number) {
    super(
      `Este agente já tem ${ativas} regras ativas, que é o teto. Desfaça uma regra que não vale ` +
        'mais, ou junte duas que falam da mesma coisa, antes de aprovar outra.',
    );
    this.name = 'TetoDeRegrasError';
  }
}

/* ── Leitura ─────────────────────────────────────────────────────── */

export interface FiltroDeRegras {
  organizationId: string;
  /**
   * Opcional, mas os dois montadores de prompt passam (PI-3): o WhatsApp
   * (agentOrchestrator) e o chat do site (webChatService). A regra é do
   * AGENTE, e não da organização: com o filtro só por organização, bastava a
   * primeira empresa ligar um segundo agente (suporte, por exemplo) para as
   * regras do comercial entrarem no prompt dele.
   *
   * Continua opcional porque existe um caminho sem agente: a organização sem
   * Agent semeado, que cai no fallback do promptEngine. Ali a organização é o
   * melhor recorte disponível. As rotas de escrita sempre passam o agente.
   */
  agentId?: string | null;
  /** Padrão 'ativa'. A tela do dono pede o histórico também. */
  status?: string | string[];
}

/**
 * Regras da organização, na ordem em que entraram.
 *
 * Fail-soft de propósito: esta função roda no caminho da resposta ao cliente
 * final. Banco fora não pode virar erro de conversa.
 */
export async function carregarRegrasAtivas(
  filtro: FiltroDeRegras,
  db: AgentRulesDb = dbPadrao(),
): Promise<RegraGravada[]> {
  const status = filtro.status ?? 'ativa';
  try {
    const linhas = await db.agentRule.findMany({
      where: {
        organizationId: filtro.organizationId,
        ...(filtro.agentId ? { agentId: filtro.agentId } : {}),
        status: Array.isArray(status) ? { in: status } : status,
      },
      orderBy: { createdAt: 'asc' },
    });
    return linhas as RegraGravada[];
  } catch (err) {
    logger.warn('[agentRulesService] não consegui ler as regras (seguindo sem elas)', {
      organizationId: filtro.organizationId,
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * O bloco "# Regras aprovadas pelo dono" pronto para entrar no prompt.
 *
 * Interruptor desligado devolve string vazia SEM ir ao banco: com a flag
 * off, o prompt montado é byte a byte o de antes, e ninguém paga uma
 * consulta por turno para descobrir isso.
 */
export async function blocoDeRegrasDaOrganizacao(
  organizationId: string,
  opts: { agentId?: string | null; db?: AgentRulesDb } = {},
): Promise<string> {
  if (!organizationId) return '';
  let ligado = false;
  try {
    ligado = await isFlagOn(organizationId, 'regrasComoRegistros');
  } catch {
    ligado = false;
  }
  if (!ligado) return '';

  const regras = await carregarRegrasAtivas(
    { organizationId, agentId: opts.agentId ?? null },
    opts.db ?? dbPadrao(),
  );
  return montarBlocoDeRegras(regras);
}

/* ── Escrita ─────────────────────────────────────────────────────── */

export interface AplicarRegraInput {
  organizationId: string;
  agentId: string;
  /** Null para regra escrita à mão: essas convivem, não substituem. */
  scenarioId: string | null;
  texto: string;
  origem: OrigemDaRegra;
  decisionId?: string | null;
  createdBy?: string | null;
  versaoDoPromptDeOrigem?: number | null;
}

export interface AplicarRegraResult {
  regra: RegraGravada;
  /** Quantas regras do mesmo cenário saíram de 'ativa' para dar lugar a esta. */
  substituiu: number;
}

/**
 * Cria a regra do cenário, SUBSTITUINDO a que estava ativa.
 *
 * É esta função que resolve o A081. Antes, cada aplicação empilhava um
 * "# PATCH MANUAL" novo no fim do prompt (a Iza recebeu seis correções para
 * o mesmo cenário de nome, em seis execuções). Agora a segunda aplicação
 * marca a primeira como 'substituida' e o prompt continua do mesmo tamanho.
 *
 * Tudo numa transação: nunca existe o instante em que a antiga já saiu e a
 * nova ainda não entrou, nem o instante em que as duas estão ativas.
 */
export async function aplicarRegraDoCenario(
  input: AplicarRegraInput,
  db: AgentRulesDb = dbPadrao(),
): Promise<AplicarRegraResult> {
  const texto = String(input.texto ?? '').trim();
  if (!texto) throw new Error('aplicarRegraDoCenario: texto da regra é obrigatório');

  const corpo = async (tx: AgentRulesDb): Promise<AplicarRegraResult> => {
    // O teto conta as ativas ANTES. Substituir uma regra que já existe não
    // aumenta o número de ativas, então passa mesmo no teto.
    const ativas = await tx.agentRule.count({
      where: { agentId: input.agentId, status: 'ativa' },
    });
    if (ativas >= TETO_DE_REGRAS_ATIVAS) {
      const jaExiste = input.scenarioId
        ? await tx.agentRule.findFirst({
            where: { agentId: input.agentId, scenarioId: input.scenarioId, status: 'ativa' },
          })
        : null;
      if (!jaExiste) throw new TetoDeRegrasError(ativas);
    }

    let substituiu = 0;
    if (input.scenarioId) {
      const r = await tx.agentRule.updateMany({
        where: { agentId: input.agentId, scenarioId: input.scenarioId, status: 'ativa' },
        data: {
          status: 'substituida',
          motivo: 'substituida_por_nova',
          updatedAt: new Date(),
        },
      });
      substituiu = r.count;
    }

    const regra = await tx.agentRule.create({
      data: {
        organizationId: input.organizationId,
        agentId: input.agentId,
        scenarioId: input.scenarioId,
        texto,
        origem: input.origem,
        status: 'ativa',
        decisionId: input.decisionId ?? null,
        createdBy: input.createdBy ?? null,
        versaoDoPromptDeOrigem: input.versaoDoPromptDeOrigem ?? null,
      },
    });

    return { regra: regra as RegraGravada, substituiu };
  };

  const out =
    typeof db.$transaction === 'function' ? await db.$transaction(corpo) : await corpo(db);

  logger.info('[agentRulesService] regra aprovada', {
    organizationId: input.organizationId,
    agentId: input.agentId,
    scenarioId: input.scenarioId,
    origem: input.origem,
    substituiu: out.substituiu,
  });
  return out;
}

export interface ReverterRegraInput {
  ruleId: string;
  organizationId: string;
  /** Quem desfez, para a tela e para o histórico. */
  actor?: string | null;
}

/**
 * Desfaz UMA regra.
 *
 * Nada de prompt, nada de versão anterior, nada de outras regras: uma linha
 * sai de 'ativa' e o próximo turno já monta o bloco sem ela. Era esse o
 * pedido do A083, e é o que separa "desfazer a correção de terça" de
 * "apagar tudo o que foi feito desde terça".
 *
 * Devolve null quando a regra não existe, não é da organização ou já não
 * está ativa: quem chama responde 404, nunca 403.
 */
export async function reverterRegra(
  input: ReverterRegraInput,
  db: AgentRulesDb = dbPadrao(),
): Promise<RegraGravada | null> {
  const atual = await db.agentRule.findFirst({
    where: { id: input.ruleId, organizationId: input.organizationId, status: 'ativa' },
  });
  if (!atual) return null;

  const revertida = await db.agentRule.update({
    where: { id: input.ruleId },
    data: {
      status: 'revertida',
      motivo: 'revertida_pelo_dono',
      updatedAt: new Date(),
    },
  });

  logger.info('[agentRulesService] regra desfeita', {
    organizationId: input.organizationId,
    ruleId: input.ruleId,
    scenarioId: atual.scenarioId,
    actor: input.actor ?? null,
  });
  return revertida as RegraGravada;
}

/**
 * A regra que veio de uma decisão de correção, em QUALQUER status.
 *
 * Sem filtro de status de propósito. A consulta filtrava por 'ativa', e uma
 * correção já substituída por outra do mesmo cenário devolvia null: a rota de
 * desfazer então caía no caminho do prompt, encontrava o hash igual (esse
 * caminho nunca mexeu no prompt) e respondia 200 dizendo "revertida", sem ter
 * desativado nada. O dono via sucesso e a regra continuava no ar.
 *
 * Quem chama precisa do fato inteiro ("existe, e está assim") para responder
 * certo: ativa se desfaz, substituída ou já desfeita vira 409 com a frase que
 * explica o que aconteceu.
 */
export async function regraDaDecisao(
  decisionId: string,
  db: AgentRulesDb = dbPadrao(),
): Promise<RegraGravada | null> {
  if (!decisionId) return null;
  const r = await db.agentRule.findFirst({
    where: { decisionId },
    orderBy: { createdAt: 'desc' },
  });
  return (r as RegraGravada) ?? null;
}
