import { llmRouter } from './llm/LLMRouter.js';
import { logger } from '../utils/logger.js';

/*
 * ═════════════════════════════════════════════════════════════════
 * Impulso — Iza Estrategista (pilar 1, autônomo).
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

const SYSTEM = `Voce e a Iza, gerente de campanhas de vendas da ZappIQ (plataforma conversacional brasileira, WhatsApp-centrica).
A partir de um objetivo em linguagem natural do dono do negocio, monte uma CAMPANHA completa e pronta para aprovar.

Regras de copy (voz humana MACHIA): pt-BR natural, direto, SEM travessao (—), sem soar robotico, foco em vender com respeito ao cliente e em respeitar o opt-in.

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

export async function draftCampaignFromObjective(input: ImpulsoDraftInput): Promise<ImpulsoDraft> {
  const userContent = [
    `Objetivo: ${input.objective}`,
    input.brandVoice ? `Tom de marca: ${input.brandVoice}` : '',
    input.context ? `Contexto: ${input.context}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const resp = await llmRouter.complete({
    system: SYSTEM,
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
