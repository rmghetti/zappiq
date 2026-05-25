/**
 * Agent Eval Cron Service (FASE 2 / V5 — task #238/#241)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Objetivo
 * ═══════════════════════════════════════════════════════════════════════════
 * Roda diariamente às 04:30 UTC (10min depois do usage-reconciliation pra não
 * concorrer por bandwidth Anthropic). Pra cada agent com `isActive=true`:
 *
 *   1. Cria row pending em AgentEvalRun (triggeredBy='cron')
 *   2. Executa golden set completo via executeRunLoop()
 *   3. Persiste resultado em AgentEvalRun
 *   4. Se scorePercent < 90 OU criticalFailed > 0 → dispara Slack alert
 *
 * Padrão de eval: idêntico ao endpoint /run-async (mesmo helper compartilhado),
 * só que disparado em loop por todos os agents.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Por que cron diário e não on-demand
 * ═══════════════════════════════════════════════════════════════════════════
 * - Detecta drift silencioso: agent foi treinado pelo cliente, prompt mudou,
 *   regex novo do core rules quebrou comportamento — sem cron, ninguém vê.
 * - Histórico contínuo: dashboard /admin/agent-quality vai mostrar score over
 *   time. Gaps no histórico tornam regressão difícil de localizar.
 * - Slack alert = signal early. Não esperar cliente reclamar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Limite de custo
 * ═══════════════════════════════════════════════════════════════════════════
 * Hoje: 1 agent ativo (Iza). 25 cenários × 2 LLM calls = 50 calls × $0.005
 * = ~$0.25/dia/agent = ~$7.50/mês.
 *
 * Quando crescer pra 50+ agents, mover pra eval semanal por padrão e diário
 * só pra agents flagados como "high-traffic" (config no Agent model).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Threshold de alerta (configurável via env)
 * ═══════════════════════════════════════════════════════════════════════════
 *   AGENT_EVAL_ALERT_SCORE_MIN  (default: 90)  — alert se score < 90%
 *   AGENT_EVAL_ALERT_CRITICAL   (default: 1)   — alert se criticalFailed >= 1
 *   SLACK_WEBHOOK_AGENT_QUALITY (sem default)  — onde mandar
 *     Fallback: SLACK_WEBHOOK_QUOTA_ALERTS (canal único de ops é OK pra MVP)
 */

import { Queue, Worker } from 'bullmq';
import { prisma } from '@zappiq/database';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  sendSlackAlert,
  buildHeaderBlock,
  buildSectionBlock,
  buildFieldsBlock,
  buildContextBlock,
  buildDividerBlock,
} from './slackNotifier.js';
import { CORE_RULES_VERSION } from '../agents/coreAgentRules.js';
import {
  AGENT_EVAL_SET,
  EVAL_SET_VERSION,
} from '../agents/agentEvalSet.js';
import { executeAgentEvalRun } from './agentEvalRunner.js';

// ─── BullMQ connection (mesma config dos outros crons) ─────────
const redisUrl = new URL(env.REDIS_URL);
const isTLS = env.REDIS_URL.startsWith('rediss://');
const connection = {
  host: redisUrl.hostname || 'localhost',
  port: Number(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
  username: redisUrl.username || undefined,
  ...(isTLS ? { tls: { rejectUnauthorized: false } } : {}),
};

export const agentEvalCronQueue = new Queue('agent-eval-cron', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 50 },
    attempts: 1, // não retry — se o job todo falha, próximo dia roda fresh
  },
});

let agentEvalCronWorker: Worker | null = null;

// ─── Org da Iza (agente do SUPERADMIN / Cliente Zero) ──────────
// Mesmo id canonical usado em adminLeadsIza.ts, LLMRouter.ts, tools.ts.
// A auditoria automática da Iza roda DIÁRIA (o CEO controla de perto);
// agentes de clientes rodam SEMANAL (corta custo de tokens do cron).
const IZA_ORG_ID = 'cmo1ywwfe00ko1jskexiexsm4';

// Escopo do ciclo: 'iza' = só o agente da org da Iza (diário);
// 'clients' = todos os agents live EXCETO a org da Iza (semanal);
// 'all' = todos (usado por triggers manuais/legados).
type CronScope = 'iza' | 'clients' | 'all';

// ─── Thresholds ─────────────────────────────────────────────────
const SCORE_MIN = Number(process.env.AGENT_EVAL_ALERT_SCORE_MIN ?? 90);
const CRITICAL_MIN = Number(process.env.AGENT_EVAL_ALERT_CRITICAL ?? 1);

// FASE 2.1 (2026-05-13): exportado pra ser reusado em /run-async manual.
// Antes só rodava em runAgentEvalCronCycle, então runs manuais nunca
// alertavam mesmo quando estouravam threshold. Bug capturado em
// produção (run 13/05 72% sem notificação Slack).
export function shouldAlertQuality(summary: {
  scorePercent: number;
  criticalFailed: number;
}): boolean {
  return summary.scorePercent < SCORE_MIN || summary.criticalFailed >= CRITICAL_MIN;
}

export { SCORE_MIN as AGENT_EVAL_ALERT_SCORE_MIN };

// ─── Slack notifier (exportado pra reuso em route /run-async) ──
export async function notifySlackQualityIssue(input: {
  agentId: string;
  agentName: string;
  organizationName: string;
  runId: string;
  scorePercent: number;
  passed: number;
  partial: number;
  failed: number;
  criticalFailed: number;
  totalScenarios: number;
  durationMs: number;
  topFails: Array<{ scenarioId: string; category: string; severity: string }>;
}): Promise<boolean> {
  const webhook =
    process.env.SLACK_WEBHOOK_AGENT_QUALITY || process.env.SLACK_WEBHOOK_QUOTA_ALERTS;

  if (!webhook) {
    logger.warn('[agentEvalCron] sem webhook Slack configurado — alerta apenas em logs');
    return false;
  }

  const severity = input.criticalFailed > 0 ? '🚨 CRITICAL' : '⚠️ WARNING';
  // FASE 2.1: APP_URL deveria apontar pra https://zappiq.com.br (não
  // app.zappiq.com.br que não existe). Mantemos fallback correto.
  const baseUrl = process.env.APP_URL || 'https://zappiq.com.br';

  const topFailsLines = input.topFails
    .slice(0, 5)
    .map((f) => `• \`${f.scenarioId}\` (${f.category}, ${f.severity})`)
    .join('\n') || '_nenhum fail listado_';

  // FASE 2.2c (#246): payload SIMPLIFICADO. /test-slack chegava mas
  // notifyQualityIssue não — 6 blocks com fields+context pareciam estar
  // falhando silenciosamente em algum filtro do Slack. Mudamos para um
  // único section block markdown (mesmo padrão do /test-slack que funciona)
  // + emoji unicode em vez de `:chart_with_downwards_trend:` (que pode
  // causar reject silencioso em alguns workspaces).
  const messageMarkdown = [
    `*${severity} — Qualidade do Agente abaixo do limiar*`,
    '',
    `*Agente:* ${input.agentName} (${input.organizationName})`,
    `*Score:* ${input.scorePercent}% (limiar ${SCORE_MIN}%)`,
    `*Aprovados:* ${input.passed}/${input.totalScenarios} · *Parciais:* ${input.partial} · *Reprovados:* ${input.failed} · *Críticos:* ${input.criticalFailed}`,
    `*Duração:* ${(input.durationMs / 1000).toFixed(1)}s`,
    '',
    `*Top falhas:*`,
    topFailsLines,
    '',
    `runId \`${input.runId}\` · eval ${EVAL_SET_VERSION} · core ${CORE_RULES_VERSION}`,
    `<${baseUrl}/admin/agent-quality|🔗 Abrir dashboard>`,
  ].join('\n');

  return sendSlackAlert({
    webhook,
    text: `${severity} Agent ${input.agentName} score ${input.scorePercent}% (criticalFailed=${input.criticalFailed})`,
    blocks: [buildSectionBlock(messageMarkdown)],
    username: 'ZappIQ QA Bot',
  });
}

// ─── Core loop: itera por agents ativos do escopo ─────────────
export async function runAgentEvalCronCycle(scope: CronScope = 'all'): Promise<{
  agentsProcessed: number;
  agentsAlerted: number;
  agentsFailed: number;
  durationMs: number;
}> {
  const startedAt = Date.now();
  logger.info(`[agentEvalCron] cycle iniciado (scope=${scope})`);

  // Lista agents 'live' (Iza canonical + futuros agents de clientes ativos).
  // Agent.status enum: 'draft' | 'reviewed' | 'live' — só rodamos eval em live.
  // Escopo:
  //   'iza'     → só a org da Iza (diário, controle do CEO)
  //   'clients' → todas as orgs EXCETO a Iza (semanal, custo controlado)
  //   'all'     → todas (compat com triggers manuais)
  const orgFilter =
    scope === 'iza'
      ? { organizationId: IZA_ORG_ID }
      : scope === 'clients'
        ? { organizationId: { not: IZA_ORG_ID } }
        : {};

  const agents = await prisma.agent.findMany({
    where: { status: 'live', ...orgFilter },
    include: {
      organization: { select: { id: true, name: true } },
    },
  });

  let agentsProcessed = 0;
  let agentsAlerted = 0;
  let agentsFailed = 0;

  for (const agent of agents) {
    try {
      // 1. Cria row pending
      const run = await prisma.agentEvalRun.create({
        data: {
          agentId: agent.id,
          status: 'running',
          evalSetVersion: EVAL_SET_VERSION,
          coreRulesVersion: CORE_RULES_VERSION,
          triggeredBy: 'cron',
          scenarioFilter: {
            source: scope === 'iza' ? 'cron_daily_iza' : 'cron_weekly',
            all: true,
          } as any,
          totalScenarios: AGENT_EVAL_SET.length,
        },
      });

      // 2. Executa eval completo
      const { results, durationMs, summary } = await executeAgentEvalRun(
        AGENT_EVAL_SET,
        { id: agent.id, name: agent.name, systemPrompt: agent.systemPrompt || '' },
      );

      // 3. Persiste
      await prisma.agentEvalRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          passed: summary.passed,
          partial: summary.partial,
          failed: summary.failed,
          criticalFailed: summary.criticalFailed,
          scorePercent: summary.scorePercent,
          results: results as any,
          completedAt: new Date(),
          durationMs,
        },
      });

      agentsProcessed++;
      logger.info({
        msg: 'agent_eval_cron_run_completed',
        agentId: agent.id,
        runId: run.id,
        score: summary.scorePercent,
        criticalFailed: summary.criticalFailed,
      });

      // 4. Slack alert se threshold cruzado
      if (shouldAlertQuality(summary)) {
        const topFails = (results as any[])
          .filter((r) => r.combined === 'fail')
          .map((r) => ({
            scenarioId: r.scenarioId,
            category: r.category,
            severity: r.severity,
          }));

        const sent = await notifySlackQualityIssue({
          agentId: agent.id,
          agentName: agent.name,
          organizationName: agent.organization.name,
          runId: run.id,
          scorePercent: summary.scorePercent,
          passed: summary.passed,
          partial: summary.partial,
          failed: summary.failed,
          criticalFailed: summary.criticalFailed,
          totalScenarios: AGENT_EVAL_SET.length,
          durationMs,
          topFails,
        });
        if (sent) agentsAlerted++;
      }
    } catch (err: any) {
      agentsFailed++;
      logger.error({
        msg: 'agent_eval_cron_run_failed',
        agentId: agent.id,
        error: String(err?.message || err),
      });
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.info({
    msg: 'agent_eval_cron_cycle_completed',
    agentsProcessed,
    agentsAlerted,
    agentsFailed,
    durationMs,
  });

  return { agentsProcessed, agentsAlerted, agentsFailed, durationMs };
}

// ─── BullMQ bootstrap ──────────────────────────────────────────
export async function initAgentEvalCronJob(): Promise<void> {
  agentEvalCronWorker = new Worker(
    'agent-eval-cron',
    async (job) => {
      // Kill-switch de custo: AGENT_EVAL_CRON_DISABLED=true pausa a auditoria
      // automática sem precisar deploy (rede de segurança durante o teste).
      if (process.env.AGENT_EVAL_CRON_DISABLED === 'true') {
        logger.warn('[agentEvalCron] AGENT_EVAL_CRON_DISABLED=true — ciclo pulado (kill-switch).');
        return { agentsProcessed: 0, agentsAlerted: 0, agentsFailed: 0, durationMs: 0 };
      }
      // Escopo derivado do nome do job:
      //   'daily-agent-eval-iza' → só a Iza (diário)
      //   'weekly-agent-eval'    → só clientes (semanal)
      const scope: CronScope = job.name === 'daily-agent-eval-iza' ? 'iza' : 'clients';
      return runAgentEvalCronCycle(scope);
    },
    { connection, concurrency: 1 }, // 1 cycle por vez — sequencial entre agents
  );

  agentEvalCronWorker.on('failed', (job, err) => {
    logger.error(`[agentEvalCron] Job ${job?.id} falhou`, { error: err.message });
  });

  agentEvalCronWorker.on('completed', (job, result) => {
    logger.info(`[agentEvalCron] Job ${job.id} concluído`, result as Record<string, unknown>);
  });

  // Custo: a auditoria automática de CLIENTES roda SEMANAL (segundas 04:30 UTC)
  // — corta ~85% do consumo de tokens do cron mantendo a vigília. A Iza (agente
  // do SUPERADMIN / Cliente Zero) roda DIÁRIA (04:30 UTC) pra o CEO controlar
  // de perto. Dois jobs separados, escopo derivado do nome (ver Worker acima).
  //
  // Remove o agendamento diário ÚNICO antigo (rodava em TODOS os agents) pra
  // não rodar duplicado com o novo diário-só-Iza.
  try {
    await agentEvalCronQueue.removeRepeatable('daily-agent-eval', { pattern: '30 4 * * *' }, 'agent-eval-cron-daily');
  } catch { /* fail-soft: pode não existir */ }

  // DIÁRIO — só a org da Iza.
  await agentEvalCronQueue.add(
    'daily-agent-eval-iza',
    {},
    {
      repeat: { pattern: '30 4 * * *' }, // todo dia 04:30 UTC
      jobId: 'agent-eval-cron-iza-daily',
    },
  );

  // SEMANAL — clientes (todas as orgs exceto a Iza).
  await agentEvalCronQueue.add(
    'weekly-agent-eval',
    {},
    {
      repeat: { pattern: '30 4 * * 1' }, // segundas 04:30 UTC
      jobId: 'agent-eval-cron-weekly',
    },
  );

  logger.info('[agentEvalCron] Jobs agendados (Iza diário 04:30 UTC + clientes semanal segundas 04:30 UTC)');
}

export async function closeAgentEvalCronJob(): Promise<void> {
  await agentEvalCronWorker?.close();
  await agentEvalCronQueue.close();
}
