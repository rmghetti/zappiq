import { logger } from '../utils/logger.js';
import { llmRouter } from '../services/llm/LLMRouter.js';
import {
  loadBusinessContext,
  extractJson,
  type FlowRefreshResult,
} from './flowGenerator.js';
import {
  extractEditableContent,
  applyContentPatch,
  diffContent,
  type ContentField,
} from './flowContentPatch.js';

export interface NodeStatRow { nodeId: string; nodeType: string; nodeLabel?: string | null; entries: number; ends: number }
export interface DropoffNode extends NodeStatRow { dropoffRate: number }

const MIN_ENTRIES = 5;
const REWRITABLE = new Set(['message', 'ai']);

export function rankDropoffNodes(
  byNode: NodeStatRow[],
  graph: { nodes: any[]; edges: any[] },
): DropoffNode[] {
  const hasOutgoing = (id: string) => graph.edges.some((e) => e.source === id);
  const out: DropoffNode[] = [];
  for (const n of byNode ?? []) {
    if (!REWRITABLE.has(n.nodeType)) continue;
    if (!n.entries || n.entries < MIN_ENTRIES) continue;
    if (!hasOutgoing(n.nodeId)) continue;
    out.push({ ...n, nodeLabel: n.nodeLabel ?? null, dropoffRate: n.ends / n.entries });
  }
  out.sort((a, b) => (b.dropoffRate - a.dropoffRate) || (b.entries - a.entries));
  return out;
}

export async function generateOptimizationSuggestion(input: {
  organizationId: string;
  flow: { name: string; nodes: any[]; edges: any[] };
  byNode: NodeStatRow[];
}): Promise<FlowRefreshResult> {
  const { organizationId, flow } = input;
  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
  const graph = { nodes, edges: Array.isArray(flow.edges) ? flow.edges : [] };
  const ranked = rankDropoffNodes(input.byNode ?? [], graph);

  const fallback = (note: string): FlowRefreshResult => ({
    name: flow.name,
    nodes: flow.nodes,
    edges: flow.edges,
    changeNote: note,
    source: 'fallback',
    diff: [],
  });

  if (ranked.length === 0) {
    return fallback(
      'Ainda não há dados de tráfego suficientes para sugerir otimizações — rode o fluxo com alguns clientes e tente de novo.',
    );
  }

  const target = ranked[0];
  const editable = extractEditableContent(nodes);
  const current = editable.find((c) => c.nodeId === target.nodeId);
  if (!current) return fallback('O nó com maior abandono não tem texto editável.');

  try {
    const ctx = await loadBusinessContext(organizationId);
    const pct = Math.round(target.dropoffRate * 100);

    const system = [
      'Você é o MAESTRO da ZappIQ otimizando um fluxo de atendimento no WhatsApp.',
      'Reescreva APENAS o texto deste nó para reduzir o abandono: mais claro, objetivo e com um próximo passo evidente, mantendo a INTENÇÃO e o tom do negócio.',
      'Responda EXCLUSIVAMENTE com JSON válido, sem cercas.',
    ].join(' ');

    const user = [
      '=== CONTEXTO DO NEGÓCIO ===',
      ctx.brief,
      '',
      `=== NÓ COM MAIOR ABANDONO (${pct}% dos que chegam aqui param) ===`,
      `Tipo: ${target.nodeType}. Conteúdo atual:`,
      current.value || '(vazio)',
      '',
      'Devolva: {"value":"novo texto","changeNote":"1-2 frases pro dono do negócio explicando o que mudou e por quê"}',
    ].join('\n');

    const resp = await llmRouter.complete({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 700,
      temperature: 0.4,
      forceProvider: 'anthropic-sonnet' as any,
      orgId: organizationId,
      operation: 'chat',
    });

    const parsed = extractJson(resp.text);
    if (!parsed || !parsed.value) {
      return fallback('Não consegui gerar uma sugestão agora — tente novamente.');
    }

    let value = String(parsed.value).trim();
    if (current.field === 'text') value = value.slice(0, 600);
    else if (current.field === 'tag') {
      value = value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    } else {
      value = value.slice(0, 900);
    }
    if (!value) return fallback('Sugestão vazia — tente novamente.');

    const patch: ContentField[] = [{ nodeId: target.nodeId, field: current.field, value }];
    const newNodes = applyContentPatch(nodes, patch);
    const diff = diffContent(nodes, patch);
    const changeNote = `${String(parsed.changeNote || 'Reescrevi o texto deste nó para reduzir o abandono.').slice(0, 380)} (Este nó perdia ~${pct}% dos clientes.)`;

    return {
      name: flow.name,
      nodes: newNodes,
      edges: flow.edges,
      changeNote,
      source: 'ai',
      diff,
    };
  } catch (e) {
    logger.warn('[Maestro] generateOptimizationSuggestion falhou — fallback', {
      organizationId,
      err: String(e),
    });
    return fallback('Não consegui gerar uma sugestão agora — tente novamente.');
  }
}
