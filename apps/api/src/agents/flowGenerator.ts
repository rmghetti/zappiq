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
  recommendJourney,
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

// ============================================================================
// MAESTRO INTELIGENTE (Onda 3) — atualização inteligente quando o treino muda
// ============================================================================
// Quando o cliente altera o ai-training, o fluxo publicado pode ficar
// desatualizado (ex.: novo horário, novo serviço). Aqui o Maestro REGENERA só o
// CONTEÚDO textual dos nós (mensagem, tag, prompt do nó-IA) com base no treino
// atual, PRESERVANDO a estrutura que o cliente montou (posições, nós extras,
// edges). Devolve um preview; o cliente aplica com 1 clique (autorização).

export interface FlowRefreshResult {
  name: string;
  nodes: any[];
  edges: any[];
  /** O que mudou / por que, em linguagem natural pro cliente. */
  changeNote: string;
  /** Texto novo sugerido pra mensagem de boas-vindas (preview). */
  newWelcome?: string;
  oldWelcome?: string;
  source: 'ai' | 'fallback';
}

export async function regenerateFlowContent(input: {
  organizationId: string;
  flow: { name: string; nodes: any[]; edges: any[] };
}): Promise<FlowRefreshResult> {
  const { organizationId, flow } = input;
  const ctx = await loadBusinessContext(organizationId);
  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];

  const msgIdx = nodes.findIndex((n) => n?.type === 'message');
  const tagIdx = nodes.findIndex((n) => n?.type === 'tag');
  const aiIdx = nodes.findIndex((n) => n?.type === 'ai');

  const curWelcome = (msgIdx >= 0 && nodes[msgIdx]?.data?.text) || '';
  const curTag = (tagIdx >= 0 && nodes[tagIdx]?.data?.tag) || '';
  const curAi = (aiIdx >= 0 && nodes[aiIdx]?.data?.prompt) || '';

  const unchanged = (): FlowRefreshResult => ({
    name: flow.name, nodes: flow.nodes, edges: flow.edges,
    changeNote: 'Não consegui gerar a atualização agora — seu fluxo segue como está. Tente de novo.',
    source: 'fallback',
  });

  const system = [
    'Você é o MAESTRO INTELIGENTE da ZappIQ. O cliente atualizou o treinamento da IA e este fluxo pode estar desatualizado.',
    'Sua tarefa: REESCREVER apenas o CONTEÚDO textual (mensagem de boas-vindas, tag, instrução do nó-IA) pra refletir o treinamento ATUAL, mantendo o mesmo objetivo/estrutura do fluxo.',
    'Use o contexto do negócio (serviços, horários, jeito de falar reais). Responda EXCLUSIVAMENTE com JSON válido, sem cercas.',
  ].join(' ');

  const user = [
    '=== CONTEXTO ATUAL DO NEGÓCIO (treinamento da IA) ===',
    ctx.brief,
    '',
    '=== CONTEÚDO ATUAL DO FLUXO (pode estar desatualizado) ===',
    `Mensagem de boas-vindas: ${curWelcome || '(vazia)'}`,
    `Tag: ${curTag || '(vazia)'}`,
    `Instrução do nó-IA: ${curAi || '(vazia)'}`,
    '',
    'Reescreva refletindo o treinamento atual. Devolva este JSON:',
    '{',
    '  "welcomeText": "boas-vindas atualizada (1-2 frases, pode 1 emoji)",',
    '  "tag": "tag-em-kebab-case",',
    '  "aiPrompt": "instrução do nó-IA atualizada (2-4 frases, citando serviços/horários reais)",',
    '  "changeNote": "1-2 frases pro dono do negócio explicando o que mudou e por quê"',
    '}',
  ].join('\n');

  const tier = VALID_TIERS.includes(ctx.plan as LLMTier) ? (ctx.plan as LLMTier) : undefined;

  let parsed: any = null;
  try {
    const resp = await llmRouter.complete({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 900,
      temperature: 0.4,
      tier,
      forceProvider: 'anthropic-sonnet' as LLMProviderId,
      orgId: organizationId,
      operation: 'chat',
    });
    parsed = extractJson(resp.text);
  } catch (e) {
    logger.warn('[MaestroInteligente] regenerateFlowContent: LLM falhou', { organizationId, err: String(e) });
    return unchanged();
  }
  if (!parsed || typeof parsed !== 'object') return unchanged();

  const newWelcome = String(parsed.welcomeText || curWelcome).slice(0, 600);
  const newTag = (String(parsed.tag || curTag).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)) || curTag;
  const newAi = String(parsed.aiPrompt || curAi).slice(0, 900);

  // Patch SÓ os nós de conteúdo, preservando todo o resto (estrutura/posições).
  const newNodes = nodes.map((n, i) => {
    if (i === msgIdx) return { ...n, data: { ...n.data, text: newWelcome } };
    if (i === tagIdx) return { ...n, data: { ...n.data, tag: newTag } };
    if (i === aiIdx) return { ...n, data: { ...n.data, prompt: newAi } };
    return n;
  });

  return {
    name: flow.name,
    nodes: newNodes,
    edges: flow.edges,
    changeNote: String(parsed.changeNote || 'Atualizei os textos do fluxo com base no seu treinamento mais recente.').slice(0, 400),
    newWelcome,
    oldWelcome: curWelcome,
    source: 'ai',
  };
}

// ============================================================================
// MAESTRO INTELIGENTE 2.0 — O ARQUITETO DE JORNADA (generateJourney)
// ============================================================================
// Salto de "gerador de fluxos isolados" para "consultor que desenha a operação
// inteira". A partir de TODO o ai-training, o Maestro:
//   1. monta um fluxo especialista por objetivo (Atendimento, Qualificação,
//      Agendamento, Vendas, FAQ, Pós-venda) — a jornada completa do negócio;
//   2. DESENHA a malha de interligações (handoffs) entre os fluxos, cada aresta
//      com a INTENÇÃO que dispara o salto + o racional do consultor (ex.:
//      "objeção de preço" → Vendas; "fechou a compra" → Pós-venda). Loops e
//      caminhos bidirecionais são esperados (dúvidas↔vendas, agendamento↔vendas);
//   3. injeta CONSCIÊNCIA DE HANDOFF no Nó-IA de cada fluxo — o prompt do agente
//      passa a conhecer as transições possíveis, então o comportamento real já
//      muda hoje (handoff "quente" carregando contexto), antes mesmo do motor
//      de roteamento multi-fluxo ao vivo (próxima onda dedicada).
// Padrões emprestados das líderes: Decagon (AOP por tarefa), Voiceflow (global
// triggers / saltar entre fluxos por intenção), Sierra (montar tudo do que o
// cliente já escreveu), journey orchestration (deflexão, cross-sell, escalonar).

export interface JourneyHandoff {
  from: BlueprintGoal;
  to: BlueprintGoal;
  /** Intenção/condição que dispara o salto (curto, pt-BR). */
  intent: string;
  /** Por que o Maestro ligou assim (1 frase, viés consultivo). */
  why: string;
}

export interface JourneyFlow {
  goal: BlueprintGoal;
  draft: FlowDraft;
}

export interface JourneyResult {
  flows: JourneyFlow[];
  handoffs: JourneyHandoff[];
  objectives: BlueprintGoal[];
  /** Resumo consultivo do Maestro pro dono do negócio. */
  summary: string;
  note: string;
}

const GOAL_LABEL: Record<BlueprintGoal, string> = {
  atendimento: BLUEPRINTS.atendimento.label,
  qualificacao: BLUEPRINTS.qualificacao.label,
  agendamento: BLUEPRINTS.agendamento.label,
  vendas: BLUEPRINTS.vendas.label,
  faq: BLUEPRINTS.faq.label,
  posvenda: BLUEPRINTS.posvenda.label,
};

/**
 * Malha de handoffs determinística (fallback se a IA falhar) — uma jornada
 * realista e completa. Mantém só as arestas cujas duas pontas existem no
 * conjunto de objetivos gerados.
 */
function defaultHandoffs(objectives: BlueprintGoal[]): JourneyHandoff[] {
  const set = new Set(objectives);
  const candidates: JourneyHandoff[] = [
    { from: 'atendimento', to: 'qualificacao', intent: 'o contato é novo e demonstra interesse', why: 'Entender a necessidade antes de oferecer qualquer coisa.' },
    { from: 'atendimento', to: 'faq', intent: 'o cliente tem só uma dúvida pontual', why: 'Resolver rápido sem fricção — deflexão.' },
    { from: 'atendimento', to: 'agendamento', intent: 'o cliente já quer marcar um horário', why: 'Atalho direto pra quem chega decidido.' },
    { from: 'atendimento', to: 'posvenda', intent: 'o cliente já comprou e precisa de suporte', why: 'Separar quem é cliente de quem é lead.' },
    { from: 'qualificacao', to: 'vendas', intent: 'o lead está qualificado e com fit', why: 'Lead pronto vai pra venda no momento certo.' },
    { from: 'qualificacao', to: 'agendamento', intent: 'o lead prefere conversar ou visitar antes', why: 'Respeitar o ritmo de quem precisa de mais toque.' },
    { from: 'faq', to: 'vendas', intent: 'a dúvida foi resolvida e surgiu intenção de compra', why: 'Aproveitar a janela de interesse logo após o esclarecimento.' },
    { from: 'vendas', to: 'faq', intent: 'surgiu uma objeção ou dúvida que trava a compra', why: 'Tirar a dúvida e devolver o cliente pro fechamento.' },
    { from: 'vendas', to: 'agendamento', intent: 'fechar exige marcar um horário, visita ou demonstração', why: 'Quando a venda depende de um próximo encontro.' },
    { from: 'agendamento', to: 'vendas', intent: 'horário marcado, hora de retomar a venda', why: 'Não deixar o agendamento esfriar — voltar a vender.' },
    { from: 'vendas', to: 'posvenda', intent: 'a compra foi fechada', why: 'Transição natural pra encantar e fidelizar.' },
    { from: 'posvenda', to: 'vendas', intent: 'cliente satisfeito com potencial de recompra ou upsell', why: 'Pós-venda bem feito reabre venda — cross-sell/upsell.' },
  ];
  return candidates.filter((h) => set.has(h.from) && set.has(h.to));
}

/**
 * O Maestro (consultor) desenha a malha de handoffs olhando o negócio real.
 * Se a IA falhar ou devolver lixo, cai no defaultHandoffs (jornada realista).
 */
async function designHandoffs(
  ctx: BusinessContext,
  objectives: BlueprintGoal[],
  organizationId: string,
): Promise<JourneyHandoff[]> {
  if (objectives.length < 2) return [];
  const fallback = () => defaultHandoffs(objectives);

  const list = objectives.map((g) => `- ${g}: ${GOAL_LABEL[g]}`).join('\n');
  const system = [
    'Você é o MAESTRO INTELIGENTE da ZappIQ atuando como CONSULTOR de operação conversacional.',
    'Sua tarefa: desenhar a malha de TRANSIÇÕES (handoffs) entre os fluxos do negócio — como uma conversa real flui do primeiro contato ao fechamento e pós-venda.',
    'Pense em TODOS os cenários plausíveis para ESTE negócio: objeção→vendas, dúvida→faq, faq→vendas, qualificou→vendas, venda→agendamento, agendamento→vendas (loop), venda→pós-venda, pós-venda→nova venda (upsell). Loops e caminhos bidirecionais são desejáveis.',
    'Responda EXCLUSIVAMENTE com JSON válido, sem cercas, sem texto antes/depois.',
  ].join(' ');

  const user = [
    '=== CONTEXTO DO NEGÓCIO (treinamento da IA) ===',
    ctx.brief,
    '',
    '=== FLUXOS DISPONÍVEIS (use SÓ estas chaves em from/to) ===',
    list,
    '',
    'Devolva este JSON. "from" e "to" devem ser chaves da lista acima. Gere de 6 a 14 transições realistas pra ESTE negócio:',
    '{',
    '  "handoffs": [',
    '    {"from":"atendimento","to":"qualificacao","intent":"condição curta que dispara o salto","why":"por que liguei assim (1 frase)"}',
    '  ],',
    '  "summary": "2-3 frases, como um consultor explicando ao dono do negócio a lógica da operação que você desenhou"',
    '}',
  ].join('\n');

  const tier = VALID_TIERS.includes(ctx.plan as LLMTier) ? (ctx.plan as LLMTier) : undefined;
  try {
    const resp = await llmRouter.complete({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 1100,
      temperature: 0.5,
      tier,
      forceProvider: 'anthropic-sonnet' as LLMProviderId,
      orgId: organizationId,
      operation: 'chat',
    });
    const parsed = extractJson(resp.text);
    const raw = parsed && Array.isArray(parsed.handoffs) ? parsed.handoffs : null;
    if (!raw) return fallback();

    const valid = new Set(objectives);
    const seen = new Set<string>();
    const handoffs: JourneyHandoff[] = [];
    for (const h of raw) {
      const from = String(h?.from || '').toLowerCase().trim() as BlueprintGoal;
      const to = String(h?.to || '').toLowerCase().trim() as BlueprintGoal;
      if (!valid.has(from) || !valid.has(to) || from === to) continue;
      const key = `${from}->${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      handoffs.push({
        from,
        to,
        intent: String(h?.intent || 'quando fizer sentido').slice(0, 120),
        why: String(h?.why || '').slice(0, 200),
      });
      if (handoffs.length >= 16) break;
    }
    // Garante uma malha mínima: se a IA devolveu pouca coisa, completa com defaults.
    if (handoffs.length < 3) {
      const def = fallback();
      for (const d of def) {
        const key = `${d.from}->${d.to}`;
        if (!seen.has(key)) { seen.add(key); handoffs.push(d); }
      }
    }
    return handoffs;
  } catch (e) {
    logger.warn('[MaestroJornada] designHandoffs: LLM falhou — fallback', { organizationId, err: String(e) });
    return fallback();
  }
}

/**
 * ARQUITETO DE JORNADA — gera a operação inteira (fluxos + interligações) a
 * partir do ai-training. Se nenhum objetivo for passado, monta a jornada
 * completa recomendada pelo segmento (o cliente depois remove o que não usa).
 */
export async function generateJourney(input: {
  organizationId: string;
  objectives?: string[];
}): Promise<JourneyResult> {
  const { organizationId } = input;
  const ctx = await loadBusinessContext(organizationId);

  const requested = (input.objectives || [])
    .map((o) => String(o).toLowerCase().trim())
    .filter((o): o is BlueprintGoal => o in BLUEPRINTS);
  let objectives: BlueprintGoal[] = Array.from(new Set(requested));
  if (objectives.length === 0) objectives = recommendJourney(ctx.niche, ctx.segmento);

  // 1 fluxo especialista por objetivo (jornada multi-agente por padrão).
  const flows: JourneyFlow[] = [];
  for (const goal of objectives) {
    const draft = await generateDraftForObjective(ctx, BLUEPRINTS[goal], organizationId, true);
    flows.push({ goal, draft });
  }

  // O consultor desenha as interligações.
  const handoffs = await designHandoffs(ctx, objectives, organizationId);

  // Injeta consciência de handoff no Nó-IA de cada fluxo (handoff "quente").
  for (const jf of flows) {
    const outgoing = handoffs.filter((h) => h.from === jf.goal);
    if (outgoing.length === 0) continue;
    const aiNode = (jf.draft.nodes as any[]).find((n) => n?.type === 'ai');
    if (!aiNode) continue;
    const lines = outgoing.map(
      (h) => `- Se ${h.intent}, conduza a conversa para o fluxo de "${GOAL_LABEL[h.to]}" (carregue o contexto, não faça o cliente repetir).`,
    );
    aiNode.data = aiNode.data || {};
    aiNode.data.prompt = `${aiNode.data.prompt}\n\nTransições possíveis (handoffs desenhados pelo Maestro):\n${lines.join('\n')}`;
    // Metadados pro motor de roteamento ao vivo (próxima onda) já ler daqui.
    aiNode.data.handoffs = outgoing.map((h) => ({ to: h.to, intent: h.intent }));
  }

  const summary =
    `Desenhei a operação completa de ${ctx.businessName}: ${flows.length} fluxos especialistas ` +
    `(${objectives.map((g) => GOAL_LABEL[g]).join(', ')}) já interligados em ${handoffs.length} transições — ` +
    `do primeiro contato ao fechamento e pós-venda. Cada agente sabe pra onde levar o cliente em cada cenário.`;
  const note =
    'Esta é a sua operação inteira, pensada de ponta a ponta. Você pode abrir cada fluxo pra ver as atividades, ' +
    'editar as conexões e remover o que não usa. Ao salvar, os agentes passam a conhecer essas transições.';

  return { flows, handoffs, objectives, summary, note };
}
