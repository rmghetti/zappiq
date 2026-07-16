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
// IN_PROGRESS entrou com o quadro de tarefas (15/07/2026): é INTERMEDIÁRIO,
// não conclui nada (ver resolveCompletedAt).
export const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;
export type TaskStatusValue = (typeof TASK_STATUSES)[number];

/**
 * Colunas do quadro, na ordem em que aparecem. CANCELLED fica DE FORA de
 * propósito: quadro é o que está em jogo hoje, e uma coluna de canceladas só
 * cresce e empurra o trabalho real pra fora da tela. Elas continuam
 * alcançáveis pelo filtro de status na lista.
 */
export const TASK_BOARD_COLUMNS = ['PENDING', 'IN_PROGRESS', 'DONE'] as const;

export function isTaskStatus(value: unknown): value is TaskStatusValue {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

export interface TaskListFilters {
  status?: unknown;
  /** ISO date string — retorna tasks com dueDate <= este instante (vencidas/no prazo). */
  dueBefore?: unknown;
  /** id de TaskTag — só as tarefas que carregam ESTA etiqueta. */
  tagId?: unknown;
  /** id de User, ou a string 'me' resolvida no handler. Sem responsável: 'none'. */
  assignedToId?: unknown;
  /** Origem: CONVERSA (quem te chamou) x MIRA (quem nem te conhece) x IMPULSO. */
  origem?: unknown;
  /** id de Contact — as tarefas do painel de um contato no CRM. */
  contactId?: unknown;
  /** id de Deal — as tarefas da seção "Tarefas" do DealDrawer. */
  dealId?: unknown;
}

export interface TaskListWhere {
  organizationId: string;
  status?: TaskStatusValue;
  dueDate?: { lte: Date };
  tags?: { some: { tagId: string } };
  assignedToId?: string | null;
  origem?: TaskOrigemValue;
  contactId?: string;
  dealId?: string;
}

export const TASK_ORIGENS = ['CONVERSA', 'MIRA', 'IMPULSO'] as const;
export type TaskOrigemValue = (typeof TASK_ORIGENS)[number];

export function isTaskOrigem(value: unknown): value is TaskOrigemValue {
  return typeof value === 'string' && (TASK_ORIGENS as readonly string[]).includes(value);
}

/** cuid do Prisma. Mesmo formato aceito no rlsTenantMiddleware. */
const ID_RE = /^[a-z0-9]{20,30}$/i;

/**
 * Constrói o `where` do Prisma pra listagem de tasks de UMA org.
 *
 * - Sempre trava por organizationId (isolamento de tenant). Isto é OBRIGATÓRIO,
 *   não "defesa em profundidade": em produção a RLS não filtra para a API, que
 *   conecta como `postgres` e bypassa (ver o aviso em middleware/rlsTenant.ts).
 * - `status` só entra se for um TaskStatus válido; valor inválido é IGNORADO
 *   (não derruba a request e não vaza tasks de outros status por engano —
 *   simplesmente cai no "todas as tasks da org").
 * - `dueBefore` só entra se for uma data parseável; datas inválidas são ignoradas.
 * - `tagId`/`assignedToId` só entram se tiverem cara de cuid. Um id inválido é
 *   IGNORADO em vez de virar filtro: filtrar por lixo devolveria lista vazia e
 *   o cliente leria "não tenho tarefa nenhuma" (mentira) em vez de "seu filtro
 *   não valeu".
 * - `assignedToId: 'none'` é o caso REAL da base: hoje 100% das tarefas nascem
 *   sem dono, então "sem responsável" precisa ser filtrável de propósito.
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

  if (typeof filters.tagId === 'string' && ID_RE.test(filters.tagId)) {
    where.tags = { some: { tagId: filters.tagId } };
  }

  if (filters.assignedToId === 'none') {
    where.assignedToId = null;
  } else if (typeof filters.assignedToId === 'string' && ID_RE.test(filters.assignedToId)) {
    where.assignedToId = filters.assignedToId;
  }

  if (isTaskOrigem(filters.origem)) {
    where.origem = filters.origem;
  }

  if (typeof filters.contactId === 'string' && ID_RE.test(filters.contactId)) {
    where.contactId = filters.contactId;
  }

  if (typeof filters.dealId === 'string' && ID_RE.test(filters.dealId)) {
    where.dealId = filters.dealId;
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
 * IN_PROGRESS cai no "sai de DONE" e zera — está CERTO: pegar a tarefa de volta
 * pra trabalhar significa que ela não está mais concluída.
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
