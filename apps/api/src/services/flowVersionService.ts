/**
 * Maestro v2 — versionamento de fluxos (spec 2026-06-11).
 * Snapshot imutável a cada publish/refresh/restore; restore cria NOVA versão.
 */
import { prisma, Prisma } from '@zappiq/database';

export type FlowVersionSource = 'publish' | 'refresh' | 'restore';

interface FlowLike {
  id: string;
  organizationId: string;
  name: string;
  version: number;
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

const MAX_RETRIES = 3;

/**
 * Registra o snapshot da PRÓXIMA versão do fluxo em transação serializável
 * com retry automático em conflitos de concorrência (P2034/P2002, até 3 tentativas).
 *
 * Efeitos colaterais:
 *  - Insere uma linha em FlowVersion com os dados atuais do fluxo.
 *  - Atualiza Flow.version para o novo valor.
 *
 * Lança 404 (statusCode) quando o fluxo não existe na organização (P2025).
 * Lança Error 'snapshotFlowVersion: max retries exceeded' após esgotar tentativas.
 */
export async function snapshotFlowVersion(
  flowId: string,
  organizationId: string,
  source: FlowVersionSource,
  createdById: string | null,
): Promise<number> {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      return await prisma.$transaction(
        async (tx) => {
          // Busca o fluxo; lança 404 se não existir na org
          const flow = await tx.flow
            .findFirstOrThrow({ where: { id: flowId, organizationId } })
            .catch((err: unknown) => {
              if (
                err instanceof Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2025'
              ) {
                throw Object.assign(
                  new Error('Flow not found: ' + flowId),
                  { statusCode: 404 },
                );
              }
              throw err;
            });

          const last = await tx.flowVersion.findFirst({
            where: { flowId },
            orderBy: { version: 'desc' },
            select: { version: true },
          });

          const next = Math.max(flow.version, last?.version ?? 0) + 1;

          await tx.flowVersion.create({
            data: buildVersionSnapshot(flow, next, source, createdById),
          });
          await tx.flow.update({ where: { id: flowId }, data: { version: next } });

          return next;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      // Retry em conflito de serialização ou unique constraint (publicações simultâneas)
      if ((code === 'P2034' || code === 'P2002') && attempt < MAX_RETRIES) {
        continue;
      }
      throw err;
    }
  }

  throw new Error('snapshotFlowVersion: max retries exceeded');
}
