/* ══════════════════════════════════════════════════════════════════════
 * Deal Attribution (Fase B) — vínculo conversa→deal + AI Influence Score.
 * --------------------------------------------------------------------
 * Heurística de vínculo (pesquisa de mercado): mesmo Contact + janela 7d
 * antes do ganho (ou da criação), conversa com mensagens da Iza. Auto-vincula
 * quando há candidato único; senão sugere para confirmação humana.
 * Influence Score = crédito proporcional da IA = msgs da Iza / (Iza + humanas)
 * na janela. Tudo read-only exceto o set explícito do vínculo.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';

const WINDOW_MS = 7 * 86400000;

export interface CandidateConversation {
  conversationId: string;
  candidateCount: number;
  confidence: 'high' | 'medium';
  lastMessage: { content: string; createdAt: Date } | null;
}

/** Janela de referência de um deal: ganho (wonAt) ou, se aberto, criação. */
function refDate(deal: { wonAt: Date | null; createdAt: Date }): Date {
  return deal.wonAt ?? deal.createdAt;
}

/** Acha a conversa candidata a originar/destravar o deal (mesmo contato, Iza em 7d). */
export async function findCandidateConversation(
  orgId: string,
  deal: { contactId: string; wonAt: Date | null; createdAt: Date },
): Promise<CandidateConversation | null> {
  const ref = refDate(deal);
  const since = new Date(ref.getTime() - WINDOW_MS);
  const convs = await prisma.conversation.findMany({
    where: {
      organizationId: orgId,
      contactId: deal.contactId,
      messages: { some: { isFromBot: true, createdAt: { gte: since, lte: ref } } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, createdAt: true } },
    },
  });
  if (convs.length === 0) return null;
  return {
    conversationId: convs[0].id,
    candidateCount: convs.length,
    confidence: convs.length === 1 ? 'high' : 'medium',
    lastMessage: convs[0].messages[0] ?? null,
  };
}

/** Crédito proporcional da IA na janela antes do ref (0–100) + contagens. */
export async function computeInfluence(
  orgId: string,
  contactId: string,
  ref: Date,
): Promise<{ izaMsgs: number; humanMsgs: number; score: number }> {
  const since = new Date(ref.getTime() - WINDOW_MS);
  const [izaMsgs, humanMsgs] = await Promise.all([
    prisma.message.count({ where: { isFromBot: true, conversation: { contactId, organizationId: orgId }, createdAt: { gte: since, lte: ref } } }),
    prisma.message.count({ where: { isFromBot: false, direction: 'OUTBOUND', conversation: { contactId, organizationId: orgId }, createdAt: { gte: since, lte: ref } } }),
  ]);
  const total = izaMsgs + humanMsgs;
  return { izaMsgs, humanMsgs, score: total > 0 ? Math.round((izaMsgs / total) * 100) : 0 };
}

/**
 * Auto-vincula deals ganhos sem vínculo e ainda não revisados quando há
 * candidato ÚNICO (alta confiança). Retorna quantos vinculou. Fail-soft.
 */
export async function autoLinkWonDeals(orgId: string): Promise<number> {
  const deals = await prisma.deal.findMany({
    where: { organizationId: orgId, wonAt: { not: null }, sourceConversationId: null, aiLinkReviewed: false },
    select: { id: true, contactId: true, wonAt: true, createdAt: true },
    take: 200,
  });
  let linked = 0;
  for (const d of deals) {
    const cand = await findCandidateConversation(orgId, d);
    if (cand && cand.confidence === 'high') {
      await prisma.deal.update({
        where: { id: d.id },
        data: { sourceConversationId: cand.conversationId, aiLinkReviewed: true },
      }).then(() => { linked++; }).catch(() => {});
    }
  }
  return linked;
}

/** Deals que precisam de confirmação humana (candidato existe, ainda não revisado). */
export async function pendingSuggestions(orgId: string): Promise<Array<{
  dealId: string; title: string | null; value: number; contactName: string | null;
  conversationId: string; candidateCount: number; lastMessage: { content: string; createdAt: Date } | null;
}>> {
  const deals = await prisma.deal.findMany({
    where: { organizationId: orgId, sourceConversationId: null, aiLinkReviewed: false },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: { id: true, title: true, value: true, contactId: true, wonAt: true, createdAt: true, contact: { select: { name: true } } },
  });
  const out: Awaited<ReturnType<typeof pendingSuggestions>> = [];
  for (const d of deals) {
    const cand = await findCandidateConversation(orgId, d);
    if (cand) {
      out.push({
        dealId: d.id, title: d.title, value: Number(d.value ?? 0), contactName: d.contact?.name ?? null,
        conversationId: cand.conversationId, candidateCount: cand.candidateCount, lastMessage: cand.lastMessage,
      });
    }
  }
  return out;
}
