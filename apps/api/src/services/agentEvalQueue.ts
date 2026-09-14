/**
 * Fila do teste da Qualidade do Agente (A048).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Por que existe
 * ═══════════════════════════════════════════════════════════════════════════
 * A execução rodava DENTRO do processo da API: o cron em linha e as duas
 * rotas /run-async num setImmediate. Três consequências medidas em produção:
 *
 *   1. Reinício de máquina no meio deixava a linha em 'running' para sempre.
 *      Duas execuções da Iza de 15/07 continuavam 'running' quase dois meses
 *      depois.
 *   2. O cooldown de 24 h do cliente conta qualquer execução manual que não
 *      esteja 'failed'. Uma linha presa em 'running' travava o botão dele por
 *      um dia inteiro, sem ninguém entender por quê.
 *   3. Nada limitava a duração: uma execução de 11/09 levou 38 minutos.
 *
 * Agora: fila BullMQ `agent-eval` com concorrência 1 (os cenários já são
 * sequenciais e o gargalo é o limite de taxa do provedor, então paralelizar
 * só produziria 429), tempo limite de 25 minutos por execução e uma varredura
 * horária que mata o que ficou preso.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Um corpo só
 * ═══════════════════════════════════════════════════════════════════════════
 * `executeRunJob(runId)` é o corpo ÚNICO da execução: o worker da fila (rotas
 * do cliente e do superadmin) e o ciclo do cron chamam a mesma função. Antes
 * o mesmo bloco estava copiado em três arquivos, e foi por isso que o cron
 * nunca gravou slackAlertStatus: a cópia dele não tinha esse trecho.
 */
import { DelayedError, Queue, Worker, type Job } from 'bullmq';
import { prisma } from '@zappiq/database';

import { queueConnection as connection, IDLE_DRAIN_DELAY_SECONDS } from '../config/queueRedis.js';
import { logger } from '../utils/logger.js';
// Conexão ioredis da casa (a mesma do costGuard e do tenantUsage). A trava
// global vive FORA do BullMQ de propósito: ver adquirirTravaGlobal.
import redis from '../utils/redis.js';
import { resolveEvalSet, HARNESS_VERSION } from '../agents/agentEvalSet.js';
import type { EvalScenario } from '../agents/evalScenarioTypes.js';
import type { TenantAgentProfile } from '../agents/tenantAgentProfile.js';
import { resolveTenantAgentProfile } from '../agents/tenantAgentProfile.js';
import { executeAgentEvalRun } from './agentEvalRunner.js';
// C1a (A036): contexto de produção no teste, atrás do interruptor contextoUnico.
import { criarMontadorDeContextoDoEval } from './agentEvalContext.js';
import {
  notifySlackQualityIssue,
  scenariosFailingTwice,
  shouldAlertQuality,
} from './agentEvalCronService.js';
// P61 — a regravação entra pela mesma fila e pela mesma trava global. Não por
// ser cara (ela não chama LLM nenhuma), mas para não ler `results` de uma
// execução que ainda está sendo gravada.
import { regradeRun } from './evalRegradeService.js';

export const AGENT_EVAL_QUEUE_NAME = 'agent-eval';

/**
 * Teto por execução, contado por um relógio de verdade dentro de
 * executeRunJob (Promise.race). Estourou, a linha vira 'failed'.
 *
 * O mesmo valor é passado como `lockDuration` do worker, mas atenção ao que
 * o lock faz de VERDADE: ele só protege contra máquina morta. Enquanto o
 * processador está vivo o BullMQ RENOVA o lock sozinho, então lockDuration
 * nunca interrompeu execução nenhuma. A execução de 38 minutos de 11/09 teria
 * rodado inteira, segurando a fila de concorrência 1 o tempo todo.
 *
 * Três camadas, cada uma para um modo de falha diferente:
 *   - 60 s por chamada de LLM (agentEvalRunner): corte fino do provedor lento;
 *   - 25 min por execução (aqui): teto do teste inteiro;
 *   - varredura horária (sweepStuckEvalRuns): rede para máquina morta, que é
 *     o único caso em que ninguém sobrou para gravar a falha.
 */
export const EVAL_RUN_TIMEOUT_MS = 25 * 60 * 1000;

/** A partir daqui uma execução parada é considerada morta. */
export const EVAL_RUN_STUCK_AFTER_MS = 60 * 60 * 1000;

/** Erro gravado pela varredura. Texto estável: a UI mostra para o cliente. */
export const ERRO_TEMPO_LIMITE = 'tempo limite: execução em running há mais de 1 hora';

/** Erro gravado quando o teto de 25 minutos estoura. A UI mostra ao cliente. */
export const ERRO_TETO_EXECUCAO = 'tempo limite da execução (25 min)';

/**
 * A171 — portão dos 20%.
 *
 * O cenário que quebra já sai do denominador da nota. Faltava o outro lado: a
 * execução em que a MAIORIA quebrou não é uma nota baixa, é uma execução que
 * não aconteceu. Em 15/06 uma execução com 25 de 25 respostas vazias foi
 * gravada com nota zero, alertou o Slack e virou correção aplicada no prompt
 * da Iza, com o sugeridor inventando a causa a partir de resposta vazia.
 *
 * Acima de 20% de cenários sem resposta válida, a linha vira 'failed' com
 * este motivo. Não há nota para gravar nem nota para alertar.
 */
export const ERRO_FALHA_TECNICA_DO_PROVEDOR =
  'falha técnica do provedor: mais de 20% dos cenários sem resposta válida';

/** Acima disto a execução não é avaliável. */
export const TETO_DE_ERROS_TECNICOS = 0.2;

/**
 * slackAlertStatus de execução que terminou em FALHA: não houve resultado
 * para avaliar, então não houve alerta a mandar. Gravar isto (em vez de
 * deixar nulo) mantém verdadeira a regra "slackAlertStatus é sempre gravado
 * quando a execução termina", que é o que permite auditar o campo depois.
 */
const ALERTA_NAO_ENVIADO = 'not_sent';

/** Estouro do teto de 25 minutos. Interno: vira 'failed' na própria linha. */
class EvalRunTimeoutError extends Error {
  constructor() {
    super(ERRO_TETO_EXECUCAO);
    this.name = 'EvalRunTimeoutError';
  }
}

/**
 * Corre `trabalho` contra um relógio real.
 *
 * A execução perdedora NÃO é cancelada: o LLMRouter chama os provedores com
 * fetch cru, sem AbortSignal, então não há o que abortar. O que garantimos é
 * que ela para de segurar a fila e a decisão sobre a linha. A chegada atrasada
 * dela é tratada pelo filtro de status em gravarConclusao.
 */
function comTetoDeExecucao<T>(trabalho: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new EvalRunTimeoutError()), ms);
    trabalho.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Painel para onde o alerta do Slack aponta, conforme quem disparou. */
const PAINEL_CLIENTE = '/treinar/qualidade';
const PAINEL_ADMIN = '/admin/agent-quality';

// ─── Fila (preguiçosa: importar este módulo não abre conexão) ──────
let queue: Queue | null = null;

export function getAgentEvalQueue(): Queue {
  if (!queue) {
    queue = new Queue(AGENT_EVAL_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
        // Repetir uma execução de teste custa dinheiro de LLM. Uma tentativa.
        attempts: 1,
      },
    });
  }
  return queue;
}

/** Erro gravado quando a fila não aceita o job (Redis fora, por exemplo). */
export const ERRO_NAO_ENFILEIRADA = 'não foi possível enfileirar a execução';

/**
 * Enfileira a execução já criada em AgentEvalRun.
 *
 * jobId = runId: se a mesma execução for enfileirada duas vezes (retry de
 * rota, dois nós do Fly), o BullMQ descarta a segunda.
 *
 * Se a fila recusar, a linha vira 'failed' na hora em vez de ficar 'pending'
 * até a varredura horária passar: a tela do cliente precisa dizer o que houve
 * agora, não em uma hora. O erro sobe para a rota devolver 500.
 */
export async function enqueueEvalRun(runId: string): Promise<void> {
  try {
    await getAgentEvalQueue().add('run', { runId }, { jobId: runId, removeOnComplete: true });
  } catch (err: any) {
    logger.error({
      msg: 'agent_eval_enfileiramento_falhou',
      runId,
      error: String(err?.message || err),
    });
    await prisma.agentEvalRun
      .update({
        where: { id: runId },
        data: {
          status: 'failed',
          error: ERRO_NAO_ENFILEIRADA,
          completedAt: new Date(),
          slackAlertStatus: ALERTA_NAO_ENVIADO,
        },
      })
      .catch(() => undefined);
    throw err;
  }
}

/**
 * Enfileira uma REGRAVAÇÃO (P61) de uma lista de execuções já gravadas.
 *
 * Devolve o id do job, que é o que a rota admin usa para o fundador
 * acompanhar. Lista vazia é recusada: job sem trabalho só polui a fila.
 */
export async function enqueueRegrade(input: {
  runIds: string[];
  dryRun: boolean;
  jobId?: string;
}): Promise<string> {
  if (!Array.isArray(input.runIds) || input.runIds.length === 0) {
    throw new Error('nenhuma execução elegível para regravar');
  }
  const jobId = input.jobId ?? `regrade-${Date.now()}`;
  await getAgentEvalQueue().add(
    'regrade',
    { tipo: 'regrade', runIds: input.runIds, dryRun: input.dryRun },
    { jobId, removeOnComplete: true },
  );
  logger.info({
    msg: 'agent_eval_regrade_enfileirada',
    jobId,
    execucoes: input.runIds.length,
    dryRun: input.dryRun,
  });
  return jobId;
}

/**
 * Reconstrói os cenários da execução a partir do filtro gravado na linha.
 *
 * O filtro é o mesmo objeto que as rotas e o cron gravam em scenarioFilter.
 * A base é SEMPRE resolveEvalSet(profile): o cliente só pode ser filtrado
 * dentro do gabarito que se aplica a ele.
 */
export function resolveScenariosForRun(
  profile: TenantAgentProfile,
  scenarioFilter: unknown,
): EvalScenario[] {
  const base = resolveEvalSet(profile);
  const filtro = (scenarioFilter ?? {}) as {
    scenarioIds?: unknown;
    category?: unknown;
    criticalOnly?: unknown;
  };

  if (Array.isArray(filtro.scenarioIds) && filtro.scenarioIds.length > 0) {
    const ids = new Set(filtro.scenarioIds.map(String));
    return base.filter((s) => ids.has(s.id));
  }
  if (filtro.criticalOnly === true) return base.filter((s) => s.severity === 'critical');
  if (typeof filtro.category === 'string' && filtro.category) {
    return base.filter((s) => s.category === filtro.category);
  }
  return base;
}

/** Saída do runner, do jeito que a gravação da conclusão precisa. */
interface SaidaDaExecucao {
  results: Array<Record<string, any>>;
  durationMs: number;
  summary: {
    passed: number;
    partial: number;
    failed: number;
    criticalFailed: number;
    /** A171 — cenários que não puderam ser avaliados, fora do denominador. */
    erros: number;
    scorePercent: number;
  };
}

/**
 * Grava a CONCLUSÃO da execução. Devolve false quando não gravou.
 *
 * O filtro `status: 'running'` é a trava contra a chegada atrasada: quando o
 * teto de 25 minutos estoura, a linha já foi para 'failed' e a execução segue
 * correndo no provedor. Sem o filtro, ela voltaria minutos depois e regravaria
 * 'completed' por cima da falha que o cliente já viu na tela. O mesmo filtro
 * protege a linha que a varredura horária encerrou.
 */
/**
 * O que a gravação da conclusão decidiu:
 *   'gravou'        — virou nota, o alerta segue o caminho normal;
 *   'falha_tecnica' — o portão dos 20% fechou: linha 'failed', sem alerta;
 *   'ignorada'      — a linha já tinha saído de 'running'.
 */
type ResultadoDaGravacao = 'gravou' | 'falha_tecnica' | 'ignorada';

/** A171 — a execução foi avaliável, ou o provedor derrubou a maior parte? */
export function passouDoTetoDeErros(erros: number, totalScenarios: number): boolean {
  if (!Number.isFinite(totalScenarios) || totalScenarios <= 0) return false;
  return erros / totalScenarios > TETO_DE_ERROS_TECNICOS;
}

async function gravarConclusao(
  runId: string,
  saida: SaidaDaExecucao,
  totalScenarios: number,
): Promise<ResultadoDaGravacao> {
  const falhaTecnica = passouDoTetoDeErros(saida.summary.erros, totalScenarios);
  try {
    const { count } = await prisma.agentEvalRun.updateMany({
      where: { id: runId, status: 'running' },
      data: falhaTecnica
        ? {
            // A171: sem nota nenhuma no lugar. Gravar scorePercent aqui seria
            // exatamente o número que o portão existe para não publicar.
            status: 'failed',
            error: ERRO_FALHA_TECNICA_DO_PROVEDOR,
            slackAlertStatus: ALERTA_NAO_ENVIADO,
            harnessVersion: HARNESS_VERSION,
            results: saida.results as any,
            completedAt: new Date(),
            durationMs: saida.durationMs,
          }
        : {
            status: 'completed',
            ...saida.summary,
            // A régua com que esta execução foi medida. Sem isto, comparar a
            // nota de agosto com a de setembro é comparar duas réguas sem saber.
            harnessVersion: HARNESS_VERSION,
            results: saida.results as any,
            completedAt: new Date(),
            durationMs: saida.durationMs,
          },
    });
    if (count === 0) return 'ignorada';
    if (falhaTecnica) {
      logger.warn({
        msg: 'agent_eval_run_falha_tecnica_do_provedor',
        runId,
        erros: saida.summary.erros,
        totalScenarios,
      });
    }
    return falhaTecnica ? 'falha_tecnica' : 'gravou';
  } catch (err: any) {
    logger.error({
      msg: 'agent_eval_run_conclusao_nao_gravada',
      runId,
      error: String(err?.message || err),
    });
    return 'ignorada';
  }
}

/**
 * Marca a execução como falha. Só age sobre linha ainda em aberto, para não
 * passar por cima de conclusão nem de falha já registrada.
 *
 * Devolve false quando NÃO marcou, e quem chama precisa desse false: significa
 * que a linha já estava encerrada por outro caminho. Ver fecharCorridaComOTeto.
 */
async function marcarFalha(runId: string, erro: string): Promise<boolean> {
  return prisma.agentEvalRun
    .updateMany({
      where: { id: runId, status: { in: ['pending', 'running'] } },
      data: {
        status: 'failed',
        error: erro,
        completedAt: new Date(),
        slackAlertStatus: ALERTA_NAO_ENVIADO,
      },
    })
    .then(({ count }) => count > 0)
    .catch(() => false);
}

/**
 * Fecha a corrida entre a gravação da conclusão e o relógio do teto.
 *
 * A janela é estreita mas existe: gravarConclusao grava 'completed' e, antes
 * da promessa voltar, o relógio de 25 minutos dispara. A execução cai no
 * catch com a linha JÁ concluída. marcarFalha não toca nela (o filtro só pega
 * 'pending'/'running') e o caminho normal do alerta ficou para trás, então a
 * linha terminaria 'completed' com slackAlertStatus nulo para sempre. É
 * exatamente o buraco de auditoria que o campo existe para fechar: sem ele,
 * ninguém sabe se aquele resultado chegou a ser alertado.
 *
 * Por isso a decisão do alerta aqui lê o status EFETIVAMENTE gravado, e não o
 * que o fluxo em memória supõe. Os números vêm da linha, que é a única fonte
 * que sobreviveu à corrida.
 */
async function fecharCorridaComOTeto(
  runId: string,
  agent: { id: string; name: string; organization?: { name: string } | null },
): Promise<void> {
  const linha = await prisma.agentEvalRun
    .findUnique({
      where: { id: runId },
      select: {
        status: true,
        triggeredBy: true,
        slackAlertStatus: true,
        results: true,
        passed: true,
        partial: true,
        failed: true,
        criticalFailed: true,
        erros: true,
        scorePercent: true,
        durationMs: true,
        totalScenarios: true,
      },
    })
    .catch(() => null);

  // Linha encerrada de qualquer outra forma (falha da varredura, falha já
  // registrada) ou alerta já decidido: nada a fazer.
  if (!linha || linha.status !== 'completed' || linha.slackAlertStatus) return;

  logger.warn({ msg: 'agent_eval_run_conclusao_venceu_o_teto', runId, agentId: agent.id });

  await alertarSePreciso({
    run: { id: runId, triggeredBy: linha.triggeredBy, agentId: agent.id },
    agentName: agent.name,
    organizationName: agent.organization?.name || '(sem nome)',
    results: Array.isArray(linha.results) ? (linha.results as Array<Record<string, any>>) : [],
    summary: {
      passed: linha.passed ?? 0,
      partial: linha.partial ?? 0,
      failed: linha.failed ?? 0,
      criticalFailed: linha.criticalFailed ?? 0,
      erros: linha.erros ?? 0,
      scorePercent: linha.scorePercent ?? 0,
    },
    durationMs: linha.durationMs ?? 0,
    totalScenarios: linha.totalScenarios ?? 0,
  });
}

/**
 * Executa uma linha de AgentEvalRun de ponta a ponta.
 *
 * Idempotente: execução que já saiu de 'pending'/'running' não roda de novo,
 * porque repetir custa dinheiro de LLM. Nunca lança: o erro vira status
 * 'failed' na própria linha, que é o que a tela do cliente lê.
 *
 * Tem teto de 25 minutos (EVAL_RUN_TIMEOUT_MS), contado por relógio real.
 */
export async function executeRunJob(runId: string): Promise<void> {
  const run = await prisma.agentEvalRun.findUnique({
    where: { id: runId },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          systemPrompt: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
      },
    },
  });

  if (!run) {
    logger.warn({ msg: 'agent_eval_run_inexistente', runId });
    return;
  }
  if (run.status !== 'pending' && run.status !== 'running') {
    logger.info({ msg: 'agent_eval_run_ja_finalizada', runId, status: run.status });
    return;
  }

  const agent = run.agent;

  try {
    await prisma.agentEvalRun.update({ where: { id: runId }, data: { status: 'running' } });

    // Perfil da org DO AGENTE, nunca a de quem disparou: é o que impede o
    // gabarito da ZappIQ de cair sobre o agente do cliente.
    const profile = await resolveTenantAgentProfile(agent.organizationId, { agentId: agent.id });
    const scenarios = resolveScenariosForRun(profile, run.scenarioFilter);

    logger.info({
      msg: 'agent_eval_run_iniciado',
      runId,
      agentId: agent.id,
      orgId: agent.organizationId,
      scenarios: scenarios.length,
    });

    // A conclusão é gravada por ESTA continuação, e não depois do race: se o
    // teto estourar, a execução continua correndo no provedor e volta aqui
    // atrasada. É o filtro de status em gravarConclusao que a barra.
    const agenteDaRun = { id: agent.id, name: agent.name, systemPrompt: agent.systemPrompt || '' };
    const execucao = executeAgentEvalRun(scenarios, agenteDaRun, profile, {
      montarContexto: criarMontadorDeContextoDoEval(agenteDaRun, agent.organizationId),
    }).then(async (saida) => ({
      saida,
      gravacao: await gravarConclusao(runId, saida, scenarios.length),
    }));

    const { saida, gravacao } = await comTetoDeExecucao(execucao, EVAL_RUN_TIMEOUT_MS);

    if (gravacao === 'ignorada') {
      // A linha saiu de 'running' enquanto o teste rodava (varredura horária,
      // por exemplo). O resultado é descartado de propósito: a tela do cliente
      // já mostrou outra coisa, e alertar agora seria alerta de execução morta.
      logger.warn({ msg: 'agent_eval_run_conclusao_ignorada', runId, agentId: agent.id });
      return;
    }

    if (gravacao === 'falha_tecnica') {
      // A171: não houve nota. Alertar aqui seria alertar um número medido em
      // um punhado de cenários que sobraram. slackAlertStatus já foi gravado
      // como 'not_sent' na própria conclusão.
      return;
    }

    const { results, durationMs, summary } = saida;

    logger.info({
      msg: 'agent_eval_run_concluido',
      runId,
      agentId: agent.id,
      score: summary.scorePercent,
      criticalFailed: summary.criticalFailed,
    });

    await alertarSePreciso({
      run: { id: runId, triggeredBy: run.triggeredBy, agentId: agent.id },
      agentName: agent.name,
      organizationName: agent.organization?.name || '(sem nome)',
      results,
      summary,
      durationMs,
      totalScenarios: scenarios.length,
    });
  } catch (err: any) {
    const estourouOTeto = err instanceof EvalRunTimeoutError;
    logger.error({
      msg: estourouOTeto ? 'agent_eval_run_teto_estourado' : 'agent_eval_run_falhou',
      runId,
      agentId: agent.id,
      error: String(err?.message || err),
    });
    const marcou = await marcarFalha(
      runId,
      estourouOTeto ? ERRO_TETO_EXECUCAO : String(err?.message || 'unknown'),
    );
    // Não marcou: a linha já estava encerrada. Pode ter sido a conclusão
    // vencendo o relógio do teto por milissegundos, e nesse caso o alerta
    // ainda precisa ser decidido.
    if (!marcou) await fecharCorridaComOTeto(runId, agent);
  }
}

/**
 * Decide e registra o alerta. slackAlertStatus é gravado SEMPRE que a execução
 * termina: 'skipped' (nada a alertar), 'sent', 'failed' (o envio quebrou) ou
 * 'not_sent' (a execução em si falhou, então não houve o que alertar). No
 * caminho do cron ele nunca era gravado, e os 173 ciclos anteriores ficaram
 * com o campo nulo, sem como saber se alertaram.
 */
async function alertarSePreciso(input: {
  run: { id: string; triggeredBy: string; agentId: string };
  agentName: string;
  organizationName: string;
  results: Array<Record<string, any>>;
  summary: {
    passed: number;
    partial: number;
    failed: number;
    criticalFailed: number;
    erros: number;
    scorePercent: number;
  };
  durationMs: number;
  totalScenarios: number;
}): Promise<void> {
  const { run, summary, results } = input;

  // Execução concluída IMEDIATAMENTE anterior do mesmo agente. É a régua da
  // reprovação repetida: defeito que sobreviveu a um ciclo inteiro.
  const anterior = await prisma.agentEvalRun
    .findFirst({
      where: { agentId: run.agentId, status: 'completed', id: { not: run.id } },
      orderBy: { startedAt: 'desc' },
      select: { results: true },
    })
    .catch(() => null);

  const repetidos = scenariosFailingTwice(results, anterior?.results ?? null);

  if (!shouldAlertQuality(summary, { repetidos })) {
    await prisma.agentEvalRun
      .update({ where: { id: run.id }, data: { slackAlertStatus: 'skipped' } })
      .catch(() => undefined);
    return;
  }

  try {
    // A052 — a lista tem de bater com a CONTAGEM. criticalFailed conta o
    // crítico 'fail' e também o crítico 'partial' (parcial vale zero na nota),
    // mas a lista só mostrava 'fail': o alerta dizia "3 críticos reprovados" e
    // listava um. Quem abre o Slack não tinha como saber quais eram os outros.
    // Falha técnica ('erro') fica fora dos dois lados.
    const topFails = results
      .filter(
        (r) => r.combined === 'fail' || (r.severity === 'critical' && r.combined === 'partial'),
      )
      .map((r) => ({
        scenarioId: r.scenarioId,
        category: r.category,
        severity: r.severity,
      }));

    const sent = await notifySlackQualityIssue({
      agentId: run.agentId,
      agentName: input.agentName,
      organizationName: input.organizationName,
      runId: run.id,
      scorePercent: summary.scorePercent,
      passed: summary.passed,
      partial: summary.partial,
      failed: summary.failed,
      criticalFailed: summary.criticalFailed,
      totalScenarios: input.totalScenarios,
      durationMs: input.durationMs,
      topFails,
      repetidos,
      dashboardPath: run.triggeredBy === 'client_manual' ? PAINEL_CLIENTE : PAINEL_ADMIN,
    });

    await prisma.agentEvalRun
      .update({
        where: { id: run.id },
        data: {
          slackAlertStatus: sent ? 'sent' : 'failed',
          slackAlertError: sent ? null : 'sendSlackAlert retornou false',
          slackAlertSentAt: sent ? new Date() : null,
        },
      })
      .catch(() => undefined);
  } catch (slackErr: any) {
    await prisma.agentEvalRun
      .update({
        where: { id: run.id },
        data: {
          slackAlertStatus: 'failed',
          slackAlertError: String(slackErr?.message || slackErr).slice(0, 1000),
        },
      })
      .catch(() => undefined);
  }
}

/**
 * Varredura de execução presa (roda de hora em hora pela fila `cron`).
 *
 * Marca 'failed' toda execução em 'running' ou 'pending' começada há mais de
 * uma hora. Sem isso a linha fica presa para sempre no reinício de máquina, e
 * é ela que trava o botão do cliente pelo cooldown de 24 h.
 *
 * A régua é o started_at da CRIAÇÃO da linha, então uma execução que ficou
 * mais de uma hora na fila atrás de outras também é marcada. Isso é de
 * propósito: executeRunJob ignora linha que já não está pending/running, o
 * cliente vê 'failed' em vez de um girador eterno e pode disparar de novo.
 */
export async function sweepStuckEvalRuns(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - EVAL_RUN_STUCK_AFTER_MS);
  const { count } = await prisma.agentEvalRun.updateMany({
    where: {
      status: { in: ['running', 'pending'] },
      startedAt: { lt: cutoff },
    },
    data: {
      status: 'failed',
      error: ERRO_TEMPO_LIMITE,
      completedAt: now,
      slackAlertStatus: ALERTA_NAO_ENVIADO,
    },
  });

  if (count > 0) {
    logger.warn({ msg: 'agent_eval_runs_presas_marcadas_failed', count, cutoff });
  }
  return count;
}

// ─── Trava global entre as máquinas ────────────────────────────────
//
// `concurrency: 1` do worker vale por PROCESSO. O fly.toml sobe duas máquinas
// (min_machines_running = 2), então são dois workers, cada um com a sua
// concorrência 1: duas execuções simultâneas, dois testes pagos e o 429 do
// provedor que a concorrência 1 existia para evitar. A trava que vale para as
// duas máquinas precisa morar no Redis, fora do BullMQ.

/**
 * Chave única da trava: uma execução por vez entre as que passam pela fila.
 * A rota síncrona do superadmin (POST /admin/agent-eval/run) fica fora, porque
 * roda dentro do próprio processo e nunca chega ao worker.
 */
export const TRAVA_GLOBAL_CHAVE = 'zappiq:agent-eval:lock';

/**
 * Prazo da trava: o teto da execução mais um minuto de folga.
 *
 * Máquina que morre no meio não devolve a trava; é o prazo que a devolve. Ele
 * precisa passar do teto de 25 minutos, senão venceria com a execução ainda
 * viva e liberaria uma segunda por cima dela.
 */
export const TRAVA_GLOBAL_TTL_MS = EVAL_RUN_TIMEOUT_MS + 60_000;

/** Quanto o job espera antes de tentar de novo, quando a trava está ocupada. */
export const ESPERA_TRAVA_OCUPADA_MS = 30_000;

/**
 * Libera só se o valor ainda for o próprio runId. Sem essa comparação, a
 * execução que já estourou o prazo apagaria a trava de quem entrou depois.
 */
const LUA_LIBERA_TRAVA =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

/** O mínimo do cliente Redis que a trava usa. Injetável para o teste. */
export interface ClienteDeTrava {
  set(
    chave: string,
    valor: string,
    modoPx: 'PX',
    prazoMs: number,
    modoNx: 'NX',
  ): Promise<string | null>;
  eval(script: string, numKeys: number, ...args: string[]): Promise<unknown>;
}

/**
 * Tenta pegar a trava global para esta execução.
 *
 * Fail-soft deliberado: erro no Redis devolve true, ou seja, a execução segue.
 * A trava existe para não gastar LLM duas vezes, não para bloquear o produto;
 * com o Redis fora, a alternativa seria não avaliar ninguém. Como a chave não
 * chegou a ser gravada, a liberação não apaga trava de terceiro: o script
 * compara o valor antes de apagar.
 */
export async function adquirirTravaGlobal(
  runId: string,
  cliente: ClienteDeTrava = redis,
): Promise<boolean> {
  try {
    const r = await cliente.set(TRAVA_GLOBAL_CHAVE, runId, 'PX', TRAVA_GLOBAL_TTL_MS, 'NX');
    return r === 'OK';
  } catch (err: any) {
    logger.warn({
      msg: 'agent_eval_trava_indisponivel',
      runId,
      error: String(err?.message || err),
    });
    return true;
  }
}

/** Devolve a trava, se ela ainda for desta execução. */
export async function liberarTravaGlobal(
  runId: string,
  cliente: ClienteDeTrava = redis,
): Promise<boolean> {
  try {
    const n = await cliente.eval(LUA_LIBERA_TRAVA, 1, TRAVA_GLOBAL_CHAVE, runId);
    return Number(n) === 1;
  } catch (err: any) {
    logger.warn({
      msg: 'agent_eval_trava_nao_liberada',
      runId,
      error: String(err?.message || err),
    });
    return false;
  }
}

/** Dados que a fila `agent-eval` carrega. Dois tipos de trabalho. */
export interface DadosDoJobDeEval {
  /** Execução paga do teste (padrão quando `tipo` vem ausente). */
  runId?: string;
  /** 'regrade' = releitura sem LLM das execuções já gravadas (P61). */
  tipo?: 'execucao' | 'regrade';
  runIds?: string[];
  dryRun?: boolean;
}

/** O mínimo do job que o processador toca. */
type JobDeExecucao = Pick<Job<DadosDoJobDeEval>, 'id' | 'data' | 'moveToDelayed'>;

/**
 * Corpo do processador da fila `agent-eval`.
 *
 * Exportado para o teste: é aqui que mora a decisão entre executar e adiar, e
 * ela não pode depender de um Redis de verdade para ser provada.
 *
 * Adiar de dentro do processador tem um protocolo próprio no BullMQ:
 * `moveToDelayed(quando, token)` e em seguida `throw new DelayedError()`. O
 * DelayedError avisa o worker de que o job foi movido de propósito, então ele
 * não conta como falha nem consome a única tentativa.
 */
export async function processarExecucaoNaFila(
  job: JobDeExecucao,
  token?: string,
  cliente: ClienteDeTrava = redis,
): Promise<void> {
  const ehRegravacao = job.data?.tipo === 'regrade';
  // A trava é uma só, e o valor dela identifica quem a segurou: o id da
  // execução, ou o id do job de regravação.
  const donoDaTrava = ehRegravacao ? String(job.id ?? 'regrade') : job.data?.runId;

  if (!donoDaTrava) {
    logger.warn({ msg: 'agent_eval_job_sem_runid', jobId: job.id });
    return;
  }

  if (!(await adquirirTravaGlobal(donoDaTrava, cliente))) {
    logger.info({
      msg: 'agent_eval_trava_ocupada_job_adiado',
      runId: donoDaTrava,
      jobId: job.id,
    });
    await job.moveToDelayed(Date.now() + ESPERA_TRAVA_OCUPADA_MS, token);
    throw new DelayedError();
  }

  try {
    if (ehRegravacao) {
      // Revisão do PR: a regravação segura a MESMA trava global do teste pago.
      // Sem teto, um banco lento com 200 execuções na lista deixava todos os
      // clientes sem conseguir rodar o teste de qualidade deles, por tempo
      // indeterminado. O teto aborta e o `finally` devolve a trava.
      try {
        await comTetoDeExecucao(
          processarRegravacao(job.data?.runIds ?? [], job.data?.dryRun === true),
          EVAL_RUN_TIMEOUT_MS,
        );
      } catch (err: any) {
        logger.error({
          msg:
            err instanceof EvalRunTimeoutError
              ? 'agent_eval_regrade_teto_estourado'
              : 'agent_eval_regrade_falhou',
          jobId: job.id,
          execucoes: job.data?.runIds?.length ?? 0,
          error: String(err?.message || err),
        });
      }
    } else {
      await executeRunJob(donoDaTrava);
    }
  } finally {
    await liberarTravaGlobal(donoDaTrava, cliente);
  }
}

/**
 * Relê as execuções da lista, uma a uma.
 *
 * Falha numa execução (results corrompido, por exemplo) não derruba as
 * outras: o fundador clicou uma vez e espera o resumo do que deu para reler.
 */
async function processarRegravacao(runIds: string[], dryRun: boolean): Promise<void> {
  let relidas = 0;
  for (const runId of runIds) {
    try {
      await regradeRun(runId, { dryRun });
      relidas++;
    } catch (err: any) {
      logger.warn({
        msg: 'agent_eval_regrade_falhou',
        runId,
        error: String(err?.message || err),
      });
    }
  }
  logger.info({ msg: 'agent_eval_regrade_concluida', pedidas: runIds.length, relidas, dryRun });
}

// ─── Worker ────────────────────────────────────────────────────────
let worker: Worker | undefined;

export async function initAgentEvalQueue(): Promise<void> {
  worker = new Worker(
    AGENT_EVAL_QUEUE_NAME,
    (job: Job<{ runId: string }>, token?: string) => processarExecucaoNaFila(job, token),
    {
      connection,
      // 1 de propósito: os cenários já são sequenciais e o gargalo é o limite
      // de taxa do provedor. Paralelizar aqui só produziria 429.
      //
      // Atenção: isto vale por PROCESSO, e o Fly sobe duas máquinas. Quem
      // garante uma execução por vez na frota é a trava do Redis, dentro de
      // processarExecucaoNaFila.
      concurrency: 1,
      // Protege contra máquina MORTA (o BullMQ renova o lock enquanto o
      // processador está vivo). O teto de verdade é o relógio em executeRunJob.
      lockDuration: EVAL_RUN_TIMEOUT_MS,
      // Custo do Upstash: worker ocioso gasta cerca de 8 comandos a cada
      // drainDelay, 24/7. Esta é fila de TRABALHO (sem job repetível), então o
      // drainDelay longo vale aqui, ao contrário da fila `cron`. Sem isto, a
      // fila nova reintroduziria parte do gasto que a consolidação cortou.
      // `Queue.add` destrava o bloqueio na hora, então nenhum teste atrasa.
      drainDelay: IDLE_DRAIN_DELAY_SECONDS,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({
      msg: 'agent_eval_job_failed',
      jobId: job?.id,
      error: String(err?.message ?? err),
    });
  });

  worker.on('error', (err) => {
    logger.warn(`[agentEvalQueue] erro no worker: ${err.message}`);
  });

  logger.info({ msg: 'agent_eval_queue_pronta' });
}

export async function closeAgentEvalQueue(): Promise<void> {
  await worker?.close();
  await queue?.close();
  worker = undefined;
  queue = null;
}
