/**
 * Decide COMO uma campanha é enviada no WhatsApp: como texto livre (só válido
 * dentro da janela de 24h da Meta) ou como TEMPLATE aprovado (válido também fora
 * da janela, para reengajamento).
 *
 * Regra segura e sem regressão:
 *  - Envia como template quando há template vinculado, APROVADO pela Meta, e:
 *    (a) sem variáveis no corpo, OU (b) com um mapa de variáveis COMPLETO (cada
 *    {{N}} do corpo tem origem definida). No caso (b), os valores são resolvidos
 *    por contato no envio (buildTemplateComponents).
 *  - Qualquer outro caso (sem template, não aprovado, ou {{N}} sem mapa) cai em
 *    texto livre, exatamente como antes.
 */
import { resolveCampaignMessage } from './impulsoChannels.js';

export type TemplateVarSource = 'contact.firstName' | 'contact.name' | 'contact.company' | 'fixed';

export interface TemplateVariable {
  /** Número da variável no corpo ({{1}} = 1). */
  index: number;
  source: TemplateVarSource;
  /** Texto usado quando source = 'fixed'. */
  fixedText?: string;
  /** Valor de reserva quando o campo do contato está vazio (Meta rejeita variável vazia). */
  fallback?: string;
}

export interface ContactForTemplate {
  name?: string | null;
  company?: string | null;
}

export interface TemplateForSend {
  name?: string | null;
  language?: string | null;
  bodyText?: string | null;
  metaStatus?: string | null;
  variables?: unknown;
}

export interface CampaignForSend {
  message?: unknown;
  template?: TemplateForSend | null;
}

/** Reserva final: nunca deixa uma variável vazia (a Meta rejeita). */
const RESERVA_GENERICA = 'cliente';

/** Números das variáveis presentes no corpo ({{1}}, {{2}}...), distintos e ordenados. */
export function templateVariableNumbers(bodyText: string | null | undefined): number[] {
  const nums = new Set<number>();
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyText ?? ''))) nums.add(Number(m[1]));
  return [...nums].sort((a, b) => a - b);
}

/** true se o corpo tem placeholders da Meta ({{1}}, {{2}}, ...). */
export function hasTemplateVariables(bodyText: string | null | undefined): boolean {
  return templateVariableNumbers(bodyText).length > 0;
}

function normalizeVariables(variables: unknown): TemplateVariable[] {
  if (!Array.isArray(variables)) return [];
  return variables
    .filter((v): v is TemplateVariable => !!v && typeof (v as any).index === 'number' && typeof (v as any).source === 'string')
    .map((v) => ({ index: v.index, source: v.source, fixedText: v.fixedText, fallback: v.fallback }));
}

/** true se todo {{N}} do corpo tem uma entrada válida no mapa de variáveis. */
export function isVariableMapComplete(bodyText: string | null | undefined, variables: unknown): boolean {
  const nums = templateVariableNumbers(bodyText);
  if (nums.length === 0) return true;
  const map = new Map(normalizeVariables(variables).map((v) => [v.index, v]));
  return nums.every((n) => {
    const v = map.get(n);
    if (!v) return false;
    if (v.source === 'fixed') return !!(v.fixedText && v.fixedText.trim());
    return v.source === 'contact.firstName' || v.source === 'contact.name' || v.source === 'contact.company';
  });
}

function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] || '';
}

/** Resolve o valor de uma variável para um contato, sempre não-vazio. */
export function resolveVariableValue(v: TemplateVariable, contact: ContactForTemplate): string {
  let val = '';
  switch (v.source) {
    case 'contact.firstName':
      val = firstName(contact.name);
      break;
    case 'contact.name':
      val = (contact.name ?? '').trim();
      break;
    case 'contact.company':
      val = (contact.company ?? '').trim();
      break;
    case 'fixed':
      val = (v.fixedText ?? '').trim();
      break;
  }
  if (!val) val = (v.fallback ?? '').trim();
  if (!val) val = RESERVA_GENERICA;
  return val;
}

/**
 * Monta os `components` da Meta para o corpo do template, resolvendo cada
 * variável para o contato. Corpo sem variáveis → array vazio (template simples).
 */
export function buildTemplateComponents(
  bodyText: string | null | undefined,
  variables: unknown,
  contact: ContactForTemplate,
): any[] {
  const nums = templateVariableNumbers(bodyText);
  if (nums.length === 0) return [];
  const map = new Map(normalizeVariables(variables).map((v) => [v.index, v]));
  const parameters = nums.map((n) => {
    const v = map.get(n) ?? { index: n, source: 'fixed' as const, fixedText: '' };
    return { type: 'text', text: resolveVariableValue(v, contact) };
  });
  return [{ type: 'body', parameters }];
}

export type CampaignSendPlan =
  | { kind: 'text'; content: string }
  | {
      kind: 'template';
      templateName: string;
      languageCode: string;
      content: string;
      bodyText: string;
      variables: TemplateVariable[];
    };

/**
 * Plano de envio da campanha para um canal. Hoje só o WhatsApp tem template;
 * Instagram e web sempre texto. Para template com variáveis, o plano carrega o
 * corpo e o mapa; os valores são resolvidos por contato no envio.
 */
export function resolveCampaignSend(
  campaign: CampaignForSend,
  channel: 'whatsapp' | 'instagram' | 'web' = 'whatsapp',
): CampaignSendPlan {
  const content = resolveCampaignMessage(campaign as any, channel);
  const t = campaign.template;
  const approved = (t?.metaStatus ?? '').toUpperCase() === 'APPROVED';
  const semVariaveis = !hasTemplateVariables(t?.bodyText);
  const mapaCompleto = isVariableMapComplete(t?.bodyText, t?.variables);

  const podeTemplate =
    channel === 'whatsapp' && !!t && !!t.name && approved && (semVariaveis || mapaCompleto);

  if (podeTemplate && t) {
    return {
      kind: 'template',
      templateName: t.name as string,
      languageCode: t.language || 'pt_BR',
      content,
      bodyText: t.bodyText || '',
      variables: normalizeVariables(t.variables),
    };
  }
  return { kind: 'text', content };
}
