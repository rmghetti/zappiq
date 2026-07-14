/* ══════════════════════════════════════════════════════════════════════════
 * Maestro — mapeamento round-trip: API ⇄ canvas do React Flow.
 * --------------------------------------------------------------------------
 * Mora fora do page.tsx porque é a parte do editor capaz de DESTRUIR dado do
 * cliente: o que sai de canvasNodesToApiNodes() é gravado por cima do fluxo.
 *
 * REGRA INEGOCIÁVEL: salvar nunca pode apagar o `type` de um nó que o editor
 * não sabe desenhar. Por isso o tipo atravessa o round-trip VERBATIM — não há
 * coerção para 'message' na entrada, e portanto nada a "restaurar" na saída.
 * O tipo fica correto por construção, não por convenção.
 *
 * Puro de propósito (sem React, sem ícone): é o que torna o teste barato —
 * roda no vitest em ambiente node, sem jsdom.
 * ══════════════════════════════════════════════════════════════════════════ */

/** Nó no shape da API (/api/flows). `type` é string livre: o motor
 *  (flowEngine.ts) não usa enum, e a rota aceita z.array(z.any()). */
export interface MaestroApiNode {
  id?: string;
  type?: string;
  label?: string;
  data?: Record<string, any> | null;
  position?: { x: number; y: number } | null;
}

/** Nó no shape do canvas. Estruturalmente compatível com o Node do React Flow
 *  (por isso não importamos o tipo daqui: manter o módulo livre de deps). */
export interface MaestroCanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
}

/** Tipo atribuído a nó que chega SEM type nenhum. É o único caso em que o
 *  editor escolhe um tipo, e é seguro: não havia informação para perder. */
export const TYPELESS_NODE_FALLBACK = 'message';

export interface ApiNodesToCanvasOptions {
  /** Rótulo de exibição para um tipo (vem do NODE_META, que tem ícone/React). */
  labelFor: (type: string) => string;
  /** Gerador de id para nó que chega sem id. */
  genId: () => string;
}

/** API → canvas. Preserva `type`, `data` e `position` verbatim. */
export function apiNodesToCanvasNodes(
  apiNodes: MaestroApiNode[] | null | undefined,
  { labelFor, genId }: ApiNodesToCanvasOptions,
): MaestroCanvasNode[] {
  return (apiNodes || []).map((n, i) => {
    const type = n.type || TYPELESS_NODE_FALLBACK;
    return {
      id: n.id || genId(),
      type,
      position:
        n.position && typeof n.position.x === 'number'
          ? n.position
          : { x: 120, y: 60 + i * 110 },
      data: { ...(n.data || {}), label: n.data?.label || n.label || labelFor(type) },
    };
  });
}

/** Canvas → API. `n.type` já é o tipo original (nunca foi coagido na entrada). */
export function canvasNodesToApiNodes(
  nodes: readonly MaestroCanvasNode[],
): MaestroApiNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    label: n.data?.label,
    data: n.data,
    position: n.position,
  }));
}

/** Tipos presentes no grafo que o editor não sabe desenhar, ordenados e sem
 *  repetição. A string derivada daqui é chave de memo estável para o registro
 *  `nodeTypes` do React Flow — memoizar sobre o array de nós remontaria todo
 *  nó a cada arrastar. */
export function unsupportedNodeTypes(
  nodes: readonly { type?: string }[],
  isSupported: (type: string) => boolean,
): string[] {
  const out = new Set<string>();
  for (const n of nodes) {
    if (n.type && !isSupported(n.type)) out.add(n.type);
  }
  return Array.from(out).sort();
}
