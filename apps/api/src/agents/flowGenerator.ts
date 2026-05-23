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
import { llmRouter, type LLMTier, type LLMProviderId } from '../services/llm/LLMRouter.js';
import {
  pickBlueprint,
  buildGraphFromContent,
  BLUEPRINTS,
  type Blueprint,
  type BlueprintGoal,
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

/** Remove caracteres de controle (ASCII < 0x20, exceto \n \r \t) de uma string. */
function stripControlChars(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code >= 32 || code === 9 || code === 10 || code === 13) out += s[i];
  }
  return out;
}

/**
 * Extrai o primeiro objeto JSON de um texto. Tolera os erros mais comuns de
 * LLM: cercas de código, prosa antes/depois, vírgulas sobrando antes de }/] e
 * caracteres de controle inválidos (Gemini Flash erra muito nesses pontos).
 */
function extractJson(text: string): any | null {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  let slice = cleaned.slice(start, end + 1);
  // remove vírgulas sobrando antes de } ou ] (erro clássico de LLM)
  slice = slice.replace(/,(\s*[}\]])/g, '$1');
  // remove caracteres de controle inválidos que quebram JSON.parse
  slice = stripControlChars(slice);
  try {
    return JSON.parse(slice);
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
    'Responda EXCLUSIVAMENTE com um objeto JSON válido, sem texto antes ou depois, sem cercas de código, sem vírgula sobrando.',
  ].join(' ');

  const user = [
    `Negócio: ${businessName}.`,
    niche ? `Segmento: ${niche}.` : '',
    `Tom de voz desejado: ${tone}.`,
    businessHours ? `Horário de funcionamento: ${businessHours}.` : '',
    `Nome do assistente: ${agentName}.`,
    `Objetivo do fluxo: ${blueprint.label} — ${blueprint.description}`,
    goal && goal.trim() ? `O cliente descreveu o objetivo com estas palavras: "${goal.trim()}". Adapte os textos a esse pedido específico.` : '',
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
      // Geração de fluxo roda 1x por fluxo — priorizamos JSON confiável.
      // Sonnet devolve JSON limpo quase sempre (Gemini Flash erra muito).
      // forceProvider tem prioridade sobre tier; tier fica como referência.
      tier,
      forceProvider: 'anthropic-sonnet' as LLMProviderId,
      orgId: organizationId,
      operation: 'chat',
    });
    parsed = extractJson(resp.text);
    if (!parsed) {
      logger.warn('[Maestro] generateFlowDraft: JSON não parseável', {
        organizationId, sample: (resp.text || '').slice(0, 200),
      });
    }
  } catch (e) {
    logger.warn('[Maestro] generateFlowDraft: LLM falhou — usando fallback', {
      organizationId, err: String(e),
    });
    return fallbackDraft('Usei um modelo padrão porque a personalização automática não respondeu agora — pode editar à vontade.');
  }

  if (!parsed || typeof parsed !== 'object') {
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

// ============================================================================
// MAESTRO INTELIGENTE (Onda 1) — geração multi-objetivo com TODO o ai-training
// ============================================================================
// Diferença pro generateFlowDraft acima: aqui o Maestro lê TODO o conhecimento
// que o cliente preencheu (survey completo, identidade, segmento/subsegmento,
// títulos de documentos, pares de Q&A) e usa isso pra entender o negócio e
// personalizar de verdade. Aceita N objetivos e devolve 1 draft por objetivo.

export interface BusinessContext {
  businessName: string;
  niche: string | null;
  tone: string;
  businessHours: string;
  agentName: string;
  segmento: string | null;
  subsegmentos: string[];
  /** Texto compacto com tudo que o cliente preencheu — vai pro prompt do LLM. */
  brief: string;
  plan?: string | null;
}

/** Achata recursivamente um objeto de respostas em linhas "valor" legíveis. */
function flattenAnswers(obj: any, out: string[], depth = 0): void {
  if (obj == null || depth > 4) return;
  if (typeof obj === 'string') {
    const v = obj.trim();
    if (v) out.push(v);
  } else if (Array.isArray(obj)) {
    for (const x of obj) flattenAnswers(x, out, depth + 1);
  } else if (typeof obj === 'object') {
    for (const v of Object.values(obj)) flattenAnswers(v, out, depth + 1);
  }
}

/** Carrega o contexto completo do negócio a partir do ai-training. */
export async function loadBusinessContext(organizationId: string): Promise<BusinessContext> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, settings: true },
  });
  const settings = (org?.settings as Record<string, any>) || {};
  const niche: string | null = settings.niche ?? null;
  const businessName: string = settings.businessName || 'sua empresa';
  const tone: string = settings.tone || 'profissional e simpático';
  const businessHours: string =
    typeof settings.businessHours === 'string'
      ? settings.businessHours
      : settings.businessHours ? JSON.stringify(settings.businessHours) : '';
  const agentName: string = settings.agentName || 'seu assistente';
  const segmento: string | null = settings.segmento ?? niche ?? null;
  const subsegmentos: string[] = Array.isArray(settings.subsegmentos) ? settings.subsegmentos : [];

  // Survey (achatado, dedupe, cap) — o coração do "entender o negócio".
  const answerLines: string[] = [];
  flattenAnswers(settings.surveyAnswers || {}, answerLines);
  const surveyBrief = Array.from(new Set(answerLines))
    .map((s) => s.replace(/\s+/g, ' ').slice(0, 240))
    .slice(0, 24);

  // Documentos/URLs ingeridos (só títulos — o conteúdo já está no RAG runtime).
  let docTitles: string[] = [];
  try {
    const docs = await prisma.kBDocument.findMany({
      where: { knowledgeBase: { organizationId } },
      select: { title: true },
      take: 12,
      orderBy: { createdAt: 'desc' },
    });
    docTitles = docs.map((d) => d.title).filter(Boolean);
  } catch { /* fail-soft */ }

  // Q&A ativos (pergunta + resposta curta).
  let qaLines: string[] = [];
  try {
    const qas = await (prisma as any).QAPair.findMany({
      where: { organizationId, isActive: true },
      select: { question: true, answer: true },
      take: 10,
      orderBy: { priority: 'desc' },
    });
    qaLines = (qas as any[]).map((q) => `P: ${String(q.question).slice(0, 120)} | R: ${String(q.answer).slice(0, 160)}`);
  } catch { /* fail-soft */ }

  const briefParts: string[] = [
    `Negócio: ${businessName}.`,
    segmento ? `Segmento: ${segmento}.` : '',
    subsegmentos.length ? `Subsegmentos: ${subsegmentos.join(', ')}.` : '',
    `Tom de voz: ${tone}.`,
    businessHours ? `Horário: ${businessHours}.` : '',
    `Nome do assistente: ${agentName}.`,
    surveyBrief.length ? `\nO que o cliente contou sobre o negócio:\n- ${surveyBrief.join('\n- ')}` : '',
    docTitles.length ? `\nDocumentos/materiais enviados: ${docTitles.join('; ')}.` : '',
    qaLines.length ? `\nPerguntas & respostas já cadastradas:\n- ${qaLines.join('\n- ')}` : '',
  ].filter(Boolean);

  return {
    businessName, niche, tone, businessHours, agentName, segmento, subsegmentos,
    plan: org?.plan ?? null,
    brief: briefParts.join('\n').slice(0, 4000),
  };
}

/** Objetivos recomendados a partir do niche/segmento (pré-marca o wizard). */
export function recommendObjectives(niche: string | null, segmento: string | null): BlueprintGoal[] {
  const key = (segmento || niche || '').toLowerCase().trim();
  const bp = pickBlueprint({ niche: key });
  const recommended: BlueprintGoal[] = [bp.goal];
  // Atendimento é base universal — sempre oferece junto se não for o principal.
  if (!recommended.includes('atendimento')) recommended.push('atendimento');
  return recommended;
}

/** Gera UM draft pra um objetivo específico, usando o brief completo do negócio. */
async function generateDraftForObjective(
  ctx: BusinessContext,
  blueprint: Blueprint,
  organizationId: string,
  multiAgent: boolean,
): Promise<FlowDraft> {
  const fallback = (): FlowDraft => {
    const graph = buildGraphFromContent(blueprint.defaults);
    return {
      name: blueprint.defaults.flowName,
      nodes: graph.nodes,
      edges: graph.edges,
      triggerType: 'FIRST_CONTACT',
      triggerConfig: {},
      rationale: [
        { node: 'Início', why: 'Dispara quando o cliente inicia a conversa.' },
        { node: 'Mensagem', why: 'Boas-vindas determinísticas, sempre iguais.' },
        { node: 'Marcar tag', why: `Organiza o contato pelo objetivo: ${blueprint.label}.` },
        { node: 'Nó-IA', why: 'A IA assume usando o conhecimento do seu negócio.' },
      ],
      summary: `Modelo de "${blueprint.label}" para ${ctx.businessName} (base padrão — pode editar).`,
      blueprintId: blueprint.id,
      blueprintLabel: blueprint.label,
      source: 'fallback',
    };
  };

  const system = [
    'Você é o MAESTRO INTELIGENTE da ZappIQ: monta fluxos de atendimento no WhatsApp/Instagram personalizados ao negócio.',
    'Use TODO o contexto do negócio abaixo para escrever textos específicos e úteis (cite serviços, jeito de falar, diferenciais reais — nada genérico).',
    'A ESTRUTURA do fluxo é fixa (Início → Mensagem → Marcar tag → Nó-IA): NÃO mude a estrutura, só o conteúdo.',
    'Responda EXCLUSIVAMENTE com um objeto JSON válido, sem texto antes/depois, sem cercas, sem vírgula sobrando.',
  ].join(' ');

  const user = [
    '=== CONTEXTO DO NEGÓCIO (preenchido pelo cliente no treinamento da IA) ===',
    ctx.brief,
    '',
    `=== OBJETIVO DESTE FLUXO: ${blueprint.label} — ${blueprint.description} ===`,
    multiAgent
      ? 'Este é UM de vários fluxos especialistas (um por objetivo). Deixe a mensagem e a tag bem focadas SÓ neste objetivo.'
      : 'Este é o fluxo principal do negócio.',
    '',
    'Devolva este JSON (pt-BR, textos curtos e naturais, usando o que você entendeu do negócio):',
    '{',
    '  "flowName": "nome curto do fluxo",',
    '  "welcomeText": "boas-vindas (1-2 frases, pode 1 emoji), personalizada ao negócio",',
    '  "tag": "tag-em-kebab-case",',
    '  "aiPrompt": "instrução pro nó-IA: o que fazer neste objetivo, citando serviços/contexto reais (2-4 frases)",',
    '  "rationale": [',
    '    {"node":"Início","why":"..."},{"node":"Mensagem","why":"..."},{"node":"Marcar tag","why":"..."},{"node":"Nó-IA","why":"..."}',
    '  ],',
    '  "summary": "1-2 frases pro dono do negócio explicando o que montou e por que faz sentido pra ELE"',
    '}',
  ].join('\n');

  const tier = VALID_TIERS.includes(ctx.plan as LLMTier) ? (ctx.plan as LLMTier) : undefined;

  let parsed: any = null;
  try {
    const resp = await llmRouter.complete({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 1000,
      temperature: 0.5,
      tier,
      forceProvider: 'anthropic-sonnet' as LLMProviderId,
      orgId: organizationId,
      operation: 'chat',
    });
    parsed = extractJson(resp.text);
  } catch (e) {
    logger.warn('[MaestroInteligente] LLM falhou — fallback', { organizationId, objetivo: blueprint.goal, err: String(e) });
    return fallback();
  }
  if (!parsed || typeof parsed !== 'object') return fallback();

  const content: BlueprintContent = {
    flowName: String(parsed.flowName || blueprint.defaults.flowName).slice(0, 80),
    welcomeText: String(parsed.welcomeText || blueprint.defaults.welcomeText).slice(0, 600),
    tag: (String(parsed.tag || blueprint.defaults.tag).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)) || blueprint.defaults.tag,
    aiPrompt: String(parsed.aiPrompt || blueprint.defaults.aiPrompt).slice(0, 900),
  };
  const rationale = Array.isArray(parsed.rationale)
    ? parsed.rationale.filter((r: any) => r && r.node && r.why).map((r: any) => ({ node: String(r.node).slice(0, 40), why: String(r.why).slice(0, 300) }))
    : [];
  const graph = buildGraphFromContent(content);

  return {
    name: content.flowName,
    nodes: graph.nodes,
    edges: graph.edges,
    triggerType: 'FIRST_CONTACT',
    triggerConfig: {},
    rationale: rationale.length > 0 ? rationale : fallback().rationale,
    summary: String(parsed.summary || `Fluxo de "${blueprint.label}" personalizado para ${ctx.businessName}.`).slice(0, 500),
    blueprintId: blueprint.id,
    blueprintLabel: blueprint.label,
    source: 'ai',
  };
}

export interface SmartFlowsResult {
  drafts: FlowDraft[];
  objectives: BlueprintGoal[];
  multiAgent: boolean;
  /** Recomendação/explicação do Maestro pro cliente (ex.: multi-agente). */
  note: string;
}

/**
 * MAESTRO INTELIGENTE — gera 1+ fluxos a partir dos objetivos escolhidos e de
 * TODO o conhecimento do ai-training. Se nenhum objetivo for passado, recomenda
 * pelo segmento. multiAgent=true => 1 fluxo especialista por objetivo.
 */
export async function generateSmartFlows(input: {
  organizationId: string;
  objectives?: string[];
  multiAgent?: boolean;
}): Promise<SmartFlowsResult> {
  const { organizationId } = input;
  const ctx = await loadBusinessContext(organizationId);

  // Normaliza objetivos pros goals válidos; se vazio, recomenda pelo segmento.
  const requested = (input.objectives || [])
    .map((o) => String(o).toLowerCase().trim())
    .filter((o): o is BlueprintGoal => o in BLUEPRINTS);
  let objectives: BlueprintGoal[] = Array.from(new Set(requested));
  if (objectives.length === 0) objectives = recommendObjectives(ctx.niche, ctx.segmento);

  const multiAgent = !!input.multiAgent && objectives.length > 1;

  // multiAgent=false + vários objetivos: gera só o primeiro (fluxo único focado
  // no objetivo principal). multiAgent=true: 1 draft por objetivo.
  const toGenerate = multiAgent ? objectives : [objectives[0]];

  const drafts: FlowDraft[] = [];
  for (const goal of toGenerate) {
    drafts.push(await generateDraftForObjective(ctx, BLUEPRINTS[goal], organizationId, multiAgent));
  }

  const note = multiAgent
    ? `Montei ${drafts.length} fluxos especialistas (um por objetivo) usando o que você preencheu no treinamento. Hoje você publica um por vez; revise e edite cada um.`
    : `Montei o fluxo de "${BLUEPRINTS[objectives[0]].label}" usando o que você preencheu no treinamento. Quer um especialista por objetivo? Posso montar vários.`;

  return { drafts, objectives, multiAgent, note };
}
