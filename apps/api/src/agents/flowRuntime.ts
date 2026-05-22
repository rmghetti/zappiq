/**
 * ZappIQ Maestro — Flow Runtime WRAPPER (Fase 1B / #280)
 * ============================================================================
 * Camada de orquestração sobre o motor puro (flowEngine.ts): checa o feature
 * flag da org, carrega o Flow ativo (Prisma), lê/grava o cursor da conversa no
 * cache e chama `resolveFlowStep`. É o que o agentOrchestrator chama.
 *
 * A chamada de LLM continua SÓ no orchestrator — o nó-IA apenas devolve o
 * prompt do nó (next='ai', aiPrompt) pra ser injetado no caminho existente
 * (cascade + iza_facts + RAG). Não reinventa prompt nem cria backend de
 * conhecimento paralelo.
 *
 * Aditivo por contrato: sem flag `maestro.enabled` OU sem Flow ativo → retorna
 * null e a Iza pura roda como hoje. Fail-soft: qualquer erro também vira null.
 * ============================================================================
 */
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { cache } from '../services/cloud/index.js';
import {
  resolveFlowStep,
  type FlowGraph,
  type FlowNode,
  type FlowEdge,
  type FlowState,
  type FlowStepResult,
} from './flowEngine.js';

export type {
  FlowGraph, FlowNode, FlowEdge, FlowState, FlowStepResult, FlowEffect,
} from './flowEngine.js';

const FLOW_STATE_TTL = 60 * 60 * 24 * 7; // 7 dias

function flowStateKey(orgId: string, conversationId: string): string {
  return `flow_state:${orgId}:${conversationId}`;
}

/**
 * Gate de gatilho (Bloco 3 / #286). Decide se uma conversa que AINDA NÃO entrou
 * no fluxo (sem cursor) deve INICIAR neste turno. Mid-flow (com cursor) sempre
 * continua e nem chama isto. Sem o gate, ligar `maestro.enabled` numa org faria
 * o fluxo capturar TODO o tráfego — aqui só entra quem casa o gatilho.
 *
 * Hoje só KEYWORD auto-inicia no inbound. FIRST_CONTACT/SCHEDULE/MANUAL/EVENT
 * exigem sinais que ainda não temos no orchestrator (nova conversa, agenda,
 * etc.) — por segurança NÃO auto-iniciam (default fail-closed).
 *
 * Contrato de triggerConfig p/ KEYWORD: { keywords: string[] } (ou { keyword }).
 * Match case-insensitive por substring.
 */
function flowTriggerMatches(
  triggerType: string,
  triggerConfig: unknown,
  message: string,
): boolean {
  if (triggerType === 'KEYWORD') {
    const cfg = (triggerConfig as Record<string, any>) || {};
    const keywords: string[] = Array.isArray(cfg.keywords)
      ? cfg.keywords
      : typeof cfg.keyword === 'string'
        ? [cfg.keyword]
        : [];
    if (keywords.length === 0) return false;
    const m = (message || '').toLowerCase();
    return keywords.some((k) => k && m.includes(String(k).toLowerCase()));
  }
  // Demais gatilhos: auto-início no inbound ainda não fiado (fail-closed).
  return false;
}

export interface ActiveFlowStepInput {
  organizationId: string;
  conversationId: string;
  messageContent: string;
  orgSettings: any;
}

/**
 * Resolve o passo do fluxo ativo da org (se houver) pro turno atual.
 * Retorna null quando: feature flag off, nenhum Flow ativo, grafo vazio, ou erro
 * (fail-soft) — nesses casos o orchestrator segue com a Iza pura.
 */
export async function resolveActiveFlowStep(
  input: ActiveFlowStepInput,
): Promise<FlowStepResult | null> {
  const { organizationId, conversationId, messageContent, orgSettings } = input;

  // Feature flag por org — aditivo: default desligado.
  const maestroEnabled = orgSettings?.maestro?.enabled === true;
  if (!maestroEnabled) return null;

  try {
    const flow = await prisma.flow.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!flow) return null;

    const graph: FlowGraph = {
      nodes: Array.isArray(flow.nodes) ? (flow.nodes as unknown as FlowNode[]) : [],
      edges: Array.isArray(flow.edges) ? (flow.edges as unknown as FlowEdge[]) : [],
    };
    if (graph.nodes.length === 0) return null;

    // Estado da conversa (cursor) no cache — fail-soft.
    let state: FlowState = { cursor: null, vars: {} };
    const raw = await cache.get(flowStateKey(organizationId, conversationId));
    if (raw) {
      try { state = JSON.parse(raw) as FlowState; } catch { /* estado corrompido — recomeça */ }
    }

    // Gate de gatilho (Bloco 3): conversa que ainda NÃO entrou no fluxo (sem
    // cursor) só INICIA se a mensagem casar com o gatilho. Mid-flow (com cursor)
    // continua sempre. Sem isso, ligar maestro.enabled capturaria todo o tráfego.
    if (!state.cursor && !flowTriggerMatches(flow.triggerType as unknown as string, flow.triggerConfig, messageContent)) {
      return null;
    }

    const result = resolveFlowStep(graph, state, messageContent);

    // Persiste novo cursor (ou limpa se terminou)
    if (result.next === 'end') {
      await cache.del(flowStateKey(organizationId, conversationId));
    } else {
      await cache.set(
        flowStateKey(organizationId, conversationId),
        JSON.stringify(result.state),
        FLOW_STATE_TTL,
      );
    }

    logger.info('[Maestro] Flow step resolvido', {
      organizationId,
      conversationId,
      flowId: flow.id,
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
