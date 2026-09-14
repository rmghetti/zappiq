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
import { Queue, Worker, type Job } from 'bullmq';
import { prisma } from '@zappiq/database';

import { queueConnection as connection } from '../config/queueRedis.js';
import { logger } from '../utils/logger.js';
import { resolveEvalSet } from '../agents/agentEvalSet.js';
import type { EvalScenario } from '../agents/evalScenarioTypes.js';
import type { TenantAgentProfile } from '../agents/tenantAgentProfile.js';
import { resolveTenantAgentProfile } from '../agents/tenantAgentProfile.js';
import { executeAgentEvalRun } from './agentEvalRunner.js';
import {
  notifySlackQualityIssue,
  scenariosFailingTwice,
  shouldAlertQuality,
} from './agentEvalCronService.js';

export const AGENT_EVAL_QUEUE_NAME = 'agent-eval';

/** Teto por execução. O pior caso medido (38 min) fica de fora de propósito. */
export const EVAL_RUN_TIMEOUT_MS = 25 * 60 * 1000;

/** A partir daqui uma execução parada é considerada morta. */
export const EVAL_RUN_STUCK_AFTER_MS = 60 * 60 * 1000;

/** Erro gravado pela varredura. Texto estável: a UI mostra para o cliente. */
export const ERRO_TEMPO_LIMITE = 'tempo limite: execução em running há mais de 1 hora';

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

/**
 * Enfileira a execução já criada em AgentEvalRun.
 *
 * jobId = runId: se a mesma execução for enfileirada duas vezes (retry de
 * rota, dois nós do Fly), o BullMQ descarta a segunda.
 */
export async function enqueueEvalRun(runId: string): Promise<void> {
  await getAgentEvalQueue().add(
    'run',
    { runId },
    { jobId: runId, removeOnComplete: true },
  );
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

/**
 * Executa uma linha de AgentEvalRun de ponta a ponta.
 *
 * Idempotente: execução que já saiu de 'pending'/'running' não roda de novo,
 * porque repetir custa dinheiro de LLM. Nunca lança: o erro vira status
 * 'failed' na própria linha, que é o que a tela do cliente lê.
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

    const { results, durationMs, summary } = await executeAgentEvalRun(
      scenarios,
      { id: agent.id, name: agent.name, systemPrompt: agent.systemPrompt || '' },
      profile,
    );

    await prisma.agentEvalRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        ...summary,
        results: results as any,
        completedAt: new Date(),
        durationMs,
      },
    });

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
      organizationName: agent.organization?.name || '—',
      results,
      summary,
      durationMs,
      totalScenarios: scenarios.length,
    });
  } catch (err: any) {
    logger.error({
      msg: 'agent_eval_run_falhou',
      runId,
      agentId: agent.id,
      error: String(err?.message || err),
    });
    await prisma.agentEvalRun
      .update({
        where: { id: runId },
        data: {
          status: 'failed',
          error: String(err?.message || 'unknown'),
          completedAt: new Date(),
        },
      })
      .catch(() => undefined);
  }
}

/**
 * Decide e registra o alerta. slackAlertStatus é gravado SEMPRE ('skipped',
 * 'sent' ou 'failed'): no caminho do cron ele nunca era gravado, e os 173
 * ciclos anteriores ficaram com o campo nulo, sem como saber se alertaram.
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
    const topFails = results
      .filter((r) => r.combined === 'fail')
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
    },
  });

  if (count > 0) {
    logger.warn({ msg: 'agent_eval_runs_presas_marcadas_failed', count, cutoff });
  }
  return count;
}

// ─── Worker ────────────────────────────────────────────────────────
let worker: Worker | undefined;

export async function initAgentEvalQueue(): Promise<void> {
  worker = new Worker(
    AGENT_EVAL_QUEUE_NAME,
    async (job: Job<{ runId: string }>) => {
      const runId = job.data?.runId;
      if (!runId) {
        logger.warn({ msg: 'agent_eval_job_sem_runid', jobId: job.id });
        return;
      }
      await executeRunJob(runId);
    },
    {
      connection,
      // 1 de propósito: os cenários já são sequenciais e o gargalo é o limite
      // de taxa do provedor. Paralelizar aqui só produziria 429.
      concurrency: 1,
      lockDuration: EVAL_RUN_TIMEOUT_MS,
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
