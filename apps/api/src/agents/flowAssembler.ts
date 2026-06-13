/**
 * ZappIQ Maestro — Flow Assembler (PURO, sem IO/Date)
 * ============================================================================
 * assemble(plan): toma um "block plan" da IA e costura os fragments de
 * expandBlock em um grafo de engine válido, verificado por validateGraph.
 * ============================================================================
 */

import { expandBlock, type Fragment } from './flowBlocks.js';
import { validateGraph } from './flowGraphValidation.js';

// ── Tipos públicos ────────────────────────────────────────────────────────────

export type AssembleResult =
  | { ok: true; graph: { nodes: any[]; edges: any[] }; warnings: string[] }
  | { ok: false; errors: string[] };

// ── Tipos conhecidos (os mesmos do expandBlock switch) ────────────────────────

const KNOWN_TYPES = new Set([
  'message',
  'ask',
  'ask_buttons',
  'branch_var',
  'branch_hours',
  'tag',
  'ai',
  'handoff',
]);

// ── Resolução de target por exit.key ─────────────────────────────────────────

/**
 * Dado um bloco do plano e uma exit.key, devolve o blockId-alvo (ou undefined).
 */
function resolveTarget(block: any, exitKey: string): string | undefined {
  if (exitKey === 'next' || exitKey === 'ok') return block.next;
  if (exitKey === 'else') return block.elseNext;
  if (exitKey === 'open') return block.openNext;
  if (exitKey === 'closed') return block.closedNext;
  if (exitKey.startsWith('opt:')) {
    const i = parseInt(exitKey.slice(4), 10);
    return block.options?.[i]?.next;
  }
  if (exitKey.startsWith('case:')) {
    const i = parseInt(exitKey.slice(5), 10);
    return block.cases?.[i]?.next;
  }
  return undefined;
}

// ── Coleta todos os targets referenciados no plano ────────────────────────────

function collectReferencedTargets(block: any): string[] {
  const targets: string[] = [];
  if (block.next) targets.push(block.next);
  if (block.elseNext) targets.push(block.elseNext);
  if (block.openNext) targets.push(block.openNext);
  if (block.closedNext) targets.push(block.closedNext);
  for (const opt of block.options ?? []) {
    if (opt.next) targets.push(opt.next);
  }
  for (const c of block.cases ?? []) {
    if (c.next) targets.push(c.next);
  }
  return targets;
}

// ── BFS layout ────────────────────────────────────────────────────────────────

function assignPositions(nodes: any[], edges: any[], startId: string): void {
  const depthMap = new Map<string, number>();
  const orderMap = new Map<string, number>();
  const queue: string[] = [startId];
  depthMap.set(startId, 0);
  const depthOrder: Map<number, number> = new Map();

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const depth = depthMap.get(nodeId)!;
    const order = depthOrder.get(depth) ?? 0;
    depthOrder.set(depth, order + 1);
    orderMap.set(nodeId, order);

    for (const edge of edges) {
      if (edge.source === nodeId && !depthMap.has(edge.target)) {
        depthMap.set(edge.target, depth + 1);
        queue.push(edge.target);
      }
    }
  }

  // Assign positions; unreachable nodes get a safe default
  let fallbackX = 0;
  for (const node of nodes) {
    if (depthMap.has(node.id)) {
      node.position = {
        x: depthMap.get(node.id)! * 240,
        y: (orderMap.get(node.id) ?? 0) * 120,
      };
    } else {
      node.position = { x: fallbackX++ * 240, y: 600 };
    }
  }
}

// ── assemble ──────────────────────────────────────────────────────────────────

export function assemble(plan: any): AssembleResult {
  const errors: string[] = [];

  // ── Step 1: Validate plan ─────────────────────────────────────────────────

  if (!Array.isArray(plan?.blocks) || plan.blocks.length === 0) {
    return { ok: false, errors: ['plan.blocks deve ser um array não-vazio.'] };
  }

  const blocks: any[] = plan.blocks;

  // Check for id presence and uniqueness
  const blockIds = new Set<string>();
  for (const block of blocks) {
    if (!block.id) {
      errors.push(`Bloco sem id encontrado.`);
      continue;
    }
    if (blockIds.has(block.id)) {
      errors.push(`Id de bloco duplicado: "${block.id}".`);
    }
    blockIds.add(block.id);
  }

  if (errors.length > 0) return { ok: false, errors };

  // Check entry exists
  if (!plan.entry || !blockIds.has(plan.entry)) {
    errors.push(`entry "${plan.entry}" não corresponde a nenhum bloco.`);
    return { ok: false, errors };
  }

  // Check block types and collect expandBlock fragments early (for type validation)
  const fragMap = new Map<string, Fragment>();
  for (const block of blocks) {
    if (!KNOWN_TYPES.has(block.type)) {
      // Also catch via expandBlock to be safe
      errors.push(`Tipo de bloco desconhecido: "${block.type}" (id: "${block.id}").`);
      continue;
    }
    try {
      fragMap.set(block.id, expandBlock(block));
    } catch (e: any) {
      errors.push(`Erro ao expandir bloco "${block.id}" (${block.type}): ${e?.message ?? e}`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  // Check all referenced targets exist
  for (const block of blocks) {
    for (const target of collectReferencedTargets(block)) {
      if (!blockIds.has(target)) {
        errors.push(
          `Bloco "${block.id}" referencia target "${target}" que não existe no plano.`,
        );
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  // ── Step 2: Collect all fragment nodes and internal edges ─────────────────

  const nodes: any[] = [];
  const edges: any[] = [];

  for (const block of blocks) {
    const frag = fragMap.get(block.id)!;
    nodes.push(...frag.nodes);
    edges.push(...frag.edges);
  }

  // ── Step 3: Resolve exits → cross-block edges ─────────────────────────────

  // Else-completion: find first ai-type node entry in the whole graph
  let fallbackAiEntry: string | null = null;
  let fallbackAiCreated = false;

  function getElseFallbackEntry(): string {
    if (fallbackAiEntry) return fallbackAiEntry;

    // Try to find an existing ai node from any fragment
    for (const block of blocks) {
      if (block.type === 'ai') {
        fallbackAiEntry = fragMap.get(block.id)!.entry;
        return fallbackAiEntry;
      }
    }

    // Create a fallback ai node (once)
    if (!fallbackAiCreated) {
      const fallbackNode = {
        id: 'ai_fallback',
        type: 'ai',
        data: {
          label: 'Atendimento',
          prompt: 'Entenda o pedido do cliente e ajude usando o conhecimento do negócio.',
        },
      };
      nodes.push(fallbackNode);
      fallbackAiCreated = true;
    }
    fallbackAiEntry = 'ai_fallback';
    return fallbackAiEntry;
  }

  let edgeIndex = 0;

  for (const block of blocks) {
    const frag = fragMap.get(block.id)!;

    for (const exit of frag.exits) {
      const targetBlockId = resolveTarget(block, exit.key);

      if (targetBlockId) {
        // Normal case: resolve to block's fragment entry
        const targetFrag = fragMap.get(targetBlockId)!;
        edges.push({
          id: `e_${exit.from}_${targetFrag.entry}_${edgeIndex++}`,
          source: exit.from,
          target: targetFrag.entry,
          data: exit.edgeData,
        });
      } else if (exit.key === 'else' || exit.key === 'closed') {
        // Else-completion: auto-route to safest ai node
        const fallbackTarget = getElseFallbackEntry();
        edges.push({
          id: `e_${exit.from}_${fallbackTarget}_${edgeIndex++}`,
          source: exit.from,
          target: fallbackTarget,
          data: exit.edgeData,
        });
      }
      // else: 'next'/'ok'/'opt:'/'case:'/'open' with no target → natural end, no edge
    }
  }

  // ── Step 4: start node + entry edge ──────────────────────────────────────

  const startNode = { id: 'start', type: 'start', data: { label: 'Início' } };
  nodes.unshift(startNode);

  const entryFrag = fragMap.get(plan.entry)!;
  edges.unshift({
    id: `e_start_${entryFrag.entry}_${edgeIndex++}`,
    source: 'start',
    target: entryFrag.entry,
  });

  // ── Step 5: Layout ────────────────────────────────────────────────────────

  assignPositions(nodes, edges, 'start');

  // ── Step 6: Final validation ──────────────────────────────────────────────

  const issues = validateGraph(nodes, edges);

  if (issues.errors.length > 0) {
    return { ok: false, errors: issues.errors };
  }

  return { ok: true, graph: { nodes, edges }, warnings: issues.warnings };
}
