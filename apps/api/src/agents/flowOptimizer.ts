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
