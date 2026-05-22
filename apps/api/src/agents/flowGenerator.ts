/**
 * ZappIQ Maestro — Gerador "monta pra você" (#288)
 * ============================================================================
 * Híbrido: estrutura determinística (flowBlueprints) + IA preenche o conteúdo.
 * Fluxo:
 *   1. Carrega contexto do negócio (settings: niche, businessName, tone,
 *      businessHours, agentName).
 *   2. Escolhe o blueprint por objetivo explícito ou pelo niche.
 *   3. Pede pra IA (cascade existente) preencher SÓ o conteúdo textual de cada
 *      nó + escrever o racional ("por que montei assim"). Estrutura é fixa.
 *   4. Valida/parseia o JSON; se a IA falhar, usa o conteúdo-padrão do blueprint
 *      (fallback determinístico) — nunca quebra.
 *   5. Devolve um DRAFT (não persiste). O cliente revisa/edita e Salva via CRUD.
 *
 * O nó-IA do fluxo gerado usa, em runtime, o MESMO conhecimento do agente
 * (buildSystemPromptForContact: CORE rules + iza_facts + RAG) — então aqui só
 * personalizamos a INTENÇÃO/voz, não duplicamos base de conhecimento.
 * ============================================================================
 */
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { llmRouter, type LLMTier } from '../services/llm/LLMRouter.js';
import {
  pickBlueprint,
  buildGraphFromContent,
  type BlueprintContent,
} from './flowBlueprints.js';

export interface FlowDraft {
  name: string;
  nodes: any[];
  edges: any[];
  triggerType: 'KEYWORD' | 'FIRST_CONTACT' | 'SCHEDULE' | 'MANUAL' | 'EVENT';
  triggerConfig: Record<string, any>;
  /** Explicação em linguagem natural, nó a nó. */
  rationale: { node: string; why: string }[];
  /** Resumo do que o Maestro montou e por quê. */
  summary: string;
  blueprintId: string;
  blueprintLabel: string;
  /** 'ai' = personalizado pela IA; 'fallback' = conteúdo-padrão do blueprint. */
  source: 'ai' | 'fallback';
}

const VALID_TIERS: LLMTier[] = ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'];

/** Extrai o primeiro objeto JSON de um texto (tolera cercas ```json e ruído). */
function extractJson(text: string): any | null {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function generateFlowDraft(input: {
  organizationId: string;
  goal?: string;
}): Promise<FlowDraft> {
  const { organizationId, goal } = input;

  // 1. Contexto do negócio
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, settings: true },
  });
  const settings = (org?.settings as Record<string, any>) || {};
  const niche: string | null = settings.niche ?? null;
  const businessName: string = settings.businessName || 'sua empresa';
  const tone: string = settings.tone || 'profissional e simpático';
  const businessHours: string = settings.businessHours || '';
  const agentName: string = settings.agentName || 'seu assistente';

  // 2. Blueprint
  const blueprint = pickBlueprint({ goal, niche });

  // Fallback determinístico pronto (caso a IA falhe)
  const fallbackDraft = (reason: string): FlowDraft => {
    const graph = buildGraphFromContent(blueprint.defaults);
    return {
      name: blueprint.defaults.flowName,
      nodes: graph.nodes,
      edges: graph.edges,
      triggerType: 'FIRST_CONTACT',
      triggerConfig: {},
      rationale: [
        { node: 'Início', why: 'Ponto de entrada: dispara quando o cliente inicia a conversa.' },
        { node: 'Mensagem', why: 'Recepção determinística (trilho fixo) — boas-vindas garantidas, sempre iguais.' },
        { node: 'Marcar tag', why: `Marca o contato para você organizar e segmentar (objetivo: ${blueprint.label}).` },
        { node: 'Nó-IA', why: 'A partir daqui a IA assume usando o conhecimento do seu negócio para conversar de verdade.' },
      ],
      summary: `Montei um fluxo de "${blueprint.label}" para ${businessName}. ${reason}`,
      blueprintId: blueprint.id,
      blueprintLabel: blueprint.label,
      source: 'fallback',
    };
  };

  // 3. Pede pra IA preencher o conteúdo
  const system = [
    'Você é o ZappIQ Maestro, um assistente que monta fluxos de atendimento no WhatsApp para empresas.',
    'Sua tarefa: preencher o CONTEÚDO de um fluxo cuja ESTRUTURA já está definida (Início → Mensagem → Marcar tag → Nó-IA).',
    'NÃO mude a estrutura. Apenas escreva os textos, personalizados ao negócio, e explique o racional.',
    'Responda EXCLUSIVAMENTE com um objeto JSON válido, sem texto antes ou depois, sem cercas de código.',
  ].join(' ');

  const user = [
    `Negócio: ${businessName}.`,
    niche ? `Segmento: ${niche}.` : '',
    `Tom de voz desejado: ${tone}.`,
    businessHours ? `Horário de funcionamento: ${businessHours}.` : '',
    `Nome do assistente: ${agentName}.`,
    `Objetivo do fluxo: ${blueprint.label} — ${blueprint.description}`,
    '',
    'Preencha e devolva este JSON (em pt-BR, textos curtos e naturais para WhatsApp):',
    '{',
    '  "flowName": "nome curto do fluxo",',
    '  "welcomeText": "mensagem de boas-vindas (trilho fixo, 1-2 frases, pode usar 1 emoji)",',
    '  "tag": "tag-em-kebab-case-curta",',
    '  "aiPrompt": "instrução para o nó-IA: o que a IA deve fazer ao assumir a conversa (2-3 frases)",',
    '  "rationale": [',
    '    {"node": "Início", "why": "..."},',
    '    {"node": "Mensagem", "why": "..."},',
    '    {"node": "Marcar tag", "why": "..."},',
    '    {"node": "Nó-IA", "why": "..."}',
    '  ],',
    '  "summary": "1-2 frases explicando o que você montou e por quê, falando direto com o dono do negócio"',
    '}',
  ].filter(Boolean).join('\n');

  const tier = VALID_TIERS.includes(org?.plan as LLMTier) ? (org?.plan as LLMTier) : undefined;

  let parsed: any = null;
  try {
    const resp = await llmRouter.complete({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 900,
      temperature: 0.5,
      tier,
      orgId: organizationId,
      operation: 'chat',
    });
    parsed = extractJson(resp.text);
  } catch (e) {
    logger.warn('[Maestro] generateFlowDraft: LLM falhou — usando fallback', {
      organizationId, err: String(e),
    });
    return fallbackDraft('Usei um modelo padrão porque a personalização automática não respondeu agora — pode editar à vontade.');
  }

  if (!parsed || typeof parsed !== 'object') {
    logger.warn('[Maestro] generateFlowDraft: JSON inválido — usando fallback', { organizationId });
    return fallbackDraft('Usei um modelo padrão como base — pode editar à vontade.');
  }

  // 4. Mescla conteúdo da IA sobre os defaults (preenche o que faltar)
  const content: BlueprintContent = {
    flowName: String(parsed.flowName || blueprint.defaults.flowName).slice(0, 80),
    welcomeText: String(parsed.welcomeText || blueprint.defaults.welcomeText).slice(0, 600),
    tag: String(parsed.tag || blueprint.defaults.tag)
      .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
      || blueprint.defaults.tag,
    aiPrompt: String(parsed.aiPrompt || blueprint.defaults.aiPrompt).slice(0, 800),
  };

  const rationale = Array.isArray(parsed.rationale)
    ? parsed.rationale
        .filter((r: any) => r && r.node && r.why)
        .map((r: any) => ({ node: String(r.node).slice(0, 40), why: String(r.why).slice(0, 300) }))
    : [];

  const graph = buildGraphFromContent(content);

  return {
    name: content.flowName,
    nodes: graph.nodes,
    edges: graph.edges,
    triggerType: 'FIRST_CONTACT',
    triggerConfig: {},
    rationale: rationale.length > 0 ? rationale : fallbackDraft('').rationale,
    summary: String(parsed.summary || `Montei um fluxo de "${blueprint.label}" personalizado para ${businessName}.`).slice(0, 500),
    blueprintId: blueprint.id,
    blueprintLabel: blueprint.label,
    source: 'ai',
  };
}
