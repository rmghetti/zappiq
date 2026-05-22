/**
 * ZappIQ Maestro — Flow Engine (MOTOR PURO, Fase 1B / #280)
 * ============================================================================
 * Função sem efeitos colaterais e SEM dependências (Prisma/cache/LLM): recebe o
 * grafo (nodes/edges), o estado da conversa (cursor + vars) e a mensagem, e
 * devolve os EFEITOS a executar + pra onde o turno vai (await_input | ai | end).
 *
 * 100% unit-testável (flowEngine.test.ts). O wrapper com DB/cache/feature-flag
 * fica em flowRuntime.ts. A chamada de LLM continua só no agentOrchestrator —
 * o nó-IA apenas devolve o prompt do nó (next='ai', aiPrompt) pra ser injetado
 * no caminho existente (cascade + iza_facts + RAG).
 * ============================================================================
 */

// ── Tipos do grafo (alinhados ao model Flow {nodes,edges} + mock /flows) ──────
export interface FlowNode {
  id: string;
  type: string; // 'start' | 'message' | 'condition' | 'ai' | 'transfer' | 'tag' | 'update_lead' | 'wait' | 'schedule'
  label?: string;
  data?: Record<string, any>;
}

export interface FlowCondition {
  match: 'contains' | 'equals' | 'starts_with' | 'regex' | 'else';
  value?: string;
}

export interface FlowEdge {
  id?: string;
  source: string;
  target: string;
  /** Condição da aresta (usada por nós 'condition'): { when: { match, value } } */
  data?: { when?: FlowCondition } & Record<string, any>;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** Estado por conversa: cursor = nó que aguarda input; null = fluxo não iniciado. */
export interface FlowState {
  cursor: string | null;
  vars: Record<string, any>;
}

export type FlowEffect =
  | { kind: 'send_text'; text: string }
  | { kind: 'set_tag'; tag: string }
  | { kind: 'update_lead'; field: string; value: any }
  | { kind: 'handoff' };

export interface FlowStepResult {
  effects: FlowEffect[];
  /** await_input: parou num condition esperando próxima msg. ai: entrega pro LLM. end: terminou. */
  next: 'await_input' | 'ai' | 'end';
  state: FlowState;
  /** Presente quando next==='ai': prompt do nó-IA pra injetar no systemPrompt. */
  aiPrompt?: string;
  aiModelHint?: string;
}

// ── Helpers de grafo ──────────────────────────────────────────────────────────
function nodeById(graph: FlowGraph, id: string | null): FlowNode | undefined {
  if (!id) return undefined;
  return graph.nodes.find((n) => n.id === id);
}

function firstTargetFrom(graph: FlowGraph, sourceId: string): string | null {
  const edge = graph.edges.find((e) => e.source === sourceId);
  return edge ? edge.target : null;
}

export function matchCondition(cond: FlowCondition | undefined, text: string): boolean {
  if (!cond) return false;
  if (cond.match === 'else') return true;
  const v = (cond.value ?? '').toString();
  const haystack = (text ?? '').toString();
  const h = haystack.toLowerCase();
  const needle = v.toLowerCase();
  switch (cond.match) {
    case 'contains': return h.includes(needle);
    case 'equals': return h.trim() === needle.trim();
    case 'starts_with': return h.trimStart().startsWith(needle);
    case 'regex':
      try { return new RegExp(v, 'i').test(haystack); } catch { return false; }
    default: return false;
  }
}

/** Escolhe a aresta de saída de um nó 'condition' conforme a mensagem. */
function pickConditionBranch(graph: FlowGraph, nodeId: string, text: string): string | null {
  const outgoing = graph.edges.filter((e) => e.source === nodeId);
  // 1) primeira aresta cuja condição casa (ignora 'else' nesta passada)
  for (const e of outgoing) {
    const when = e.data?.when;
    if (when && when.match !== 'else' && matchCondition(when, text)) return e.target;
  }
  // 2) aresta 'else' explícita
  const elseEdge = outgoing.find((e) => e.data?.when?.match === 'else');
  if (elseEdge) return elseEdge.target;
  // 3) aresta sem condição declarada (fallback default)
  const bare = outgoing.find((e) => !e.data?.when);
  return bare ? bare.target : null;
}

// ── MOTOR PURO ─────────────────────────────────────────────────────────────────
const MAX_WALK = 100; // trava anti-loop infinito em grafos malformados

/**
 * Caminha o grafo a partir do cursor (ou do 'start' se cursor null), executando
 * nós determinísticos e acumulando efeitos, até parar num ponto que: pede nova
 * mensagem do usuário (condition mid-walk) → 'await_input'; entrega pro LLM
 * ('ai'); ou encerra ('end'). A msg do turno é consumida por NO MÁXIMO um
 * 'condition' (o primeiro encontrado — o que aguardava input).
 */
export function resolveFlowStep(
  graph: FlowGraph,
  state: FlowState,
  incomingText: string,
): FlowStepResult {
  const effects: FlowEffect[] = [];
  const vars = { ...(state.vars || {}) };

  let current: string | null;
  if (state.cursor) {
    current = state.cursor; // retoma no condition que aguardava
  } else {
    const start = graph.nodes.find((n) => n.type === 'start');
    current = start ? firstTargetFrom(graph, start.id) : (graph.nodes[0]?.id ?? null);
  }

  // A mensagem deste turno alimenta no máx. 1 condition, E só enquanto o bot
  // ainda não respondeu neste walk: depois de enviar um texto, um condition
  // seguinte tem que aguardar a PRÓXIMA mensagem do usuário (não dá pra ramificar
  // sobre a resposta a uma pergunta que acabamos de fazer no mesmo turno).
  let messageAvailable = true;
  let sentMessageThisWalk = false;

  for (let guard = 0; guard < MAX_WALK; guard++) {
    const node = nodeById(graph, current);
    if (!current || !node) {
      return { effects, next: 'end', state: { cursor: null, vars } };
    }

    switch (node.type) {
      case 'start':
        current = firstTargetFrom(graph, node.id);
        break;

      case 'message': {
        const text = (node.data?.text ?? node.label ?? '').toString();
        if (text.trim()) {
          effects.push({ kind: 'send_text', text });
          sentMessageThisWalk = true;
        }
        current = firstTargetFrom(graph, node.id);
        break;
      }

      case 'tag':
        if (node.data?.tag) effects.push({ kind: 'set_tag', tag: String(node.data.tag) });
        current = firstTargetFrom(graph, node.id);
        break;

      case 'update_lead':
        if (node.data?.field) {
          effects.push({ kind: 'update_lead', field: String(node.data.field), value: node.data.value ?? null });
        }
        current = firstTargetFrom(graph, node.id);
        break;

      case 'transfer':
        effects.push({ kind: 'handoff' });
        return { effects, next: 'end', state: { cursor: null, vars } };

      case 'ai':
        // Entrega pro LLM. Cursor avança pro próximo nó (próximo turno retoma lá).
        return {
          effects,
          next: 'ai',
          aiPrompt: (node.data?.prompt ?? node.label ?? '').toString() || undefined,
          aiModelHint: node.data?.model ? String(node.data.model) : undefined,
          state: { cursor: firstTargetFrom(graph, node.id), vars },
        };

      case 'wait':
      case 'schedule':
        // Fase 1: timing não implementado — passa direto. TODO Fase 3.
        current = firstTargetFrom(graph, node.id);
        break;

      case 'condition':
        if (messageAvailable && !sentMessageThisWalk) {
          // ramifica sobre a mensagem que chegou aguardando aqui
          messageAvailable = false;
          current = pickConditionBranch(graph, node.id, incomingText);
        } else {
          // já respondemos algo neste turno (ou a msg já foi consumida) →
          // aguarda a PRÓXIMA mensagem do usuário neste condition
          return { effects, next: 'await_input', state: { cursor: node.id, vars } };
        }
        break;

      default:
        // nó desconhecido: encerra com segurança
        return { effects, next: 'end', state: { cursor: null, vars } };
    }
  }

  // estourou MAX_WALK (grafo provavelmente cíclico) — encerra defensivamente
  return { effects, next: 'end', state: { cursor: null, vars } };
}
