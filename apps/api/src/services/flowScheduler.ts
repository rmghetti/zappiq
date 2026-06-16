/**
 * ZappIQ Maestro v2 — flowScheduler (fila flow-timer)
 * ============================================================================
 * Agenda e dispara retomadas de fluxo (nós wait/schedule). Design:
 *
 *   FONTE DA VERDADE = tabela FlowTimer (Postgres). O job BullMQ é só um
 *   "despertador": carrega o timerId e TODA a decisão de disparar acontece
 *   no momento do fire, revalidando contra o estado ATUAL do mundo
 *   (flow ativo? versão igual? IA pausada? cliente respondeu? janela 24h?).
 *   Fail-closed: qualquer condição inválida cancela/expira o timer em vez
 *   de mandar mensagem — um timer nunca "vaza" mensagem indevida.
 *
 *   ENCADEAMENTO DE TIMERS: se a retomada para em OUTRO wait/schedule, o
 *   worker agenda o próximo timer — sequências drip (mensagem → wait →
 *   mensagem → wait → mensagem) avançam sozinhas, sem depender de inbound.
 *   Retomada que para em nó-IA gera a resposta via flowAiResume (caminho
 *   leve de LLM) e envia como send_text; se a geração falhar (fail-closed),
 *   o cursor é persistido e o próximo inbound continua pelo orchestrator.
 *
 * Partes puras (testáveis sem infra): computeRunAt + validateTimerFire +
 * buildStoredFlowState.
 * ============================================================================
 */
import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '@zappiq/database';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { cache } from './cloud/index.js';
import {
  resolveFlowStep,
  type FlowGraph,
  type FlowNode,
  type FlowEdge,
  type FlowState,
  type FlowSchedule,
} from '../agents/flowEngine.js';
import { executeFlowEffects } from '../agents/flowEffects.js';
// Retomada em nó-IA: caminho leve de geração (contexto do negócio + histórico
// + instrução do nó). Fail-closed: null em falha → warn + cursor persistido.
import { generateAiResumeReply } from '../agents/flowAiResume.js';
import { buildEvalContext } from '../agents/evalContextBuilder.js';
import { recordNodeStats } from './flowAnalytics.js';

// ── Conexão Redis para BullMQ ────────────────────
// Espelha queueService.ts (BullMQ requer conexão própria, não reutiliza
// o ioredis do app). Mantido em sincronia manual — mesma config.
const redisUrl = new URL(env.REDIS_URL);
const isTLS = env.REDIS_URL.startsWith('rediss://');
const connection = {
  host: redisUrl.hostname || 'localhost',
  port: Number(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
  username: redisUrl.username || undefined,
  ...(isTLS ? { tls: { rejectUnauthorized: false } } : {}),
  maxRetriesPerRequest: null,              // BullMQ requirement for workers
  enableReadyCheck: false,                 // avoid LOADING errors on reconnect
  keepAlive: 10_000,                       // ping every 10s — prevents Upstash idle disconnect
  retryStrategy(times: number) {
    if (times > 30) return null;           // give up after 30 retries
    return Math.min(times * 300, 15_000);  // 300ms, 600ms, ... max 15s
  },
  reconnectOnError(err: Error) {
    const retryable = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'READONLY'];
    return retryable.some((e) => err.message.includes(e));
  },
};

// ── Constantes de estado do fluxo ────────────────
// Duplicadas de flowRuntime.ts (não exportadas lá; importar o runtime aqui
// criaria acoplamento desnecessário do scheduler com o wrapper de inbound).
// MANTER EM SINCONIA com flowRuntime.ts.
const FLOW_STATE_TTL = 60 * 60 * 24 * 7; // 7 dias
const FLOW_ENDED = '__ended__';
function flowStateKey(orgId: string, conversationId: string): string {
  return `flow_state:${orgId}:${conversationId}`;
}

/** Janela de 24h da Meta: fora dela, mensagem livre é proibida (só template). */
const META_WINDOW_MS = 24 * 60 * 60 * 1000;

// ── Fila ─────────────────────────────────────────

/** Fila de timers de fluxo (wait/schedule) — job é só um despertador com timerId. */
export const flowTimerQueue = new Queue('flow-timer', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 2000 },
    removeOnFail: { count: 1000 },
  },
});

// ── Funções puras ────────────────────────────────

/**
 * Calcula o instante de disparo a partir do schedule emitido pelo motor.
 * Regras: runAt absoluto válido E futuro tem precedência; runAt passado ou
 * inválido é clampado pra now+1min (evita rajada retroativa ao restaurar
 * timers antigos); senão delayMinutes (default 1).
 */
export function computeRunAt(schedule: FlowSchedule, now: Date): Date {
  if (schedule.runAt) {
    const abs = new Date(schedule.runAt);
    if (!Number.isNaN(abs.getTime())) {
      if (abs.getTime() > now.getTime()) return abs;
      // runAt no passado → clamp: dispara em 1min, nunca retroativo
      return new Date(now.getTime() + 60_000);
    }
    // runAt inválido → mesmo clamp defensivo
    return new Date(now.getTime() + 60_000);
  }
  const mins = schedule.delayMinutes && schedule.delayMinutes > 0 ? schedule.delayMinutes : 1;
  return new Date(now.getTime() + mins * 60_000);
}

export interface TimerFireContext {
  timer: { kind: string; flowVersion: number; status: string };
  flow: { isActive: boolean; version: number } | null;
  /** IA pausada (handoff humano ativo) — espelha a pause key do orchestrator. */
  aiPaused: boolean;
  lastInboundAt: Date | null;
  timerCreatedAt: Date;
  now: Date;
}

export type TimerFireVerdict =
  | { ok: true }
  | { ok: false; status: 'cancelled' | 'expired'; reason: string };

/**
 * Validação fail-closed no momento do disparo. Ordem dos checks importa:
 * condições estruturais (timer/fluxo) antes das conversacionais (takeover,
 * resposta do cliente, janela da Meta).
 */
export function validateTimerFire(ctx: TimerFireContext): TimerFireVerdict {
  const { timer, flow, aiPaused, lastInboundAt, timerCreatedAt, now } = ctx;

  // Timer já consumido/cancelado (corrida com cancelamento ou retry duplicado)
  if (timer.status !== 'pending') {
    return { ok: false, status: 'cancelled', reason: 'not_pending' };
  }
  // Fluxo deletado ou despublicado
  if (!flow || !flow.isActive) {
    return { ok: false, status: 'cancelled', reason: 'flow_inactive' };
  }
  // Publish/restore criou nova versão — o grafo do timer não existe mais
  if (flow.version !== timer.flowVersion) {
    return { ok: false, status: 'cancelled', reason: 'flow_version_changed' };
  }
  // Takeover humano (IA pausada) — humano assumiu, robô não interrompe
  if (aiPaused) {
    return { ok: false, status: 'cancelled', reason: 'human_takeover' };
  }
  // wait: o timer é o ramo de TIMEOUT. Se o cliente respondeu depois do
  // agendamento, o timeout perdeu o sentido. schedule NÃO cancela por resposta.
  if (timer.kind === 'wait' && lastInboundAt && lastInboundAt.getTime() > timerCreatedAt.getTime()) {
    return { ok: false, status: 'cancelled', reason: 'customer_replied' };
  }
  // Janela de 24h da Meta: sem inbound recente, mensagem livre é proibida
  if (!lastInboundAt || now.getTime() - lastInboundAt.getTime() > META_WINDOW_MS) {
    return { ok: false, status: 'expired', reason: 'meta_24h_window' };
  }
  return { ok: true };
}

/**
 * Decide o estado a persistir no cache após um walk — MESMA regra do
 * flowRuntime (manter em sincronia): cursor non-null → conversa continua no
 * fluxo (salva COM flowId pro próximo inbound retomar no lugar certo);
 * cursor null → ENDED (Iza pura assume; timers futuros retomam do snapshot
 * do FlowTimer, não do cache).
 */
export function buildStoredFlowState(state: FlowState | undefined, flowId: string): Record<string, unknown> {
  const cursor = state?.cursor ?? null;
  const callStack = (state as any)?.callStack ?? [];
  if (cursor !== null) return { ...state, flowId, callStack };
  return { cursor: FLOW_ENDED, vars: state?.vars || {}, callStack: [] };
}

// ── Agendamento ──────────────────────────────────

export interface ScheduleFlowTimerInput {
  organizationId: string;
  conversationId: string;
  flowId: string;
  flowVersion: number;
  schedule: FlowSchedule;
  state: FlowState;
}

/**
 * Persiste o FlowTimer (fonte da verdade) e enfileira o despertador BullMQ.
 * O snapshot guarda o cursor de RETOMADA (resumeNodeId) — o worker retoma
 * o walk a partir dele com hasIncomingMessage=false.
 */
export async function scheduleFlowTimer(input: ScheduleFlowTimerInput): Promise<void> {
  const { organizationId, conversationId, flowId, flowVersion, schedule, state } = input;
  if (!schedule.resumeNodeId) {
    // Sem nó de retomada o timer não teria onde acordar — nada a agendar.
    logger.warn('[FlowScheduler] schedule sem resumeNodeId — ignorado', { organizationId, conversationId, flowId });
    return;
  }

  const now = new Date();
  const runAt = computeRunAt(schedule, now);

  if (Array.isArray((state as any).callStack) && (state as any).callStack.length > 0) {
    logger.warn('[FlowScheduler] timer agendado dentro de um subfluxo — o retorno ao chamador NÃO dispara automaticamente na retomada por timer (limitação 1C v1); o callStack é preservado para retomada por inbound.', { organizationId, conversationId, flowId, depth: (state as any).callStack.length });
  }

  const timer = await prisma.flowTimer.create({
    data: {
      organizationId,
      conversationId,
      flowId,
      flowVersion,
      kind: schedule.kind,
      resumeNodeId: schedule.resumeNodeId,
      stateSnapshot: { cursor: schedule.resumeNodeId, vars: state.vars ?? {}, callStack: (state as any).callStack ?? [] },
      runAt,
    },
  });

  const jobId = `flow-timer:${timer.id}`;
  await flowTimerQueue.add(
    'fire',
    { timerId: timer.id },
    { delay: Math.max(0, runAt.getTime() - now.getTime()), jobId },
  );
  await prisma.flowTimer.update({ where: { id: timer.id }, data: { jobId } });

  logger.info('[FlowScheduler] Timer agendado', {
    organizationId, conversationId, flowId,
    timerId: timer.id, kind: schedule.kind, runAt: runAt.toISOString(),
  });
}

/**
 * Cancela timers 'wait' pendentes da conversa — chamado quando o cliente
 * responde (a resposta cancela o ramo de timeout). Timers 'schedule' ficam.
 * Remoção do job BullMQ é best-effort: o status no banco é a fonte da verdade
 * e o worker revalida no fire de qualquer forma.
 */
export async function cancelPendingWaitTimers(
  organizationId: string,
  conversationId: string,
): Promise<void> {
  const timers = await prisma.flowTimer.findMany({
    where: { organizationId, conversationId, status: 'pending', kind: 'wait' },
    select: { id: true, jobId: true },
  });
  if (timers.length === 0) return;

  await prisma.flowTimer.updateMany({
    where: { id: { in: timers.map((t) => t.id) } },
    data: { status: 'cancelled', statusReason: 'customer_replied' },
  });

  for (const t of timers) {
    if (!t.jobId) continue;
    try {
      await flowTimerQueue.remove(t.jobId);
    } catch {
      // Job já consumido/inexistente — irrelevante: o fire revalida e cancela.
    }
  }

  logger.info('[FlowScheduler] Wait timers cancelados (cliente respondeu)', {
    organizationId, conversationId, count: timers.length,
  });
}

// ── Worker ───────────────────────────────────────

let flowTimerWorker: Worker | undefined;

/**
 * Inicializa o worker da fila flow-timer. No fire: recarrega timer + fluxo +
 * conversa do banco, revalida tudo (fail-closed) e só então retoma o walk no
 * resumeNodeId, executa efeitos e persiste o cursor no MESMO formato de cache
 * do flowRuntime (flow_state:{org}:{conv}).
 */
export function initFlowTimerWorker(): void {
  flowTimerWorker = new Worker(
    'flow-timer',
    async (job: Job) => {
      const { timerId } = job.data as { timerId: string };

      const timer = await prisma.flowTimer.findUnique({ where: { id: timerId } });
      if (!timer) {
        logger.warn('[FlowScheduler] Timer não encontrado no fire', { timerId });
        return;
      }

      // Estado atual do mundo — tudo recarregado no momento do disparo.
      const [flow, conversation, lastInbound] = await Promise.all([
        prisma.flow.findUnique({
          where: { id: timer.flowId },
          select: { isActive: true, version: true, nodes: true, edges: true },
        }),
        prisma.conversation.findUnique({
          where: { id: timer.conversationId },
          select: { contactId: true, contact: { select: { phone: true } } },
        }),
        prisma.message.findFirst({
          where: { conversationId: timer.conversationId, direction: 'INBOUND' },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

      // Pausa da IA: espelha o agentOrchestrator — pause key no cache por
      // org+telefone; valor 'autoreply' é legacy do Plan B e NÃO conta como pausa.
      let aiPaused = false;
      const contactPhone = conversation?.contact?.phone;
      if (contactPhone) {
        // Redis indisponível → cache.get retorna null → considera não-pausado (fail-open consciente; janela pequena e baixa severidade).
        const pauseValue = await cache.get(`ai_paused:${timer.organizationId}:${contactPhone}`);
        aiPaused = !!pauseValue && pauseValue !== 'autoreply';
      }

      const verdict = validateTimerFire({
        timer: { kind: timer.kind, flowVersion: timer.flowVersion, status: timer.status },
        flow: flow ? { isActive: flow.isActive, version: flow.version } : null,
        aiPaused,
        lastInboundAt: lastInbound?.createdAt ?? null,
        timerCreatedAt: timer.createdAt,
        now: new Date(),
      });

      if (!verdict.ok) {
        // not_pending: timer já está em status terminal (fired/cancelled) — não
        // sobrescrever o status com update, apenas logar e sair.
        if (verdict.reason === 'not_pending') {
          logger.info('[FlowScheduler] Timer já tratado — ignorado (not_pending)', {
            timerId: timer.id, currentStatus: timer.status,
          });
          return;
        }
        await prisma.flowTimer.update({
          where: { id: timer.id },
          data: { status: verdict.status, statusReason: verdict.reason },
        });
        logger.info('[FlowScheduler] Timer não disparado (fail-closed)', {
          timerId: timer.id, status: verdict.status, reason: verdict.reason,
        });
        return;
      }

      // Claim atômico pending→fired ANTES de enviar efeitos: retry do BullMQ ou
      // corrida com cancelPendingWaitTimers nunca pode reenviar mensagem ao cliente.
      // Falha após o claim = retomada perdida (fail-closed), nunca mensagem duplicada.
      const claimed = await prisma.flowTimer.updateMany({
        where: { id: timer.id, status: 'pending' },
        data: { status: 'fired', firedAt: new Date() },
      });
      if (claimed.count === 0) {
        logger.info('[Maestro] timer já tratado por outro caminho — bail', { timerId: timer.id });
        return;
      }

      // Retomada: walk a partir do snapshot, SEM mensagem nova do usuário.
      const graph: FlowGraph = {
        nodes: Array.isArray(flow!.nodes) ? (flow!.nodes as unknown as FlowNode[]) : [],
        edges: Array.isArray(flow!.edges) ? (flow!.edges as unknown as FlowEdge[]) : [],
      };
      const snapshot = (timer.stateSnapshot ?? { cursor: timer.resumeNodeId, vars: {} }) as unknown as FlowState;
      const orgRow = await prisma.organization.findUnique({
        where: { id: timer.organizationId },
        select: { settings: true },
      });
      const ctx = await buildEvalContext({ contactId: conversation?.contactId, orgSettings: orgRow?.settings });
      const result = resolveFlowStep(graph, snapshot, '', { hasIncomingMessage: false, ctx });

      try {
        await recordNodeStats({
          organizationId: timer.organizationId,
          flowId: timer.flowId,
          graph: { nodes: Array.isArray(flow?.nodes) ? (flow!.nodes as any[]) : [] },
          visitedNodeIds: result.visitedNodeIds ?? [],
          ended: result.next === 'end',
        });
      } catch { /* fail-soft */ }

      try {
        // goto_flow em retomada por timer não é suportado (troca de fluxo é papel
        // do runtime de inbound) — filtra pra não vazar pro executor.
        await executeFlowEffects({
          organizationId: timer.organizationId,
          conversationId: timer.conversationId,
          contactId: conversation?.contactId ?? null,
          effects: result.effects.filter((e) => e.kind !== 'goto_flow'),
        });

        // ── Encadeamento de timers (drip) ───────────────────────────────
        // A retomada pode parar em OUTRO wait/schedule (mensagem → wait →
        // mensagem → wait → ...). Agenda o próximo timer aqui, senão a
        // sequência estaciona após a primeira retomada.
        if (result.next === 'scheduled' && result.schedule) {
          await scheduleFlowTimer({
            organizationId: timer.organizationId,
            conversationId: timer.conversationId,
            flowId: timer.flowId,
            flowVersion: timer.flowVersion,
            schedule: result.schedule,
            state: result.state,
          });
        }

        // ── Nó-IA na retomada ───────────────────────────────────────────
        // Gera a resposta via flowAiResume (caminho leve: contexto do negócio
        // + persona live + histórico + instrução do nó) e envia como send_text
        // (aiConfidence 0.9 — texto de LLM, não trilho fixo). Fail-closed: se
        // a geração falhar (LLM fora, prompt vazio, conversa purgada), nenhuma
        // mensagem sai — o cursor é persistido abaixo (non-null no caso 'ai')
        // e o PRÓXIMO inbound continua dali pelo caminho normal do orchestrator.
        if (result.next === 'ai') {
          const reply = await generateAiResumeReply({
            organizationId: timer.organizationId,
            conversationId: timer.conversationId,
            aiPrompt: result.aiPrompt ?? '',
            aiModelHint: result.aiModelHint,
          });
          if (reply) {
            await executeFlowEffects({
              organizationId: timer.organizationId,
              conversationId: timer.conversationId,
              contactId: conversation?.contactId ?? null,
              effects: [{ kind: 'send_text', text: reply }],
              aiConfidence: 0.9,
            });
            logger.info('[FlowScheduler] retomada em nó-IA — resposta gerada e enviada', {
              timerId: timer.id,
              organizationId: timer.organizationId,
              conversationId: timer.conversationId,
              flowId: timer.flowId,
              replyChars: reply.length,
            });
          } else {
            logger.warn('[FlowScheduler] retomada parou em nó-IA — geração falhou/indisponível (fail-closed, nenhuma mensagem enviada); cursor persistido para o próximo inbound', {
              timerId: timer.id,
              organizationId: timer.organizationId,
              conversationId: timer.conversationId,
              flowId: timer.flowId,
              cursor: result.state?.cursor ?? null,
            });
          }
        }

        // Persiste o cursor no MESMO formato/regra do flowRuntime: cursor
        // non-null → próximo inbound continua do ponto certo (com flowId);
        // null → ENDED (Iza pura assume; timer encadeado retoma do snapshot).
        const stateKey = flowStateKey(timer.organizationId, timer.conversationId);
        await cache.set(stateKey, JSON.stringify(buildStoredFlowState(result.state, timer.flowId)), FLOW_STATE_TTL);
      } catch (effectErr) {
        // Claim já queimado — NÃO reverter para pending (evita retry BullMQ inútil).
        // Registra falha como statusReason sem mudar o status 'fired'.
        logger.error('[FlowScheduler] Erro ao executar efeitos pós-claim', { timerId: timer.id, effectErr });
        await prisma.flowTimer.update({
          where: { id: timer.id },
          data: { statusReason: 'effects_failed' },
        });
        return;
      }

      logger.info('[FlowScheduler] Timer disparado', {
        timerId: timer.id,
        organizationId: timer.organizationId,
        conversationId: timer.conversationId,
        next: result.next,
        effects: result.effects.map((e) => e.kind),
      });
    },
    { connection, concurrency: 5 },
  );

  flowTimerWorker.on('failed', (job, err) => {
    logger.error(`[FlowScheduler] Job ${job?.id} falhou:`, err);
  });

  logger.info('[FlowScheduler] flow-timer worker inicializado');
}
