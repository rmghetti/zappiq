/* ══════════════════════════════════════════════════════════════════════
 * agentEvalContext: o contexto do teste de Qualidade pelo motor único.
 * --------------------------------------------------------------------
 * Tarefa C1a (Passo 12, achado A036). O teste de Qualidade montava o prompt
 * com CORE + prompt do agente + um bloco falso de cliente, e chamava o
 * modelo. Em produção o agente recebe também a base (RAG), a saudação, os
 * links, o perfil vivo e a data. Cenários que dependem de informação
 * (preço, horário, link) reprovavam por falta de dado, e a correção
 * sugerida virava regra de prompt para um problema de base (A037).
 *
 * Aqui, com o interruptor `contextoUnico` da organização ligada, cada
 * cenário ganha o MESMO contexto que a produção monta, com três diferenças
 * de propósito:
 *   - a data é FIXA (DATA_FIXA_DO_EVAL), para o teste ser reproduzível;
 *   - o contato é o mock de sempre (Cliente Teste, +5511999999999, NEW), com o
 *     nome omitido nos cenários que testam justamente a falta de nome;
 *   - a busca na base é feita com a MENSAGEM DO CENÁRIO, no namespace da
 *     organização testada, pelo mesmo ragService.searchDetailed da produção.
 *
 * Se o serviço da base estiver fora, o resultado do cenário grava
 * ragStatus 'servico_fora' em vez de fingir que não há base.
 *
 * O runner (agentEvalRunner.ts) NÃO importa este arquivo: recebe o montador
 * por injeção, para continuar testável sem banco, sem base e sem
 * interruptor. Quem chama o runner (rota, fila, admin) é quem cria o
 * montador aqui. A leitura do interruptor e das settings é PREGUIÇOSA, no
 * primeiro cenário: criar o montador não custa nada.
 *
 * As regras aprovadas pelo dono (PR #375) NÃO são lidas aqui: quem chama o
 * avaliador já as leu uma vez (ContextoDoSugeridor.regrasBlock) e o runner
 * entrega o mesmo texto a cada cenário (rodada 2 do PR #377).
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import * as ragService from './ragService.js';
import {
  flagLigada,
  montarContextoDoTurno,
  carregarPoliticaDoTurno,
  type ContatoDoTurno,
} from '../agents/agentContextLoader.js';
import { NOME_FICTICIO_DO_TESTE, type EvalScenario } from '../agents/evalScenarioTypes.js';
import { PROVEDOR_DA_CASCATA_PADRAO } from '../agents/resolveTurnPolicy.js';
import { familiaDoProvedor, familiasConfiguradas } from './agentEvalRunner.js';
import { breakerIsOpen } from './llm/redisBreaker.js';
import type { LLMProviderId } from './llm/LLMRouter.js';
import type {
  ContextoDoCenario,
  ExtrasDoMontador,
  MontadorDeContexto,
  PoliticaDaQualidade,
} from './agentEvalRunner.js';

/** Segunda-feira, 12:00 em São Paulo. Fixa: o mesmo cenário dá o mesmo prompt. */
export const DATA_FIXA_DO_EVAL = new Date('2026-09-14T15:00:00Z');

/** O texto que entra no lugar do prompt quando o agente não tem um (como hoje). */
export const PROMPT_AUSENTE = '(agente sem system_prompt customizado — só CORE rules)';

/**
 * O contato falso do teste, o mesmo de buildEvalSystemPrompt: cenários
 * cr5_nome_ausente_* testam o comportamento de PERGUNTAR o nome, então o
 * nome é omitido neles.
 */
export function contatoDoCenario(scenario: Pick<EvalScenario, 'id' | 'history'>): ContatoDoTurno {
  const turnos = scenario.history?.length ?? 0;
  return {
    nome: scenario.id.includes('nome_ausente') ? null : NOME_FICTICIO_DO_TESTE,
    leadStatus: 'NEW',
    primeiroContato: turnos === 0,
    totalMensagens: turnos + 1,
    telefone: '+5511999999999',
  };
}

interface SetupDoEval {
  ligado: boolean;
  orgSettings: Record<string, any>;
  perfilVivoLigado: boolean;
}

/**
 * Cria o montador de contexto para uma execução da Qualidade.
 *
 * Síncrono e sem IO: a decisão (interruptor) e as settings são lidas UMA vez,
 * no primeiro cenário, e reaproveitadas nos demais. Com o interruptor
 * desligado, o montador devolve null e o runner usa o prompt de antes.
 */
export function criarMontadorDeContextoDoEval(
  agent: { id: string; name: string; systemPrompt: string | null },
  organizationId: string,
): MontadorDeContexto {
  let setup: Promise<SetupDoEval> | null = null;

  const prepararUmaVez = (): Promise<SetupDoEval> => {
    if (!setup) {
      setup = (async () => {
        const [ligado, perfilVivoLigado] = await Promise.all([
          flagLigada(organizationId, 'contextoUnico'),
          flagLigada(organizationId, 'perfilVivo'),
        ]);
        if (!ligado) return { ligado: false, orgSettings: {}, perfilVivoLigado: false };
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { settings: true },
        });
        return {
          ligado: true,
          orgSettings: (org?.settings as Record<string, any>) ?? {},
          perfilVivoLigado,
        };
      })();
    }
    return setup;
  };

  return async (scenario: EvalScenario, extras?: ExtrasDoMontador): Promise<ContextoDoCenario | null> => {
    const { ligado, orgSettings, perfilVivoLigado } = await prepararUmaVez();
    if (!ligado) return null;

    // A base da organização testada, pela busca real. searchDetailed já é
    // fail-soft e devolve 'servico_fora' quando o serviço cai; o try aqui é
    // a última rede.
    let ragContext = '';
    let ragStatus: ragService.RagSearchStatus = 'sem_resultado';
    // C2 (Passo 1, A226): os ids dos trechos que entraram, para o resultado.
    let fontes: string[] = [];
    try {
      const busca = await ragService.searchDetailed(organizationId, scenario.userMessage, 5);
      ragContext = busca.context;
      ragStatus = busca.status;
      fontes = Array.isArray(busca.trechoIds) ? busca.trechoIds : [];
    } catch (err) {
      logger.warn('[agentEvalContext] busca na base falhou: cenário segue com servico_fora', {
        organizationId,
        scenarioId: scenario.id,
        err: err instanceof Error ? err.message : String(err),
      });
      ragStatus = 'servico_fora';
    }

    const contexto = await montarContextoDoTurno({
      origem: 'qualidade',
      organizationId,
      orgSettings,
      agente: {
        id: agent.id,
        name: agent.name,
        systemPrompt: agent.systemPrompt || PROMPT_AUSENTE,
        role: 'comercial',
      },
      contato: contatoDoCenario(scenario),
      ragContext,
      ragStatus,
      temHistoricoNoContexto: (scenario.history?.length ?? 0) > 0,
      agora: DATA_FIXA_DO_EVAL,
      perfilVivoLigado,
      // Rodada 2 do PR #377: o MESMO bloco que quem chamou o avaliador leu
      // uma vez por execução (ContextoDoSugeridor.regrasBlock), e não uma
      // leitura nova por cenário. Vazio, o prompt fica sem o bloco.
      regrasDoCliente: extras?.regrasBlock ?? '',
    });
    // Com o agente explícito o carregador nunca devolve null; o guard é
    // só para o tipo.
    if (!contexto) return null;
    return {
      systemPrompt: contexto.systemPrompt,
      hash: contexto.hash,
      partes: contexto.partes,
      ragStatus,
      // C2 (Passo 2, A039): o juiz vê OS MESMOS trechos que o agente viu.
      trechos: ragContext,
      fontes,
    };
  };
}

/**
 * C2, nota 1 da revisão de 14/09: o modelo da faixa do plano para a
 * Qualidade, atrás do interruptor `evalNoTier`.
 *
 * Devolve uma função PREGUIÇOSA: criar não faz IO, e o avaliador lê uma vez
 * por execução, no primeiro cenário. Interruptor desligado (o padrão): a
 * cascata padrão de hoje. Ligado: a MESMA decisão que a produção toma para
 * a organização (resolveTurnPolicy, canal 'qualidade'), sem ferramentas,
 * sem cópia da regra de escolha.
 *
 * Rodada 1 do PR #378, item 1: o interruptor `juizDeOutraFamilia` é lido
 * aqui também, na mesma leitura, e viaja na política (`juizOutraFamilia`).
 * Com os dois desligados a política é null, como antes.
 *
 * Rodada 1 do PR #378, item 9: se a família do modelo escolhido não tem
 * chave (o Gemini está parado desde 10/07) ou o disjuntor do provedor está
 * aberto, a política volta à cascata padrão e o motivo vai no resultado.
 * Antes, toda resposta vinha pela reserva e ficava inconclusiva.
 */
export interface DepsDaPolitica {
  /** As famílias com chave configurada. Padrão: o ambiente. */
  familias?: () => Set<string>;
  /** O disjuntor do provedor está aberto? Padrão: o breaker no Redis. */
  disjuntorAberto?: (id: LLMProviderId) => Promise<boolean>;
}

/** Por que o modelo da faixa não pode ser pedido agora, ou null se pode. */
async function motivoDeIndisponibilidade(
  modelo: LLMProviderId,
  deps: DepsDaPolitica,
): Promise<string | null> {
  const familia = familiaDoProvedor(modelo);
  const familias = (deps.familias ?? familiasConfiguradas)();
  if (familia && !familias.has(familia)) return `a família ${familia} está sem chave (${modelo})`;
  try {
    if (await (deps.disjuntorAberto ?? breakerIsOpen)(modelo)) {
      return `o disjuntor de ${modelo} está aberto`;
    }
  } catch (err) {
    // A leitura do disjuntor é fail-open, como no roteador: erro não bloqueia.
    logger.warn('[agentEvalContext] leitura do disjuntor falhou: segue a faixa do plano', {
      modelo,
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

export function criarPoliticaDaQualidade(
  organizationId: string,
  deps: DepsDaPolitica = {},
): () => Promise<PoliticaDaQualidade | null> {
  let lida: Promise<PoliticaDaQualidade | null> | null = null;
  return () => {
    if (!lida) {
      lida = (async () => {
        const [naFaixaDoPlano, juizOutraFamilia] = await Promise.all([
          flagLigada(organizationId, 'evalNoTier'),
          flagLigada(organizationId, 'juizDeOutraFamilia'),
        ]);
        if (!naFaixaDoPlano) {
          if (!juizOutraFamilia) return null;
          return {
            modelo: PROVEDOR_DA_CASCATA_PADRAO,
            motivo: 'evalNoTier desligado: cascata padrão',
            juizOutraFamilia: true,
          };
        }
        const p = await carregarPoliticaDoTurno(organizationId, {
          canal: 'qualidade',
          agendamentoAtivo: false,
          evalNaFaixaDoPlano: true,
        });
        const indisponivel = await motivoDeIndisponibilidade(p.modelo, deps);
        if (indisponivel) {
          const motivo = `evalNoTier ligado, mas ${indisponivel}: cascata padrão`;
          logger.warn('[agentEvalContext] Qualidade fora da faixa do plano', {
            organizationId,
            modeloDaFaixa: p.modelo,
            motivo,
          });
          return { modelo: PROVEDOR_DA_CASCATA_PADRAO, motivo, juizOutraFamilia };
        }
        logger.info('[agentEvalContext] Qualidade na faixa do plano', {
          organizationId,
          modelo: p.modelo,
          motivo: p.motivo,
          juizOutraFamilia,
        });
        return { tier: p.tier, override: p.override, modelo: p.modelo, motivo: p.motivo, juizOutraFamilia };
      })();
    }
    return lida;
  };
}
