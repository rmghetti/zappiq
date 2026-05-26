/* ══════════════════════════════════════════════════════════════════════
 * V4 #143 · Iza Turn Router — wrapper que combina pre-filter + classify
 * --------------------------------------------------------------------
 * Função única que encapsula a inteligência de routing V4 pra cada turn:
 *
 *   1. Pre-filter de verticais bloqueadas (regex local, sem LLM)
 *      → Se match: retorna template estático, ZERO custo LLM
 *
 *   2. Classify de intent (Haiku, ~$0.0001/turn)
 *      → handoff/objection/enterprise → força Sonnet 4.6
 *      → normal → usa tier-based default (Gemini em Starter/Growth)
 *
 *   3. Chamada principal LLMRouter.complete() com routing inteligente
 *      → Audit completo via llm_call_logs (tier, intent, provider final)
 *
 * Integração no agentOrchestrator (1 linha):
 *
 *   const result = await routeIzaTurn({
 *     systemPrompt,
 *     userMessage: messageContent,
 *     history,
 *     tier: org.plan,
 *     orgId, conversationId,
 *   });
 *   if (result.kind === 'blocked') {
 *     await waService.sendText(contactPhone, result.response);
 *   } else {
 *     await waService.sendText(contactPhone, result.response.text);
 *   }
 *
 * Por que separar do LLMRouter?
 *   LLMRouter é a primitiva (1 turn, 1 cascade). izaTurnRouter é a política
 *   de venda da Iza (pre-filter de compliance + classify de intent).
 *   Outras orgs (não-Iza) podem usar LLMRouter direto sem essa política.
 * ══════════════════════════════════════════════════════════════════════ */

import { llmRouter, type LLMMessage, type LLMTier, type LLMProviderId } from './LLMRouter.js';
import {
  detectBlockedVertical,
  type BlockedVertical,
} from './blockedVerticalFilter.js';
import {
  classifyIntent,
  shouldEscalateToSonnet,
  type IzaIntent,
} from './intentClassifier.js';
import { logger } from '../../utils/logger.js';

export interface IzaTurnRequest {
  /** System prompt da Iza (V5 enxuto + few-shot patches). */
  systemPrompt: string;
  /** Última mensagem do cliente. */
  userMessage: string;
  /** Histórico anterior (turns prévios). */
  history?: LLMMessage[];
  /** Tier do tenant — determina default routing (V4 #V4-001). */
  tier?: LLMTier;
  /** Override de provider (raro — Enterprise custom). */
  forceProvider?: LLMProviderId;
  /** Pula classify (otimização — quando se sabe que é caso normal). */
  skipClassify?: boolean;
  /** Org ID pra audit. */
  orgId?: string | null;
  /** Conversation ID pra audit. */
  conversationId?: string | null;
  /** Tokens máx da resposta principal (default 1024). */
  maxTokens?: number;
}

export type IzaTurnResult =
  | {
      kind: 'blocked';
      vertical: BlockedVertical;
      response: string;
      matchedSnippet: string;
      llmCallsMade: 0;
    }
  | {
      kind: 'llm';
      response: { text: string; provider: string; model: string; latencyMs: number };
      intent: IzaIntent;
      escalated: boolean;
      tierUsed: LLMTier | undefined;
      llmCallsMade: 1 | 2;
    };

/**
 * Decide o provider final pra usar dado intent + tier + forceProvider.
 *
 * Prioridade:
 *   1. forceProvider (override explícito Enterprise)
 *   2. shouldEscalateToSonnet(intent) → 'anthropic-sonnet'
 *   3. tier-based via TIER_PRIMARY_PROVIDER (LLMRouter aplica)
 */
function pickProvider(
  intent: IzaIntent,
  tier: LLMTier | undefined,
  forceProvider: LLMProviderId | undefined,
): LLMProviderId | undefined {
  if (forceProvider) return forceProvider;
  if (shouldEscalateToSonnet(intent)) return 'anthropic-sonnet';
  return undefined; // deixa LLMRouter decidir via tier
}

/**
 * Roteia um turn da Iza com pre-filter + classify + tier routing.
 *
 * Comportamento:
 *   - Pre-filter HIT → retorna template estático sem chamar LLM
 *   - skipClassify=true → pula classify, vai direto pra LLM com tier default
 *   - Caso normal → classify (Haiku) + LLM principal (Sonnet ou tier-based)
 *
 * Garantias:
 *   - Pre-filter NUNCA chama LLM (zero custo em caso bloqueado)
 *   - Classify failure NÃO bloqueia turn (fallback intent='normal')
 *   - LLM principal failure propaga erro pro caller (caller decide retry)
 */
export async function routeIzaTurn(req: IzaTurnRequest): Promise<IzaTurnResult> {
  // ── 1. Pre-filter (regex local, zero custo) ──────────────────
  const blockedCheck = detectBlockedVertical(req.userMessage);
  if (blockedCheck.blocked) {
    logger.info(
      `[izaTurnRouter] Pre-filter blocked: vertical=${blockedCheck.vertical}, snippet="${blockedCheck.matchedSnippet}"`,
      { orgId: req.orgId, conversationId: req.conversationId },
    );
    return {
      kind: 'blocked',
      vertical: blockedCheck.vertical,
      response: blockedCheck.suggestedResponse,
      matchedSnippet: blockedCheck.matchedSnippet,
      llmCallsMade: 0,
    };
  }

  const history = req.history ?? [];

  // ── 2. Classify intent (Haiku, opcional) ─────────────────────
  const intent: IzaIntent = req.skipClassify
    ? 'normal'
    : await classifyIntent(req.userMessage, history, {
        orgId: req.orgId,
        conversationId: req.conversationId,
      });

  // ── 3. Decide provider final ──────────────────────────────────
  // PR #216 fix: escalada por intent agora usa preferProvider (com fallback)
  // em vez de forceProvider (sem fallback). Bug anterior: Sonnet rate-limit
  // → "all providers exhausted" → lead recebe vazio. Agora cai pra Haiku/Gemini.
  // forceProvider (Enterprise override hard) preservado intacto.
  const hardForce = req.forceProvider; // override Enterprise (sem fallback)
  const softPrefer =
    !hardForce && shouldEscalateToSonnet(intent) ? 'anthropic-sonnet' : undefined;

  if (intent !== 'normal') {
    logger.info(
      `[izaTurnRouter] Intent=${intent} → prefer Sonnet com fallback (tier=${req.tier})`,
      { orgId: req.orgId, conversationId: req.conversationId },
    );
  }

  // ── 4. Chamada LLM principal ─────────────────────────────────
  const messages: LLMMessage[] = [
    ...history,
    { role: 'user', content: req.userMessage },
  ];

  const resp = await llmRouter.complete({
    system: req.systemPrompt,
    messages,
    // V4 #162 (PR #74 hotfix 2026-05-04) — bumpado de 1024 → 2048.
    // Feedback usuário: resposta com 6 pacotes Voice + intro foi cortada em
    // "trial 14 dias inclui 30 minutos grát" (pareceu estourar limite output).
    // 2048 tokens (~6000-8000 chars) cobre listas longas confortavelmente.
    // Custo extra negligenciável (Gemini Flash $0.30/1M output ≈ +$0.0003/turn).
    maxTokens: req.maxTokens ?? 2048,
    operation: 'chat',
    forceProvider: hardForce,
    preferProvider: softPrefer,
    tier: hardForce || softPrefer ? undefined : req.tier,
    orgId: req.orgId ?? null,
    conversationId: req.conversationId ?? null,
  });

  return {
    kind: 'llm',
    response: {
      text: resp.text,
      provider: resp.provider,
      model: resp.model,
      latencyMs: resp.latencyMs,
    },
    intent,
    escalated: intent !== 'normal',
    tierUsed: req.tier,
    llmCallsMade: req.skipClassify ? 1 : 2,
  };
}
