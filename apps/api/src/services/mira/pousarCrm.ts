/**
 * Mira Prospects — pouso no CRM (entrega 1).
 *
 * Um Alvo READY vira registro trabalhável no CRM da ZappIQ:
 *   - Contact da conta (whatsappId = telefone comercial quando existe;
 *     senão id sintético "mira:{cnpj}" — convenção documentada; o número
 *     real entra quando o cliente conectar a conversa).
 *   - Deal ligado ao Contact (título "Mira · {conta}", estágio inicial),
 *     para a oportunidade aparecer no pipeline.
 * Idempotente: se o Alvo já tem contactId/dealId, reaproveita. Status do
 * Alvo vai a DELIVERED (não mexe em cota: cota foi no READY).
 */
import { prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';

export interface PousarResult {
  contactId: string;
  dealId: string;
  reused: boolean;
}

export async function pousarNoCrm(organizationId: string, alvoId: string): Promise<PousarResult> {
  const alvo = await (prisma as any).miraAlvo.findFirst({
    where: { id: alvoId, organizationId },
    include: { decisores: { orderBy: { confianca: 'desc' }, take: 3 } },
  });
  if (!alvo) {
    const err: any = new Error('alvo_not_found');
    err.status = 404;
    throw err;
  }
  if (alvo.status !== 'READY' && alvo.status !== 'DELIVERED') {
    const err: any = new Error('alvo_nao_pronto');
    err.status = 409;
    throw err;
  }

  // Idempotência
  if (alvo.contactId && alvo.dealId) {
    return { contactId: alvo.contactId, dealId: alvo.dealId, reused: true };
  }

  const displayName = alvo.nomeFantasia || alvo.nome;
  const phoneDigits: string = (alvo.telefone ?? '').replace(/\D/g, '');
  const whatsappId = phoneDigits.length >= 10 ? phoneDigits : `mira:${alvo.cnpj ?? alvo.id}`;
  const decisorPrincipal = alvo.decisores[0] ?? null;

  // Contact (upsert por whatsappId+org — pode já existir na carteira)
  let contactId = alvo.contactId as string | null;
  if (!contactId) {
    const existing = await (prisma as any).contact.findFirst({
      where: { organizationId, whatsappId },
      select: { id: true },
    });
    if (existing) {
      contactId = existing.id;
    } else {
      const contact = await (prisma as any).contact.create({
        data: {
          organizationId,
          whatsappId,
          phone: phoneDigits.length >= 10 ? phoneDigits : '',
          name: decisorPrincipal ? decisorPrincipal.nome : displayName,
          company: alvo.nome,
          tags: ['mira'],
          leadStatus: 'QUALIFIED',
          funnelStage: 'qualified',
          customFields: {
            cnpj: alvo.cnpj,
            origem: 'mira_prospects',
            miraAlvoId: alvo.id,
            miraScore: alvo.miraScore,
            papelDecisor: decisorPrincipal?.papel ?? null,
          },
        },
        select: { id: true },
      });
      contactId = contact.id;
    }
  }

  // Deal no pipeline
  let dealId = alvo.dealId as string | null;
  if (!dealId) {
    const deal = await (prisma as any).deal.create({
      data: {
        organizationId,
        contactId: contactId!,
        title: `Mira · ${displayName}`,
        stage: 'new',
      },
      select: { id: true },
    });
    dealId = deal.id;
  }

  await prisma.miraAlvo.update({
    where: { id: alvo.id },
    data: { contactId, dealId, status: 'DELIVERED' },
  });
  // Liga o decisor principal ao Contact criado (referência solta)
  if (decisorPrincipal && !decisorPrincipal.contactId) {
    await prisma.miraDecisor.update({
      where: { id: decisorPrincipal.id },
      data: { contactId },
    });
  }

  logger.info(`[Mira] alvo=${alvo.id} pousou no CRM (contact=${contactId} deal=${dealId}) org=${organizationId}`);
  return { contactId: contactId!, dealId: dealId!, reused: false };
}
