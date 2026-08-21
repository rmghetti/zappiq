/*
 * metaBillingLedger — ledger de custo Meta (Resposta Meta 2026, plano 8.1 item 1).
 *
 * Todo status callback do WhatsApp traz, nos de sent/delivered, o bloco
 * `pricing` (billable, pricing_model, category, type). Até aqui esses campos
 * eram DESCARTADOS: o webhook só aplicava o status na Message. A partir de
 * 01/10/2026 a categoria service passa a ser cobrada por mensagem ENTREGUE,
 * então cada status vira um MetaBillingEvent (upsert por wamid) — a
 * matéria-prima da Conta Clara e da conciliação com a fatura da Meta.
 *
 * Contrato: best-effort. Esta função NUNCA lança — falha de ledger não pode
 * atrapalhar o applyMessageStatusUpdate nem derrubar o webhook.
 */
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';

/**
 * Registra UM status callback da Meta no ledger de billing.
 *
 * - Upsert por wamid (status.id): reenvio do mesmo status não duplica.
 * - Campos de pricing só entram quando o callback traz `pricing` — o status
 *   `read` vem SEM pricing e não pode apagar o que sent/delivered gravou.
 * - deliveredAt só AVANÇA (first-touch): a primeira entrega fica registrada
 *   e reenvios nunca a sobrescrevem.
 * - Vincula messageId/conversationId quando o wamid é de uma Message nossa;
 *   sem match, o evento fica só com org + wamid (ainda concilia fatura).
 */
export async function recordMetaBillingEvent(
  status: any,
  phoneNumberId: string | undefined,
  organizationId: string,
): Promise<void> {
  try {
    const wamid: string | undefined =
      typeof status?.id === 'string' && status.id ? status.id : undefined;
    if (!wamid || !organizationId) return;

    const pricing = status?.pricing && typeof status.pricing === 'object' ? status.pricing : null;
    const statusStr = typeof status?.status === 'string' && status.status ? status.status : 'unknown';
    const recipientId =
      typeof status?.recipient_id === 'string' && status.recipient_id ? status.recipient_id : null;

    // Meta manda timestamp em SEGUNDOS (string). Sem timestamp válido, null.
    const tsNum = Number(status?.timestamp);
    const statusTs =
      status?.timestamp != null && Number.isFinite(tsNum) && tsNum > 0
        ? new Date(tsNum * 1000)
        : null;

    // Vínculo com a Message local (outbound gravada com whatsappMessageId).
    // Opcional por desenho: falha ou ausência não impede o registro.
    let messageId: string | null = null;
    let conversationId: string | null = null;
    try {
      const msg = await prisma.message.findUnique({
        where: { whatsappMessageId: wamid },
        select: { id: true, conversationId: true },
      });
      if (msg) {
        messageId = msg.id;
        conversationId = msg.conversationId;
      }
    } catch (err) {
      logger.warn(
        `[MetaBilling] vínculo com Message falhou (segue sem): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Derivados do pricing. Ausente (ex.: status read) → nem entram no update.
    const pricingFields = pricing
      ? {
          billable: typeof pricing.billable === 'boolean' ? pricing.billable : null,
          pricingModel: typeof pricing.pricing_model === 'string' ? pricing.pricing_model : null,
          category: typeof pricing.category === 'string' ? pricing.category : null,
          pricingType: typeof pricing.type === 'string' ? pricing.type : null,
          rawPricing: pricing,
        }
      : null;

    await prisma.metaBillingEvent.upsert({
      where: { wamid },
      create: {
        organizationId,
        wamid,
        recipientId,
        status: statusStr,
        phoneNumberId: phoneNumberId ?? null,
        messageId,
        conversationId,
        statusTs,
        ...(pricingFields ?? {}),
      },
      update: {
        status: statusStr,
        ...(recipientId ? { recipientId } : {}),
        ...(statusTs ? { statusTs } : {}),
        ...(messageId ? { messageId, conversationId } : {}),
        ...(pricingFields ?? {}),
      },
    });

    // deliveredAt first-touch: updateMany com filtro null é idempotente e
    // race-safe (mesmo padrão do sourceCampaignId em campaignStatus.util).
    if (statusStr === 'delivered') {
      await prisma.metaBillingEvent.updateMany({
        where: { wamid, deliveredAt: null },
        data: { deliveredAt: statusTs ?? new Date() },
      });
    }
  } catch (err) {
    // Contrato best-effort: o ledger nunca derruba o fluxo de status.
    logger.warn(
      `[MetaBilling] falha ao registrar evento de billing: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
