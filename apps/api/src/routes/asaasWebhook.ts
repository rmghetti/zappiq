import { Router, Request, Response } from 'express';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { getAsaasConfigFromSettings, parsePixReference, asaasEventToOutcome } from '../services/asaasPix.js';
import { getCapiConfigFromSettings, buildCapiPurchaseEvent, capiReady, sendCapiEvent } from '../services/metaCapi.js';

/*
 * Webhook do Asaas — confirmação de pagamento Pix do lojista. Montado com
 * express.raw (corpo cru). Verifica, por org, o token que o próprio Asaas envia
 * no header (asaas-access-token, configurado por org). Ao confirmar o pagamento:
 *  1) dá baixa no CRM (marca o Deal como ganho + valor);
 *  2) registra a atribuição de receita à campanha;
 *  3) fecha o LOOP DE RECEITA: manda a conversão de compra à Meta CAPI se a
 *     conversa veio de anúncio (ctwa_clid) e a org tiver o CAPI configurado.
 */
const router = Router();

router.post('/', async (req: Request, res: Response) => {
  // ACK rápido (o Asaas reenvia se não receber 200 logo); processa em seguida.
  res.status(200).json({ received: true });
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    const body = JSON.parse(raw || '{}');
    const ref = parsePixReference(body?.payment?.externalReference);
    if (!ref) return;
    if (asaasEventToOutcome(String(body?.event || '')) !== 'paid') return;

    const org = await prisma.organization.findUnique({ where: { id: ref.orgId }, select: { settings: true } });
    if (!org) return;

    // Verificação do token por org (o Asaas envia o token configurado no header).
    const { webhookToken } = getAsaasConfigFromSettings(org.settings);
    const provided = req.headers['asaas-access-token'];
    if (!webhookToken || provided !== webhookToken) {
      logger.warn(`[Asaas] webhook com token inválido (org=${ref.orgId})`);
      return;
    }

    const value = Number(body?.payment?.value) || 0;

    // 1) Baixa no CRM.
    const deal = await prisma.deal.findFirst({
      where: { id: ref.dealId, organizationId: ref.orgId },
      include: { contact: true },
    });
    if (deal) {
      await prisma.deal.update({ where: { id: deal.id }, data: { stage: 'won', value } });
    }

    if (deal) {
      const cents = Math.round(value * 100);
      // 2) Atribuição de receita: atualiza a atribuição existente do contato
      // (preserva o ctwa_clid do clique) ou cria uma se a origem for uma campanha.
      const attr = await prisma.campaignAttribution.findFirst({
        where: { contactId: deal.contactId },
        orderBy: { createdAt: 'desc' },
      });
      if (attr) {
        await prisma.campaignAttribution
          .update({ where: { id: attr.id }, data: { revenueCents: attr.revenueCents + cents, converted: true, convertedAt: new Date() } })
          .catch((e) => logger.warn(`[Asaas] atribuição falhou: ${e instanceof Error ? e.message : e}`));
      } else if (deal.sourceCampaignId) {
        await prisma.campaignAttribution
          .create({
            data: {
              organizationId: ref.orgId,
              campaignId: deal.sourceCampaignId,
              contactId: deal.contactId,
              source: 'organic',
              revenueCents: cents,
              converted: true,
              convertedAt: new Date(),
            },
          })
          .catch((e) => logger.warn(`[Asaas] atribuição falhou: ${e instanceof Error ? e.message : e}`));
      }

      // 3) Loop de Receita: conversão de compra à Meta CAPI (se veio de anúncio).
      const ctwaClid = attr?.ctwaClid ?? null;
      const capi = getCapiConfigFromSettings(org.settings);
      if (capiReady(capi, ctwaClid)) {
        const ev = buildCapiPurchaseEvent({
          ctwaClid: ctwaClid!,
          value,
          currency: 'BRL',
          phone: deal.contact?.phone,
          email: deal.contact?.email ?? undefined,
          eventId: deal.id,
          eventTimeSec: Math.floor(Date.now() / 1000),
        });
        await sendCapiEvent(capi!, ev)
          .then(() => attr && prisma.campaignAttribution.update({ where: { id: attr.id }, data: { capiSentAt: new Date() } }).catch(() => {}))
          .catch((e) => logger.warn(`[CAPI] envio falhou: ${e instanceof Error ? e.message : e}`));
      }
    }

    logger.info(`[Asaas] pagamento confirmado org=${ref.orgId} deal=${ref.dealId} R$ ${value}`);
  } catch (err) {
    logger.error('[Asaas] erro no webhook', err);
  }
});

export default router;
