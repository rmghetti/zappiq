/**
 * ZappIQ Maestro — Flow Simulator Core (Pacote 2.8 / Task S1)
 * ============================================================================
 * scoreConversation — PURE verdict: sem efeitos colaterais, testável.
 * runOnePersona    — drive the REAL resolveFlowStep turn-by-turn with all
 *                    LLM calls injected via SimDeps (so the loop is testable
 *                    with stubs and stays completely out of the flow engine).
 * ============================================================================
 */

import { resolveFlowStep, type FlowGraph, type FlowState, type EvalContext, type FlowEffect } from './flowEngine.js';

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
