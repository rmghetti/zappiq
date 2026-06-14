/**
 * ZappIQ Maestro v2 — Flow Runtime WRAPPER (multi-fluxo)
 * ============================================================================
 * Camada de orquestração sobre o motor puro (flowEngine.ts): checa o feature
 * flag da org, carrega os Flows ativos (Prisma), roteia QUAL fluxo inicia via
 * router determinístico (flowRouter.ts), lê/grava o cursor da conversa no
 * cache e chama `resolveFlowStep`. É o que o agentOrchestrator chama.
 *
 * v2 sobre a Fase 1B:
 *  - MULTI-FLUXO: várias automações ativas por org; o router decide qual
 *    inicia (keyword exata > substring > FIRST_CONTACT) — mid-flow continua
 *    no fluxo gravado no estado (flowId no cache).
 *  - goto_flow: handoff entre fluxos no MESMO turno, com anti-loop
 *    (MAX_FLOW_HOPS) — a mensagem do turno é consumida só pelo 1º fluxo.
 *  - AGENDAMENTO DURÁVEL: nós wait/schedule emitem next='scheduled' e o
 *    runtime persiste um FlowTimer (flowScheduler.ts) que retoma o walk.
 *
 * A chamada de LLM continua SÓ no orchestrator — o nó-IA apenas devolve o
 * prompt do nó (next='ai', aiPrompt) pra ser injetado no caminho existente
 * (cascade + iza_facts + RAG). Não reinventa prompt nem cria backend de
 * conhecimento paralelo.
 *
 * Aditivo por contrato: sem flag `maestro.enabled` OU sem Flow ativo OU sem
 * match no router → retorna null e a Iza pura roda como hoje. Fail-soft:
 * qualquer erro também vira null.
 * ============================================================================
 */
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { cache } from '../services/cloud/index.js';
import { recordNodeStats } from '../services/flowAnalytics.js';
import {
  resolveFlowStep,
  type FlowGraph,
  type FlowNode,
  type FlowEdge,
  type FlowState,
  type FlowStepResult,
} from './flowEngine.js';
import { pickFlowForMessage, type RoutableFlow } from './flowRouter.js';
import { scheduleFlowTimer, cancelPendingWaitTimers } from '../services/flowScheduler.js';
import { buildEvalContext } from './evalContextBuilder.js';
import { nextHopIntent } from './flowHop.js';

export type {
  FlowGraph, FlowNode, FlowEdge, FlowState, FlowStepResult, FlowEffect,
} from './flowEngine.js';

const FLOW_STATE_TTL = 60 * 60 * 24 * 7; // 7 dias

/** Limite de handoffs goto_flow num único turno — anti-loop A→B→A→… */
const MAX_FLOW_HOPS = 5;

function flowStateKey(orgId: string, conversationId: string): string {
  return `flow_state:${orgId}:${conversationId}`;
}

/** Marcador de "fluxo já concluído nesta conversa" — evita re-disparo. */
const FLOW_ENDED = '__ended__';

/** Frame de retorno para subfluxos (call/return). */
type CallFrame = { flowId: string; returnNodeId: string | null };

/** Estado persistido no cache: FlowState + fluxo dono do cursor (v2) + pilha de subfluxos (1C). */
interface StoredFlowState extends FlowState {
  /** Fluxo dono do cursor. Ausente em entradas legadas pré-v2. */
  flowId?: string;
  /** Pilha de retorno de subfluxos (mode:'call'). Ausente em entradas legadas. */
  callStack?: CallFrame[];
}

export interface ActiveFlowStepInput {
  organizationId: string;
  conversationId: string;
  messageContent: string;
  orgSettings: any;
  /** Contato da conversa, p/ montar o EvalContext (atributos/CRM). Opcional. */
  contactId?: string | null;
}

/**
 * Resolve o passo do fluxo ativo da org (se houver) pro turno atual.
 * Retorna null quando: feature flag off, nenhum Flow ativo, router sem match,
 * grafo vazio, ou erro (fail-soft) — nesses casos o orchestrator segue com a
 * Iza pura. IMPORTANTE: routing miss NÃO grava nada no cache — só conversas
 * que efetivamente rodaram um fluxo ganham estado.
 */
export async function resolveActiveFlowStep(
  input: ActiveFlowStepInput,
): Promise<FlowStepResult | null> {
  const { organizationId, conversationId, messageContent, orgSettings } = input;

  // Feature flag por org — aditivo: default desligado.
  const maestroEnabled = orgSettings?.maestro?.enabled === true;
  if (!maestroEnabled) return null;

  try {
    // Cliente respondeu → timers 'wait' pendentes (ramo de timeout) perderam
    // o sentido. Best-effort: o fire do worker revalida de qualquer forma.
    try {
      await cancelPendingWaitTimers(organizationId, conversationId);
    } catch { /* fail-soft: nunca derruba o turno */ }

    const flows = await prisma.flow.findMany({
      where: { organizationId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (flows.length === 0) return null;

    // Estado da conversa (cursor + flowId) no cache — fail-soft.
    const stateKey = flowStateKey(organizationId, conversationId);
    let state: StoredFlowState = { cursor: null, vars: {} };
    const raw = await cache.get(stateKey);
    if (raw) {
      try { state = JSON.parse(raw) as StoredFlowState; } catch { /* estado corrompido — recomeça */ }
    }
    const ended = state.cursor === FLOW_ENDED;
    const midFlow = !!state.cursor && !ended;
    // Pilha de retorno de subfluxos — restaurada do cache para suporte a subfluxos multi-turno.
    let callStack: CallFrame[] = Array.isArray(state.callStack) ? state.callStack : [];

    // ── Seleção do fluxo ─────────────────────────────────────────────────
    let flow: (typeof flows)[number] | undefined;
    let initialCursor: string | null = null;

    if (midFlow && state.flowId) {
      flow = flows.find((f) => f.id === state.flowId);
      if (flow) {
        initialCursor = state.cursor;
      }
      // Fluxo sumiu/desativado → cai pro roteamento abaixo com estado fresco
      // (cursor null) em vez de quebrar a conversa.
    } else if (midFlow) {
      // Entrada legada pré-v2 (cursor sem flowId): comportamento antigo —
      // fluxo ativo mais recente.
      flow = flows[0];
      initialCursor = state.cursor;
    }

    if (!flow) {
      // Conversa sem cursor (ou ENDED, ou fluxo do cursor sumiu): router
      // determinístico decide qual fluxo inicia — sem match, Iza pura assume
      // (e NÃO gravamos nada no cache).
      const routable: RoutableFlow[] = flows.map((f) => ({
        id: f.id,
        triggerType: String(f.triggerType),
        triggerConfig: f.triggerConfig,
        priority: f.priority ?? 0,
        updatedAt: f.updatedAt,
      }));
      const picked = pickFlowForMessage(routable, messageContent, { conversationEnded: ended });
      if (!picked) return null;
      flow = flows.find((f) => f.id === picked.id)!; // picked veio de flows
      initialCursor = null;
      // Conversa ENDED re-disparando (keyword): rodada limpa, vars zeradas.
      // Conversa nova: preserva vars existentes (se houver) por segurança.
      state = ended ? { cursor: null, vars: {} } : { cursor: null, vars: state.vars ?? {} };
    }

    // ── Monta EvalContext (atributos do contato + horário comercial) ─────
    const ctx = await buildEvalContext({ contactId: input.contactId, orgSettings });

    // ── Walk com handoff goto_flow (anti-loop) ───────────────────────────
    // A mensagem do turno alimenta SÓ o primeiro resolve (consumedMessage):
    // fluxos alvo de goto_flow começam do start com hasIncomingMessage=false —
    // um condition no alvo deve aguardar a PRÓXIMA mensagem do usuário, não
    // re-consumir a atual.
    let currentFlow = flow;
    let currentState: FlowState = { cursor: initialCursor, vars: state.vars ?? {} };
    let result: FlowStepResult | null = null;
    const aggregated: FlowStepResult['effects'] = [];
    let consumedMessage = false;
    const hopRecords: { flowId: string; nodes: any[]; visitedNodeIds: string[] }[] = [];

    for (let hop = 0; hop <= MAX_FLOW_HOPS; hop++) {
      const graph: FlowGraph = {
        nodes: Array.isArray(currentFlow.nodes) ? (currentFlow.nodes as unknown as FlowNode[]) : [],
        edges: Array.isArray(currentFlow.edges) ? (currentFlow.edges as unknown as FlowEdge[]) : [],
      };
      if (graph.nodes.length === 0) return null;

      result = resolveFlowStep(graph, currentState, messageContent, { hasIncomingMessage: !consumedMessage, ctx });
      consumedMessage = true;

      hopRecords.push({
        flowId: currentFlow.id,
        nodes: Array.isArray(currentFlow.nodes) ? (currentFlow.nodes as any[]) : [],
        visitedNodeIds: result.visitedNodeIds ?? [],
      });

      const gotoEff = result.effects.find((e) => e.kind === 'goto_flow') as
        | { kind: 'goto_flow'; targetFlowId: string; mode?: 'goto' | 'call'; returnNodeId?: string | null }
        | undefined;
      aggregated.push(...result.effects.filter((e) => e.kind !== 'goto_flow'));

      const intent = nextHopIntent(gotoEff, result.next, callStack.length > 0);
      if (intent === 'stop') break;
      if (hop === MAX_FLOW_HOPS) {
        logger.warn('[Maestro] limite de hops atingido — encerrando walk', { organizationId, conversationId });
        break;
      }

      if (intent === 'call' || intent === 'switch') {
        const target = flows.find((f) => f.id === gotoEff!.targetFlowId && f.isActive);
        if (!target) {
          // Alvo inexistente/inativo: segue com o resultado atual (cursor null
          // do goto → persistência abaixo grava ENDED corretamente).
          logger.warn('[Maestro] goto_flow para fluxo inexistente/inativo — seguindo no atual', {
            organizationId, from: currentFlow.id, target: gotoEff!.targetFlowId,
          });
          break;
        }
        if (intent === 'call') callStack.push({ flowId: currentFlow.id, returnNodeId: gotoEff!.returnNodeId ?? null });
        currentFlow = target;
        currentState = { cursor: null, vars: result.state?.vars ?? {} };
        continue;
      }

      // intent === 'return': desempilha. Frames com returnNodeId null = chamador
      // sem nó após o goto_flow → ele também encerra → sobe para o chamador dele.
      let frame = callStack.pop()!;
      while (frame.returnNodeId === null && callStack.length > 0) {
        frame = callStack.pop()!;
      }
      if (frame.returnNodeId === null) {
        // pilha esgotou sem ponto de retorno → a conversa encerra
        break;
      }
      const caller = flows.find((f) => f.id === frame.flowId && f.isActive);
      if (!caller) {
        logger.warn('[Maestro] subfluxo: chamador inexistente/inativo — encerrando', { organizationId, callerId: frame.flowId });
        break;
      }
      currentFlow = caller;
      currentState = { cursor: frame.returnNodeId, vars: result.state?.vars ?? {} };
      continue;
    }
    if (!result) return null;
    result = { ...result, effects: aggregated };

    // ── Agendamento durável (wait/schedule) ──────────────────────────────
    if (result.next === 'scheduled' && result.schedule) {
      await scheduleFlowTimer({
        organizationId,
        conversationId,
        flowId: currentFlow.id,
        flowVersion: currentFlow.version,
        schedule: result.schedule,
        state: { ...result.state, callStack },
      });
    }

    // ── Persistência do cursor ───────────────────────────────────────────
    // cursor null cobre: fim do fluxo, nó-IA final e wait de saída única.
    // Só marca ENDED quando cursor null E a pilha de subfluxos está vazia
    // (subfluxos em curso com callStack não-vazio ainda têm retorno pendente).
    // Cursor presente → salva COM flowId e callStack pro próximo turno.
    const nextCursor = result.state?.cursor ?? null;
    const endedReal = nextCursor === null && callStack.length === 0;
    if (!endedReal) {
      await cache.set(stateKey, JSON.stringify({ ...result.state, flowId: currentFlow.id, callStack }), FLOW_STATE_TTL);
    } else {
      await cache.set(stateKey, JSON.stringify({ cursor: FLOW_ENDED, vars: result.state?.vars || {}, callStack: [] }), FLOW_STATE_TTL);
    }

    // Analytics por nó (fail-soft, aditivo) — registra todos os fluxos da cadeia de hops
    try {
      for (let i = 0; i < hopRecords.length; i++) {
        const rec = hopRecords[i];
        const isLast = i === hopRecords.length - 1;
        await recordNodeStats({
          organizationId,
          flowId: rec.flowId,
          graph: { nodes: rec.nodes },
          visitedNodeIds: rec.visitedNodeIds,
          ended: isLast && result.next === 'end',
        });
      }
    } catch { /* fail-soft */ }

    logger.info('[Maestro] Flow step resolvido', {
      organizationId,
      conversationId,
      flowId: currentFlow.id,
      next: result.next,
      effects: result.effects.map((e) => e.kind),
    });

    return result;
  } catch (err) {
    // Nunca derruba o turno por causa do Maestro — fail-soft pra Iza pura.
    logger.warn('[Maestro] resolveActiveFlowStep falhou — caindo pra Iza pura', { err, organizationId });
    return null;
  }
}
