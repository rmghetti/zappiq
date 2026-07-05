/**
 * Feature 5a.3 — shaping puro do payload de detalhe do deal (GET /api/deals/:id).
 *
 * A query do Prisma (deal + contact + sourceConversation) e a query de activities
 * são feitas no handler; esta função só COMBINA os dois resultados no formato que
 * o drawer do kanban consome. Extraída pra ser testável sem I/O (mesmo padrão dos
 * demais deals.*.util).
 */

export interface DealDetailActivity {
  id: string;
  type: string;
  actor: string;
  title: string;
  body: string | null;
  conversationId: string | null;
  createdAt: Date;
}

/**
 * Combina o deal (com contato/conversa já incluídos) com a lista de activities.
 * As activities entram como estão (o handler já ordena desc e limita). Retorna um
 * objeto novo — não muta o deal recebido.
 */
export function buildDealDetail<T extends Record<string, unknown>>(
  deal: T,
  activities: DealDetailActivity[],
): T & { activities: DealDetailActivity[] } {
  return { ...deal, activities: Array.isArray(activities) ? activities : [] };
}
