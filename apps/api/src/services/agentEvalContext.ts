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
 *   - o contato é o mock de sempre (Rod, +5511999999999, NEW), com o
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
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import * as ragService from './ragService.js';
import { flagLigada, montarContextoDoTurno, type ContatoDoTurno } from '../agents/agentContextLoader.js';
import type { EvalScenario } from '../agents/evalScenarioTypes.js';
import type { ContextoDoCenario, MontadorDeContexto } from './agentEvalRunner.js';

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
    nome: scenario.id.includes('nome_ausente') ? null : 'Rod',
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

  return async (scenario: EvalScenario): Promise<ContextoDoCenario | null> => {
    const { ligado, orgSettings, perfilVivoLigado } = await prepararUmaVez();
    if (!ligado) return null;

    // A base da organização testada, pela busca real. searchDetailed já é
    // fail-soft e devolve 'servico_fora' quando o serviço cai; o try aqui é
    // a última rede.
    let ragContext = '';
    let ragStatus: ragService.RagSearchStatus = 'sem_resultado';
    try {
      const busca = await ragService.searchDetailed(organizationId, scenario.userMessage, 5);
      ragContext = busca.context;
      ragStatus = busca.status;
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
    });
    // Com o agente explícito o carregador nunca devolve null; o guard é
    // só para o tipo.
    if (!contexto) return null;
    return {
      systemPrompt: contexto.systemPrompt,
      hash: contexto.hash,
      partes: contexto.partes,
      ragStatus,
    };
  };
}
