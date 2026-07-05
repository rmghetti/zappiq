/**
 * campaignStatus.util.ts — W2.4 (fechar loop de campanhas)
 * ---------------------------------------------------------------------------
 * Aplica um status callback da Meta (SENT/DELIVERED/READ) a uma Message e,
 * quando a mensagem pertence a uma campanha, propaga delivered/read para os
 * contadores da Campanha — 1x por patamar cruzado (Meta reenvia status, então
 * a transição é monotônica e idempotente por patamar).
 */
import { bumpCampaignCounter } from '../services/queueService.js';

const RANK: Record<string, number> = { SENT: 0, DELIVERED: 1, READ: 2 };

/** Normaliza o status cru da Meta para o enum MessageStatus. */
export function normalizeMetaStatus(raw: string | undefined): 'SENT' | 'DELIVERED' | 'READ' {
  const up = raw?.toUpperCase();
  return up === 'READ' ? 'READ' : up === 'DELIVERED' ? 'DELIVERED' : 'SENT';
}

/**
 * Processa UM status callback. Retorna o que foi feito (útil pra teste).
 * - Só avança o status (nunca regride).
 * - Incrementa deliveredCount/readCount da campanha 1x por patamar cruzado.
 */
export async function applyMessageStatusUpdate(
  prisma: any,
  status: { id: string; status?: string },
): Promise<{ updated: boolean; deliveredBumped: boolean; readBumped: boolean }> {
  const result = { updated: false, deliveredBumped: false, readBumped: false };
  const newStatus = normalizeMetaStatus(status.status);

  const msg = await prisma.message.findUnique({
    where: { whatsappMessageId: status.id },
    select: { id: true, status: true, campaignId: true },
  });
  if (!msg) return result;

  const prevRank = RANK[msg.status] ?? 0;
  const nextRank = RANK[newStatus] ?? 0;
  // Nunca regride nem reconta: só avança se o novo patamar é maior.
  if (nextRank <= prevRank) return result;

  await prisma.message.update({
    where: { id: msg.id },
    data: { status: newStatus },
  });
  result.updated = true;

  // Cruzou novos patamares → incrementa os contadores da campanha 1x cada.
  // READ implica DELIVERED: se pulou SENT→READ direto, conta os dois.
  if (msg.campaignId) {
    if (prevRank < RANK.DELIVERED && nextRank >= RANK.DELIVERED) {
      await bumpCampaignCounter(prisma, msg.campaignId, 'deliveredCount');
      result.deliveredBumped = true;
    }
    if (prevRank < RANK.READ && nextRank >= RANK.READ) {
      await bumpCampaignCounter(prisma, msg.campaignId, 'readCount');
      result.readBumped = true;
    }
  }
  return result;
}

/**
 * Atribui uma RESPOSTA (repliedCount) a uma campanha quando um INBOUND chega.
 * Chamado no webhook logo após salvar a mensagem inbound. É idempotente por
 * conversa+campanha: só conta a PRIMEIRA resposta ao vínculo mais recente de
 * campanha na conversa. Sem flag no schema — deduz olhando se já existe algum
 * INBOUND anterior depois do último OUTBOUND de campanha.
 *
 * W2.8 — além de contar o reply, grava sourceCampaignId no Contact (first-touch:
 * só se o contato ainda não tem origem atribuída). Esse é o único ponto onde
 * sourceCampaignId passa a ser ESCRITO — antes era só lido, deixando a página
 * de atribuição (receita/ROI) eternamente zerada. Do Contact a origem é
 * propagada ao Deal criado por intenção de compra (crmAutomationService).
 *
 * Retorna a campaignId contabilizada (ou null se nada foi contado).
 */
export async function attributeCampaignReply(
  prisma: any,
  conversationId: string,
  inboundMessageId: string,
  contactId?: string,
): Promise<string | null> {
  // Último OUTBOUND de campanha na conversa.
  const lastCampaignMsg = await prisma.message.findFirst({
    where: {
      conversationId,
      direction: 'OUTBOUND',
      campaignId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, campaignId: true, createdAt: true },
  });
  if (!lastCampaignMsg?.campaignId) return null;

  // Já houve um INBOUND depois desse OUTBOUND (fora o que acabou de chegar)?
  // Se sim, a resposta já foi contada — não conta de novo.
  const priorReply = await prisma.message.findFirst({
    where: {
      conversationId,
      direction: 'INBOUND',
      id: { not: inboundMessageId },
      createdAt: { gt: lastCampaignMsg.createdAt },
    },
    select: { id: true },
  });
  if (priorReply) return null;

  await bumpCampaignCounter(prisma, lastCampaignMsg.campaignId, 'repliedCount');

  // W2.8 — grava a origem no Contact em first-touch. updateMany + filtro
  // sourceCampaignId:null torna a escrita idempotente e não sobrescreve uma
  // atribuição anterior (a primeira campanha que o contato respondeu vence).
  if (contactId) {
    await prisma.contact.updateMany({
      where: { id: contactId, sourceCampaignId: null },
      data: { sourceCampaignId: lastCampaignMsg.campaignId },
    });
  }

  return lastCampaignMsg.campaignId;
}
