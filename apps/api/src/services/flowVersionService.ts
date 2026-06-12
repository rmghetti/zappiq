/**
 * Maestro v2 — versionamento de fluxos (spec 2026-06-11).
 * Snapshot imutável a cada publish/refresh/restore; restore cria NOVA versão.
 */
import { prisma } from '@zappiq/database';

export type FlowVersionSource = 'publish' | 'refresh' | 'restore';

interface FlowLike {
  id: string;
  organizationId: string;
  name: string;
  nodes: unknown;
  edges: unknown;
  triggerType: unknown;
  triggerConfig: unknown;
}

/** Parte pura: monta os dados do snapshot (testável sem DB). */
export function buildVersionSnapshot(
  flow: FlowLike,
  version: number,
  source: FlowVersionSource,
  createdById: string | null,
) {
  return {
    flowId: flow.id,
    organizationId: flow.organizationId,
    version,
    name: flow.name,
    nodes: (flow.nodes as any) ?? [],
    edges: (flow.edges as any) ?? [],
    triggerType: flow.triggerType as any,
    triggerConfig: (flow.triggerConfig as any) ?? null,
    source,
    createdById,
  };
}

/**
 * Registra o snapshot da PRÓXIMA versão do fluxo em transação atômica
 * (protege contra publicações simultâneas) e incrementa Flow.version para
 * o mesmo número. Devolve o número da versão criada.
 *
 * Efeitos colaterais:
 *  - Insere uma linha em FlowVersion com os dados atuais do fluxo.
 *  - Atualiza Flow.version para o novo valor.
 */
export async function snapshotFlowVersion(
  flowId: string,
  organizationId: string,
  source: FlowVersionSource,
  createdById: string | null,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const flow = await tx.flow.findFirstOrThrow({ where: { id: flowId, organizationId } });
    const last = await tx.flowVersion.findFirst({
      where: { flowId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const next = Math.max(flow.version, last?.version ?? 0) + 1;
    await tx.flowVersion.create({ data: buildVersionSnapshot(flow as any, next, source, createdById) });
    await tx.flow.update({ where: { id: flowId }, data: { version: next } });
    return next;
  });
}
