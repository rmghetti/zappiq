import { llmRouter } from './llm/LLMRouter.js';
import { logger } from '../utils/logger.js';
import { resolveTenantAgentProfile, type TenantAgentProfile } from '../agents/tenantAgentProfile.js';

/*
 * ═════════════════════════════════════════════════════════════════
 * Impulso · Estrategista de campanhas (pilar 1, autônomo).
 * A persona é sempre a do TENANT (ver buildSystem). Só na org da ZappIQ
 * ela é a Iza.
 * Objetivo em linguagem natural do dono do negócio -> campanha
 * completa pronta pra aprovar (segmento, canais, copy na voz de
 * marca, horário, plano de verba e estimativa de custo/resultado).
 * Reusa o LLMRouter (cascade Sonnet->Haiku->GPT-4o-mini, audit por org).
 * ═════════════════════════════════════════════════════════════════
 */

export interface ImpulsoDraftInput {
  orgId: string;
  objective: string; // objetivo em linguagem natural
  brandVoice?: string; // tom de marca opcional
  context?: string; // contexto extra (produto, oferta, público)
}

export interface ImpulsoDraft {
  name: string;
  segmentDescription: string;
  channels: string[]; // ['whatsapp','email','sms','instagram']
  copy: {
    whatsapp?: string;
    email?: { subject: string; body: string };
    sms?: string;
  };
  suggestedSchedule: string;
  budgetPlan: {
    recommendedContacts?: number;
    recommendedAdSpendBrl?: number;
    note?: string;
  };
  estimate: {
    reachContacts?: number;
    expectedReplies?: number;
    expectedSales?: number;
    estimatedCostBrl?: number;
  };
  autonomyLevelSuggested: number; // 0..4
  rationale: string; // o que e o quanto operar (Coach)
}

/*
 * Persona do estrategista: é do TENANT, nunca da ZappIQ (14/07/2026).
 *
 * Isto roda com o orgId do CLIENTE (routes/impulso.ts) e a copy que sai daqui
 * é disparada na base DELE. Com a persona fixa "Iza da ZappIQ", a campanha do
 * CMJ saía escrita por uma gerente de vendas de outra empresa: no melhor caso
 * tom errado, no pior a copy citando a ZappIQ pro cliente final do CMJ.
 *
 * A org da ZappIQ é a única que mantém a Iza, porque lá ela é a identidade
 * legítima (é a ZappIQ fazendo campanha da ZappIQ).
 */
function buildSystem(profile: TenantAgentProfile): string {
  // niche cai em 'generic' quando o cliente não cadastrou: não vira texto.
  const nicho = profile.niche && profile.niche !== 'generic' ? ` no ramo de ${profile.niche}` : '';

  const persona = profile.isZappIQ
    ? 'Voce e a Iza, gerente de campanhas de vendas da ZappIQ (plataforma conversacional brasileira, WhatsApp-centrica).'
    : `Voce e ${profile.agentName}, estrategista de campanhas de vendas de ${profile.businessName}${nicho}. ` +
      `A campanha e de ${profile.businessName} e fala com a base de clientes de ${profile.businessName}: ` +
      `escreva na voz desse negocio e nao cite nenhuma outra marca, plataforma ou fornecedor.`;

  return `${persona}
A partir de um objetivo em linguagem natural do dono do negocio, monte uma CAMPANHA completa e pronta para aprovar.

Regras de copy (voz humana): pt-BR natural, direto, SEM travessao (—), sem soar robotico, foco em vender com respeito ao cliente e em respeitar o opt-in.

Responda SOMENTE com um JSON valido (sem markdown, sem cercas de codigo) neste formato exato:
{
  "name": "nome curto da campanha",
  "segmentDescription": "quem deve receber, em 1 frase",
  "channels": ["whatsapp","email","sms"],
  "copy": { "whatsapp": "mensagem pronta", "email": {"subject":"...","body":"..."}, "sms": "..." },
  "suggestedSchedule": "melhor horario/dia com justificativa curta",
  "budgetPlan": { "recommendedContacts": 4000, "recommendedAdSpendBrl": 2000, "note": "orientacao do que e do quanto operar" },
  "estimate": { "reachContacts": 4000, "expectedReplies": 600, "expectedSales": 45, "estimatedCostBrl": 1500 },
  "autonomyLevelSuggested": 2,
  "rationale": "por que essas escolhas, em linguagem simples para o dono do negocio"
}

Inclua sempre pelo menos o canal "whatsapp". As estimativas devem ser plausiveis, nao invente precisao falsa. O custo de disparo de marketing no WhatsApp e ~R$ 0,34/mensagem.`;
}

export async function draftCampaignFromObjective(input: ImpulsoDraftInput): Promise<ImpulsoDraft> {
  // Fail-soft: se o lookup cair, volta perfil neutro de CLIENTE (nunca ZappIQ).
  const profile = await resolveTenantAgentProfile(input.orgId);

  const userContent = [
    `Objetivo: ${input.objective}`,
    input.brandVoice ? `Tom de marca: ${input.brandVoice}` : '',
    input.context ? `Contexto: ${input.context}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const resp = await llmRouter.complete({
    system: buildSystem(profile),
    messages: [{ role: 'user', content: userContent }],
    orgId: input.orgId,
    operation: 'chat',
    maxTokens: 1200,
    temperature: 0.7,
  });

  const draft = safeParseDraft(resp.text);
  if (!draft) {
    logger.warn(
      `[impulsoStrategist] parse de JSON falhou (org=${input.orgId}); usando fallback. raw="${resp.text.slice(0, 160)}"`,
    );
    return fallbackDraft(input.objective);
  }
  return draft;
}

/** Extrai e valida o JSON do texto do modelo, tolerando cercas de código. */
function safeParseDraft(text: string): ImpulsoDraft | null {
  try {
    const cleaned = text
      .trim()
      .replace(/^```(json)?/i, '')
      .replace(/```$/, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (!obj || typeof obj !== 'object' || !obj.name || !Array.isArray(obj.channels)) return null;
    if (!obj.channels.includes('whatsapp')) obj.channels.unshift('whatsapp');
    // normaliza campos ausentes pra manter o contrato do tipo
    obj.copy = obj.copy ?? {};
    obj.budgetPlan = obj.budgetPlan ?? {};
    obj.estimate = obj.estimate ?? {};
    obj.autonomyLevelSuggested = typeof obj.autonomyLevelSuggested === 'number' ? obj.autonomyLevelSuggested : 2;
    obj.rationale = obj.rationale ?? '';
    obj.segmentDescription = obj.segmentDescription ?? '';
    obj.suggestedSchedule = obj.suggestedSchedule ?? '';
    return obj as ImpulsoDraft;
  } catch {
    return null;
  }
}

/** Rascunho de segurança quando a IA não retorna JSON utilizável. */
function fallbackDraft(objective: string): ImpulsoDraft {
  return {
    name: 'Campanha (rascunho)',
    segmentDescription: 'Base de contatos com opt-in de marketing',
    channels: ['whatsapp'],
    copy: { whatsapp: 'Oi! Temos uma novidade que combina com voce. Posso te contar?' },
    suggestedSchedule: 'dia util, entre 10h e 11h',
    budgetPlan: { note: `Nao consegui detalhar automaticamente para: "${objective}". Ajuste no Studio.` },
    estimate: {},
    autonomyLevelSuggested: 2,
    rationale: 'Rascunho de seguranca gerado sem detalhamento da IA. Revise e edite no Studio.',
  };
}
