/**
 * ZappIQ Maestro — Flow Simulator Core (Pacote 2.8 / Task S1)
 * ============================================================================
 * scoreConversation — PURE verdict: sem efeitos colaterais, testável.
 * runOnePersona    — drive the REAL resolveFlowStep turn-by-turn with all
 *                    LLM calls injected via SimDeps (so the loop is testable
 *                    with stubs and stays completely out of the flow engine).
 * ============================================================================
 */

import { resolveFlowStep, type FlowGraph, type FlowState, type EvalContext, type FlowEffect, DEFAULT_CTX } from './flowEngine.js';
import { loadBusinessContext, extractJson } from './flowGenerator.js';
import { llmRouter } from '../services/llm/LLMRouter.js';
import { runJudge } from '../services/agentEvalRunner.js';
import { resolveTenantAgentProfile } from './tenantAgentProfile.js';
import { logger } from '../utils/logger.js';

export interface Persona {
  id: string;
  name: string;
  tone: string;
  intent: string;
  painPoint: string;
}

export interface SimTurn {
  from: 'customer' | 'bot';
  text: string;
  judged?: { passed: boolean; reason?: string };
}

export interface Verdict {
  passed: boolean;
  confidence: number;
  reason: string;
}

export interface ConversationResult {
  persona: Persona;
  turns: SimTurn[];
  ended: boolean;
  verdict: Verdict;
}

export interface SimDeps {
  /** Gera a próxima mensagem do cliente simulado. */
  customerSays: (persona: Persona, history: SimTurn[]) => Promise<string>;
  /** Gera a resposta do bot para um nó-IA (usa LLM real ou stub nos testes). */
  botReplies: (aiPrompt: string, history: SimTurn[], persona: Persona) => Promise<string>;
  /** Avalia a qualidade da resposta do bot no turno atual. */
  judge: (persona: Persona, history: SimTurn[]) => Promise<Verdict>;
  /** Constrói o EvalContext para o motor (contato, horário, agora). */
  buildCtx: () => EvalContext;
  /** Limite de turnos antes de encerrar por timeout (default 8). */
  maxTurns?: number;
}

const DEFAULT_MAX_TURNS = 8;

/**
 * Extrai o texto que o bot "fala" a partir dos efeitos do motor.
 * Apenas os kinds que produzem mensagens visíveis ao cliente contribuem.
 */
function botTextFromEffects(effects: FlowEffect[]): string {
  const parts: string[] = [];
  for (const e of effects) {
    if (e.kind === 'send_text') {
      parts.push(e.text);
    } else if (e.kind === 'send_interactive') {
      parts.push(e.body + ' [' + e.options.map((o) => o.title).join(' / ') + ']');
    } else if (e.kind === 'send_media') {
      parts.push(e.caption ?? '[mídia]');
    }
    // set_tag, update_lead, handoff, goto_flow → não produzem texto visível
  }
  return parts.join('\n');
}

/**
 * PURE: veredicto final da conversa.
 * Regras em ordem de prioridade:
 *  1. Não encerrou → falhou (fluxo travou ou atingiu maxTurns).
 *  2. Algum turno teve juízo negativo → falhou com o motivo do 1.º.
 *  3. Tudo ok → passou.
 */
export function scoreConversation(turns: SimTurn[], ended: boolean, _persona: Persona): Verdict {
  if (!ended) {
    return {
      passed: false,
      confidence: 0.4,
      reason: 'A conversa não encerrou (o fluxo travou ou ficou aguardando completar o ciclo).',
    };
  }
  const firstFail = turns.find((t) => t.judged && !t.judged.passed);
  if (firstFail) {
    const why = firstFail.judged?.reason ?? 'um ponto da conversa foi mal tratado';
    return { passed: false, confidence: 0.6, reason: `Encerrou, mas ${why}.` };
  }
  return {
    passed: true,
    confidence: 0.8,
    reason: 'O fluxo conduziu a conversa até o fim de forma coerente.',
  };
}

/**
 * Executa a simulação completa para uma persona, usando o REAL resolveFlowStep
 * e com todas as chamadas de LLM (customerSays, botReplies, judge) injetadas
 * via deps — substituíveis por stubs nos testes unitários.
 */
export async function runOnePersona(
  graph: FlowGraph,
  persona: Persona,
  deps: SimDeps,
): Promise<ConversationResult> {
  const maxTurns = deps.maxTurns ?? DEFAULT_MAX_TURNS;
  const ctx = deps.buildCtx();
  let state: FlowState = { cursor: null, vars: {} };
  const turns: SimTurn[] = [];
  let ended = false;

  for (let i = 0; i < maxTurns; i++) {
    // 1. Cliente fala (stub ou LLM real)
    const msg = await deps.customerSays(persona, turns);
    turns.push({ from: 'customer', text: msg });

    // 2. Motor avança o fluxo
    const step = resolveFlowStep(graph, state, msg, { ctx, hasIncomingMessage: true });
    state = step.state;

    // 3. Texto produzido pelo motor (send_text / send_interactive / send_media)
    const botText = botTextFromEffects(step.effects);
    if (botText.trim()) {
      turns.push({ from: 'bot', text: botText });
    }

    // 4. Nó-IA: gera resposta e avalia qualidade
    if (step.next === 'ai') {
      const aiReply = await deps.botReplies(step.aiPrompt ?? '', turns, persona);
      const judged = await deps.judge(persona, turns);
      turns.push({
        from: 'bot',
        text: aiReply.trim() ? aiReply : '(sem resposta)',
        judged,
      });
      // Próximo turno: cliente reage à resposta da IA
      continue;
    }

    // 5. Fim ou agendamento → encerra a simulação
    if (step.next === 'end' || step.next === 'scheduled') {
      ended = true;
      break;
    }

    // next === 'await_input' → loop continua; cliente enviará nova mensagem
  }

  const verdict = scoreConversation(turns, ended, persona);
  return { persona, turns, ended, verdict };
}

// ─── IO layer: persona generation + orchestration ──────────────────────────

export async function generateSyntheticPersonas(
  brief: string,
  count: number,
  organizationId: string,
): Promise<Persona[]> {
  const n = Math.min(Math.max(count, 1), 8);
  const fallback = (): Persona[] =>
    [
      { id: 'p1', name: 'Cliente decidido', tone: 'objetivo', intent: 'comprar agora', painPoint: 'quer fechar rápido' },
      { id: 'p2', name: 'Cliente em dúvida', tone: 'curioso', intent: 'tirar dúvidas', painPoint: 'não entende o produto' },
      { id: 'p3', name: 'Cliente com objeção', tone: 'cético', intent: 'questionar preço', painPoint: 'acha caro' },
    ].slice(0, n);
  try {
    const system =
      'Você gera personas de clientes sintéticos para testar um fluxo de atendimento no WhatsApp. Responda só com JSON válido.';
    const user = [
      '=== NEGÓCIO ===',
      brief.slice(0, 3000),
      '',
      `Gere ${n} personas DIVERSAS (intenções variadas: comprar, dúvida, objeção de preço, suporte pós-venda, cliente apressado).`,
      'Devolva: {"personas":[{"name":"...","tone":"...","intent":"...","painPoint":"..."}]}',
    ].join('\n');
    const resp = await llmRouter.complete({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 700,
      temperature: 0.8,
      forceProvider: 'anthropic-sonnet' as any,
      orgId: organizationId,
      operation: 'chat',
    });
    const parsed = extractJson(resp.text);
    const arr = parsed && Array.isArray(parsed.personas) ? parsed.personas : null;
    if (!arr || arr.length === 0) return fallback();
    return arr.slice(0, n).map((p: any, i: number) => ({
      id: `p${i + 1}`,
      name: String(p?.name || `Persona ${i + 1}`).slice(0, 40),
      tone: String(p?.tone || 'neutro').slice(0, 40),
      intent: String(p?.intent || 'conversar').slice(0, 80),
      painPoint: String(p?.painPoint || '').slice(0, 120),
    }));
  } catch (e) {
    logger.warn('[Maestro] generateSyntheticPersonas falhou — fallback', { organizationId, err: String(e) });
    return fallback();
  }
}

export interface SimulationReport {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  byPersona: Array<{ persona: Persona; passed: boolean; reason: string; turns: number }>;
  recommendations: string[];
}

export async function executeFlowSimulation(input: {
  organizationId: string;
  flow: { name: string; nodes: any[]; edges: any[] };
  personaCount?: number;
}): Promise<SimulationReport> {
  const { organizationId, flow } = input;
  const graph = {
    nodes: Array.isArray(flow.nodes) ? flow.nodes : [],
    edges: Array.isArray(flow.edges) ? flow.edges : [],
  } as any;
  const ctx = await loadBusinessContext(organizationId).catch(() => ({ brief: '' } as any));
  const personas = await generateSyntheticPersonas(ctx.brief || '', input.personaCount ?? 3, organizationId);

  // O juiz precisa saber de quem é o agente que ele está julgando. Sem isso ele
  // avalia o fluxo do cliente com o contexto comercial errado.
  const profile = await resolveTenantAgentProfile(organizationId);

  const results: ConversationResult[] = [];
  for (const persona of personas) {
    try {
      const r = await runOnePersona(graph, persona, {
        customerSays: async (p, history) => personaSay(p, history, organizationId),
        botReplies: async (aiPrompt, history, p) => botReply(aiPrompt, history, p, organizationId),
        judge: async (p, history) =>
          runJudge(
            `Atender bem um cliente cujo objetivo é: ${p.intent} (dor: ${p.painPoint}). O bot deve ser útil, claro e conduzir a conversa.`,
            lastBot(history),
            profile,
          ),
        buildCtx: () => DEFAULT_CTX,
        maxTurns: 6,
      });
      results.push(r);
    } catch (e) {
      logger.warn('[Maestro] simulação de persona falhou', { organizationId, persona: persona.id, err: String(e) });
      results.push({
        persona,
        turns: [],
        ended: false,
        verdict: { passed: false, confidence: 0, reason: 'Erro ao simular esta persona.' },
      });
    }
  }

  const passed = results.filter((r) => r.verdict.passed).length;
  const failed = results.length - passed;
  const recommendations = results
    .filter((r) => !r.verdict.passed)
    .map((r) => `${r.persona.name} (${r.persona.intent}): ${r.verdict.reason}`)
    .slice(0, 5);
  return {
    total: results.length,
    passed,
    failed,
    passRate: results.length ? Math.round((passed / results.length) * 100) : 0,
    byPersona: results.map((r) => ({
      persona: r.persona,
      passed: r.verdict.passed,
      reason: r.verdict.reason,
      turns: r.turns.length,
    })),
    recommendations,
  };
}

// ─── IO helpers: persona fala / bot-IA responde ────────────────────────────

function lastBot(history: SimTurn[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].from === 'bot') return history[i].text;
  }
  return '';
}

async function personaSay(persona: Persona, history: SimTurn[], orgId: string): Promise<string> {
  const system = `Você É um cliente no WhatsApp. Perfil: ${persona.name}, tom ${persona.tone}, objetivo: ${persona.intent}, dor: ${persona.painPoint}. Responda curto e natural em pt-BR, no personagem. Se já conseguiu o que queria ou não há mais o que dizer, diga algo como "ok, obrigado".`;
  const convo = history.map((t) => `${t.from === 'bot' ? 'Atendente' : 'Você'}: ${t.text}`).join('\n');
  const user =
    history.length === 0
      ? 'Inicie a conversa com sua primeira mensagem.'
      : `Conversa até agora:\n${convo}\n\nSua próxima mensagem:`;
  try {
    const resp = await llmRouter.complete({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 120,
      temperature: 0.8,
      orgId,
      operation: 'chat',
    });
    return (resp.text || 'ok').trim().slice(0, 300);
  } catch {
    return 'ok';
  }
}

async function botReply(aiPrompt: string, history: SimTurn[], _persona: Persona, orgId: string): Promise<string> {
  const system = `Você é o agente de IA de atendimento. Instrução do nó: ${aiPrompt || 'ajude o cliente'}. Responda curto e útil em pt-BR.`;
  const convo = history.map((t) => `${t.from === 'bot' ? 'Você' : 'Cliente'}: ${t.text}`).join('\n');
  try {
    const resp = await llmRouter.complete({
      system,
      messages: [{ role: 'user', content: convo + '\n\nSua resposta:' }],
      maxTokens: 200,
      temperature: 0.5,
      orgId,
      operation: 'chat',
    });
    return (resp.text || '').trim().slice(0, 500);
  } catch {
    return '';
  }
}
