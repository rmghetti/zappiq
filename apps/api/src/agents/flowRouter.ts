/**
 * Maestro v2 — flowRouter (PURO, spec 2026-06-11 Frente 3).
 * Decide QUAL fluxo ativo inicia para uma mensagem inbound, quando a conversa
 * não está mid-flow. Ranking: keyword exata > keyword substring > FIRST_CONTACT
 * (só conversa nova). Desempate: priority desc → updatedAt desc → id asc
 * (lexicográfico, menor vence) — completamente determinístico.
 * Substitui o gate antigo (flowTriggerMatches) mantendo o substring match como
 * rank 2 e adicionando match exato (rank 3) e consciência de conversa encerrada
 * (ENDED). SCHEDULE/MANUAL/EVENT/CUSTOM/CART_ABANDONED/TIMEOUT_* não
 * auto-iniciam no inbound (fail-closed).
 */
export interface RoutableFlow {
  id: string;
  triggerType: string;
  triggerConfig: unknown;
  priority: number;
  updatedAt: Date;
}

export interface RouteContext {
  /** true quando a conversa já concluiu um fluxo (marcador ENDED). */
  conversationEnded: boolean;
}

type MatchRank = 3 | 2 | 1; // 3=keyword exata, 2=keyword substring, 1=first_contact

function keywordsOf(triggerConfig: unknown): string[] {
  const cfg = (triggerConfig as Record<string, any>) || {};
  if (Array.isArray(cfg.keywords)) return cfg.keywords.filter(Boolean).map((k: any) => String(k).trim()).filter(Boolean);
  if (typeof cfg.keyword === 'string' && cfg.keyword.trim()) return [cfg.keyword.trim()];
  return [];
}

function rankFlow(flow: RoutableFlow, message: string, ctx: RouteContext): MatchRank | null {
  const m = (message || '').trim().toLowerCase();
  if (flow.triggerType === 'KEYWORD') {
    const kws = keywordsOf(flow.triggerConfig).map((k) => k.toLowerCase());
    if (kws.length === 0) return null;
    if (kws.some((k) => m === k)) return 3;
    if (kws.some((k) => k && m.includes(k))) return 2;
    return null;
  }
  if (flow.triggerType === 'FIRST_CONTACT') {
    return ctx.conversationEnded ? null : 1;
  }
  return null;
}

export function pickFlowForMessage(
  flows: RoutableFlow[], message: string, ctx: RouteContext,
): RoutableFlow | null {
  let best: { flow: RoutableFlow; rank: MatchRank } | null = null;
  for (const flow of flows) {
    const rank = rankFlow(flow, message, ctx);
    if (rank === null) continue;
    if (
      !best ||
      rank > best.rank ||
      (rank === best.rank && flow.priority > best.flow.priority) ||
      (rank === best.rank && flow.priority === best.flow.priority &&
        flow.updatedAt.getTime() > best.flow.updatedAt.getTime()) ||
      (rank === best.rank && flow.priority === best.flow.priority &&
        flow.updatedAt.getTime() === best.flow.updatedAt.getTime() &&
        flow.id.localeCompare(best.flow.id) < 0)
    ) {
      best = { flow, rank };
    }
  }
  return best?.flow ?? null;
}
