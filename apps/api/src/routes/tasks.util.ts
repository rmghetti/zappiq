/**
 * FEATURE 5b.5 — Tela de Tarefas / follow-ups da IA.
 *
 * Lógica pura (sem Prisma/HTTP) do endpoint GET /api/tasks: montagem do
 * `where` a partir dos filtros de query e ordenação. Isolada aqui pra ser
 * testável em vitest sem subir banco.
 *
 * A automação (crmAutomationService) já CRIA Tasks (follow-ups da IA), mas não
 * havia rota pra listá-las. Estes helpers alimentam a tela "Tarefas" da sidebar.
 */

// Espelha enum TaskStatus do schema.prisma. Mantido como const pra validar o
// filtro de status sem importar o client do Prisma na camada pura.
export const TASK_STATUSES = ['PENDING', 'DONE', 'CANCELLED'] as const;
export type TaskStatusValue = (typeof TASK_STATUSES)[number];

export function isTaskStatus(value: unknown): value is TaskStatusValue {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

export interface TaskListFilters {
  status?: unknown;
  /** ISO date string — retorna tasks com dueDate <= este instante (vencidas/no prazo). */
  dueBefore?: unknown;
}

export interface TaskListWhere {
  organizationId: string;
  status?: TaskStatusValue;
  dueDate?: { lte: Date };
}

/**
 * Constrói o `where` do Prisma pra listagem de tasks de UMA org.
 *
 * - Sempre trava por organizationId (isolamento de tenant).
 * - `status` só entra se for um TaskStatus válido; valor inválido é IGNORADO
 *   (não derruba a request e não vaza tasks de outros status por engano —
 *   simplesmente cai no "todas as tasks da org").
 * - `dueBefore` só entra se for uma data parseável; datas inválidas são ignoradas.
 */
export function buildTaskListWhere(organizationId: string, filters: TaskListFilters = {}): TaskListWhere {
  const where: TaskListWhere = { organizationId };

  if (isTaskStatus(filters.status)) {
    where.status = filters.status;
  }

  if (typeof filters.dueBefore === 'string' && filters.dueBefore.trim() !== '') {
    const parsed = new Date(filters.dueBefore);
    if (!Number.isNaN(parsed.getTime())) {
      where.dueDate = { lte: parsed };
    }
  }

  return where;
}

/**
 * Ordenação padrão da lista: pendentes com prazo mais próximo primeiro.
 * dueDate null vai pro fim (nulls last), depois desempata por criação recente.
 */
export const TASK_LIST_ORDER_BY = [
  { dueDate: { sort: 'asc', nulls: 'last' } },
  { createdAt: 'desc' },
] as const;

/**
 * Deriva o `completedAt` de uma task a partir do NOVO status (nunca vem do
 * cliente — segurança). Regras:
 *   - vira DONE      → completedAt = agora (preserva o valor original se a task
 *                      JÁ estava concluída, pra não reescrever a data ao editar
 *                      outros campos de uma task DONE).
 *   - sai de DONE    → completedAt = null (reabrir zera a conclusão).
 *
 * Retorna `undefined` quando o status não muda no update (nada a fazer).
 */
export function resolveCompletedAt(
  nextStatus: TaskStatusValue | undefined,
  existingCompletedAt: Date | null,
  now: Date = new Date(),
): Date | null | undefined {
  if (nextStatus === undefined) return undefined;
  if (nextStatus === 'DONE') return existingCompletedAt ?? now;
  return null;
}
