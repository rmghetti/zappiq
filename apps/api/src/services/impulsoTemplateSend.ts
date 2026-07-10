/**
 * Decide COMO uma campanha é enviada no WhatsApp: como texto livre (só válido
 * dentro da janela de 24h da Meta) ou como TEMPLATE aprovado (válido também fora
 * da janela, para reengajamento).
 *
 * Regra segura e sem regressão:
 *  - Envia como template SÓ quando há um template vinculado, APROVADO pela Meta
 *    (metaStatus 'APPROVED') e SEM variáveis ({{1}}, {{2}}...) no corpo, porque
 *    ainda não existe mecanismo que preencha essas variáveis por contato. Nesse
 *    caso o corpo é fixo e o envio como template é seguro.
 *  - Qualquer outro caso (sem template, template não aprovado, ou template com
 *    variáveis a preencher) cai em texto livre, exatamente como era antes.
 *
 * Templates COM variáveis dependem de uma feature de preenchimento por contato
 * (ex: {{1}} = nome do contato) que é decisão de produto; até lá, ficam em texto.
 */
import { resolveCampaignMessage } from './impulsoChannels.js';

export interface CampaignForSend {
  message?: unknown;
  template?: {
    name?: string | null;
    language?: string | null;
    bodyText?: string | null;
    metaStatus?: string | null;
  } | null;
}

/** true se o corpo tem placeholders da Meta ({{1}}, {{2}}, ...) ainda não preenchidos. */
export function hasTemplateVariables(bodyText: string | null | undefined): boolean {
  return /\{\{\s*\d+\s*\}\}/.test(bodyText ?? '');
}

export type CampaignSendPlan =
  | { kind: 'text'; content: string }
  | { kind: 'template'; templateName: string; languageCode: string; content: string };

/**
 * Plano de envio da campanha para um canal. Hoje só o WhatsApp tem template;
 * Instagram e web sempre texto.
 */
export function resolveCampaignSend(
  campaign: CampaignForSend,
  channel: 'whatsapp' | 'instagram' | 'web' = 'whatsapp',
): CampaignSendPlan {
  const content = resolveCampaignMessage(campaign as any, channel);
  const t = campaign.template;

  const podeTemplate =
    channel === 'whatsapp' &&
    !!t &&
    !!t.name &&
    (t.metaStatus ?? '').toUpperCase() === 'APPROVED' &&
    !hasTemplateVariables(t.bodyText);

  if (podeTemplate && t) {
    return {
      kind: 'template',
      templateName: t.name as string,
      languageCode: t.language || 'pt_BR',
      content,
    };
  }
  return { kind: 'text', content };
}
