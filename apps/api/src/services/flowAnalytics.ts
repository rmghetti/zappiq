import { prisma, Prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

export interface NodeStatRow {
  nodeId: string;
  nodeType: string;
  nodeLabel?: string | null;
  entries: number;
  ends: number;
}

export function aggregate(rows: NodeStatRow[]): { totalEntries: number; byNode: NodeStatRow[] } {
  const map = new Map<string, NodeStatRow>();
  for (const r of rows) {
    const cur = map.get(r.nodeId);
    if (cur) {
      cur.entries += r.entries;
      cur.ends += r.ends;
    } else {
      map.set(r.nodeId, {
        nodeId: r.nodeId,
        nodeType: r.nodeType,
        nodeLabel: r.nodeLabel ?? null,
        entries: r.entries,
        ends: r.ends,
      });
    }
  }
  const byNode = [...map.values()];
  const totalEntries = byNode.reduce((s, n) => s + n.entries, 0);
  return { totalEntries, byNode };
}

export async function recordNodeStats(input: {
  organizationId: string;
  flowId: string;
  graph: { nodes: any[] };
  visitedNodeIds: string[];
  ended: boolean;
}): Promise<void> {
  const { organizationId, flowId, graph, visitedNodeIds, ended } = input;
  if (!visitedNodeIds || visitedNodeIds.length === 0) return;
  try {
    const period = new Date().toISOString().slice(0, 10);
    const lastIdx = visitedNodeIds.length - 1;
    for (let i = 0; i < visitedNodeIds.length; i++) {
      const nodeId = visitedNodeIds[i];
      const node = graph.nodes.find((n) => n?.id === nodeId);
      const nodeType = String(node?.type ?? 'unknown');
      const nodeLabel = node?.data?.label ? String(node.data.label).slice(0, 80) : null;
      const ends = ended && i === lastIdx ? 1 : 0;
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "flow_node_stats" ("id","organizationId","flowId","nodeId","nodeType","nodeLabel","period","entries","ends","createdAt","updatedAt")
        VALUES (${randomUUID()}, ${organizationId}, ${flowId}, ${nodeId}, ${nodeType}, ${nodeLabel}, ${period}, 1, ${ends}, now(), now())
        ON CONFLICT ("flowId","nodeId","period")
        DO UPDATE SET "entries" = "flow_node_stats"."entries" + 1, "ends" = "flow_node_stats"."ends" + ${ends}, "updatedAt" = now()
      `);
    }
  } catch (e) {
    logger.warn('[Maestro] recordNodeStats falhou (fail-soft)', {
      organizationId,
      flowId,
      err: String(e),
    });
  }
}
