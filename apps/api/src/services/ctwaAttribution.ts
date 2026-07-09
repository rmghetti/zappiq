/*
 * ctwaAttribution — captura do ctwa_clid do Click-to-WhatsApp.
 *
 * Quando uma mensagem chega de um anúncio (CTWA), o payload da Meta traz um
 * objeto `referral` com o `ctwa_clid` (o click id, equivalente ao gclid). Guardar
 * esse id numa CampaignAttribution é o que fecha o Loop de Receita: depois, quando
 * a venda entra no CRM, mandamos a conversão de volta ao Meta (CAPI) com esse id.
 */
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';

export interface CtwaReferral {
  ctwaClid: string;
  adId: string | null;
  sourceType: string | null;
}

/** Extrai o referral do CTWA da mensagem do WhatsApp (puro). Sem ctwa_clid → null. */
export function parseCtwaReferral(referral: unknown): CtwaReferral | null {
  if (!referral || typeof referral !== 'object') return null;
  const r = referral as Record<string, unknown>;
  const ctwaClid = typeof r.ctwa_clid === 'string' && r.ctwa_clid.length > 0 ? r.ctwa_clid : null;
  if (!ctwaClid) return null;
  return {
    ctwaClid,
    adId: typeof r.source_id === 'string' && r.source_id ? r.source_id : null,
    sourceType: typeof r.source_type === 'string' && r.source_type ? r.source_type : null,
  };
}

/**
 * Registra a atribuição CTWA para o contato (idempotente por ctwa_clid). Não
 * lança — a captura nunca deve derrubar o processamento da mensagem.
 */
export async function recordCtwaAttribution(input: {
  organizationId: string;
  contactId: string;
  referral: unknown;
}): Promise<void> {
  try {
    const ref = parseCtwaReferral(input.referral);
    if (!ref) return;
    const existing = await prisma.campaignAttribution.findFirst({
      where: { organizationId: input.organizationId, contactId: input.contactId, ctwaClid: ref.ctwaClid },
      select: { id: true },
    });
    if (existing) return;
    await prisma.campaignAttribution.create({
      data: {
        organizationId: input.organizationId,
        contactId: input.contactId,
        source: 'ctwa',
        ctwaClid: ref.ctwaClid,
        adId: ref.adId,
      },
    });
    logger.info(`[CTWA] atribuição capturada org=${input.organizationId} contato=${input.contactId} clid=${ref.ctwaClid}`);
  } catch (err) {
    logger.warn(`[CTWA] captura falhou: ${err instanceof Error ? err.message : err}`);
  }
}
