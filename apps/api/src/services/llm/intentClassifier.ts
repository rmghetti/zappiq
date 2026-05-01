/* ══════════════════════════════════════════════════════════════════════
 * V4 #143 · Intent classifier (escala pra Sonnet em casos críticos)
 * --------------------------------------------------------------------
 * Classifica a intent da última mensagem do cliente em uma de 4 categorias:
 *   - handoff:    cliente pede explicitamente falar com humano
 *   - objection:  objeção de preço, dúvida séria, comparação concorrente
 *   - enterprise: volume alto (>500/dia), C-level, escala enterprise
 *   - normal:     tudo mais (saudação, dúvida simples, info request)
 *
 * Política de uso (V4 routing):
 *   - intent ≠ 'normal' → forçar provider Sonnet 4.6 (mesmo em tier Gemini)
 *   - intent === 'normal' → usar tier-based default (Gemini em Starter/Growth)
 *
 * Por quê?
 *   Gate 1 mostrou que Gemini falha em handoff (insiste em conversa) e
 *   tende a respostas rasas em objeção complexa. Sonnet é mais consultivo.
 *   Custo extra: ~10% dos turnos disparam classify Sonnet — margem aceitável.
 *
 * Custo do classifier em si:
 *   - Provider: Haiku 4.5 (rápido + barato, $1/$5 por 1M tokens)
 *   - Tokens: ~120 in + ~3 out por classify = ~$0.0001/turn
 *   - Latência: +400-700ms (aceitável vs ganho qualidade Sonnet)
 *
 * Fallback safe-default:
 *   Se Haiku falhar OU parse falhar → return 'normal' (não bloqueia turn).
 *   Audit registra que classify falhou pra investigação posterior.
 * ══════════════════════════════════════════════════════════════════════ */

import { llmRouter, type LLMMessage } from './LLMRouter.js';
import { logger } from '../../utils/logger.js';

export type IzaIntent = 'handoff' | 'objection' | 'enterprise' | 'normal';

const VALID_INTENTS: ReadonlySet<IzaIntent> = new Set([
  'handoff',
  'objection',
  'enterprise',
  'normal',
]);

/**
 * Prompt de classificação. Mantém curto pra minimizar tokens in.
 * Few-shot com 4 exemplos cobrindo cada categoria — calibração necessária
 * pra Haiku acertar bem (Haiku é menor que Sonnet).
 */
const CLASSIFY_SYSTEM_PROMPT = `Você é um classificador de intent de conversas de venda em pt-BR.

Classifique a ÚLTIMA mensagem do cliente em UMA das categorias:

- handoff: cliente pede explicitamente falar com humano (ex: "quero falar com gente", "prefiro humano", "não quero bot", "humano por favor")
- objection: cliente está negociando preço de forma séria, levantando dúvida técnica complexa, ou comparando concorrente específico (ex: "tá caro", "qual a diferença pra Take Blip?", "esse preço é negociável?")
- enterprise: cliente menciona volume alto (>500 mensagens/dia), cargo C-level (CEO, CTO, Diretor), escala enterprise, ou pede demo customizada (ex: "sou CEO", "1500 atendimentos/dia", "preciso falar com fundador")
- normal: TUDO mais (saudação simples, pergunta de preço genérica, dúvida sobre features, descoberta de necessidade)

Responda APENAS UMA PALAVRA: handoff, objection, enterprise, ou normal.
Sem pontuação, sem explicação, sem prefixo. APENAS a palavra.`;

export interface ClassifyContext {
  orgId?: string | null;
  conversationId?: string | null;
}

/**
 * Classifica a intent da última mensagem do cliente.
 *
 * @param message Última mensagem do cliente (a que vai ser respondida).
 * @param history Histórico anterior (até ~5 turns) — opcional, ajuda contexto.
 * @param ctx     Contexto pra audit (orgId, conversationId).
 * @returns Intent classificada. Em caso de erro, retorna 'normal' (safe).
 */
export async function classifyIntent(
  message: string,
  history: LLMMessage[] = [],
  ctx: ClassifyContext = {},
): Promise<IzaIntent> {
  if (!message || typeof message !== 'string') {
    return 'normal';
  }

  // Monta prompt de classify. Histórico curto (últimos 4 turns) pra contexto.
  const recentHistory = history.slice(-4);
  const historyBlock = recentHistory.length
    ? recentHistory
        .map((m) => `${m.role === 'user' ? 'Cliente' : 'Iza'}: ${m.content}`)
        .join('\n')
    : '(sem histórico)';

  const userPrompt = `Histórico recente:\n${historyBlock}\n\nÚltima mensagem do cliente: "${message}"\n\nIntent:`;

  try {
    const resp = await llmRouter.complete({
      system: CLASSIFY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 10,
      temperature: 0,
      forceProvider: 'anthropic-haiku',
      operation: 'classify',
      orgId: ctx.orgId ?? null,
      conversationId: ctx.conversationId ?? null,
    });

    const raw = (resp.text ?? '').toLowerCase();
    // Procura uma das intents válidas em QUALQUER posição (word boundary).
    // Cobre casos: "handoff", "Intent: handoff", "objection.", "  HANDOFF\n",
    // "intent é objection", etc. A primeira ocorrência vence.
    const match = raw.match(/\b(handoff|objection|enterprise|normal)\b/);
    if (match) {
      return match[1] as IzaIntent;
    }

    logger.warn(`[intentClassifier] Resposta inesperada de Haiku: "${raw}" — fallback 'normal'`, {
      orgId: ctx.orgId,
      conversationId: ctx.conversationId,
    });
    return 'normal';
  } catch (err: any) {
    // Cascade exhausted (todos providers falharam) ou erro 4xx do Haiku.
    // Não bloqueia o turn — fallback safe.
    logger.warn(`[intentClassifier] Classify falhou: ${err.message} — fallback 'normal'`, {
      orgId: ctx.orgId,
      conversationId: ctx.conversationId,
    });
    return 'normal';
  }
}

/**
 * Retorna `true` se a intent classificada exige escalar pra Sonnet,
 * mesmo em tier Gemini default. Helper pra usar em conditionals:
 *
 *   const intent = await classifyIntent(msg, history, ctx);
 *   const provider = shouldEscalateToSonnet(intent) ? 'anthropic-sonnet' : undefined;
 *   await llmRouter.complete({ ..., forceProvider: provider, tier: org.plan });
 */
export function shouldEscalateToSonnet(intent: IzaIntent): boolean {
  return intent !== 'normal';
}
