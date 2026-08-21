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

import { llmRouter, type LLMMessage, type LLMTier, type LLMProviderId, type ToolDefinition } from './LLMRouter.js';
import {
  detectBlockedVertical,
  type BlockedVertical,
} from './blockedVerticalFilter.js';
import {
  classifyIntent,
  shouldEscalateToSonnet,
  type IzaIntent,
} from './intentClassifier.js';
import { executeToolCall, type ToolContext } from './tools.js';
import { logger } from '../../utils/logger.js';

// Máximo de rodadas do loop de tools num único turn (guarda contra loop infinito).
const MAX_TOOL_ROUNDS = 4;

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
  /**
   * Resposta Meta out/2026 (PR-I): Modo Econômico. true restringe a escalada
   * por intent (preferProvider Sonnet) SOMENTE ao caso handoff: pedido de
   * humano segue indo pro modelo forte, as demais intents (objection,
   * enterprise, purchase_intent, price_question) ficam no tier corrente.
   * Não silencia nada: só muda o provider preferido da resposta.
   */
  sonnetOnlyForHandoff?: boolean;
  /**
   * Org ID pra audit E pro pre-filter saber de quem é o funil.
   * Ausente = tratado como org de cliente (fail-safe): o pre-filter só aplica
   * as verticais de compliance, nunca a política comercial da ZappIQ.
   */
  orgId?: string | null;
  /**
   * Nome do negócio do tenant. Só usado na mensagem de compliance do
   * pre-filter ("{negócio} não atende..."). Ausente = mensagem neutra
   * ("Não atendemos..."), que serve pra qualquer negócio.
   */
  businessName?: string | null;
  /** Conversation ID pra audit. */
  conversationId?: string | null;
  /** Tokens máx da resposta principal (default 1024). */
  maxTokens?: number;
  /** Contato final (pra tools que gravam dados, ex.: agendamento). */
  contactId?: string | null;
  /**
   * Tools disponíveis neste turn (ex.: agendamento). Quando presente e não
   * vazio, o turn entra no loop de function-calling e usa um provider
   * tool-capable (Sonnet/OpenAI); o Gemini não suporta tools. Orgs sem tools
   * seguem o caminho normal, sem qualquer mudança de comportamento.
   */
  tools?: ToolDefinition[];
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
      // 1 (skipClassify) ou 2 (classify+chat) no caminho normal; mais quando o
      // loop de tools (agendamento) faz rodadas adicionais de complete().
      llmCallsMade: number;
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
  // A org decide o que é checado: na org da ZappIQ vale nossa política
  // comercial (apostas/cripto/MLM); na org de cliente só compliance, com
  // mensagem sem marca. Sem orgId → cliente (fail-safe).
  const blockedCheck = detectBlockedVertical(req.userMessage, {
    organizationId: req.orgId,
    businessName: req.businessName,
  });
  if (blockedCheck.blocked) {
    logger.info(
      `[izaTurnRouter] Pre-filter blocked: vertical=${blockedCheck.vertical}, layer=${blockedCheck.layer}, snippet="${blockedCheck.matchedSnippet}"`,
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
  // Modo Econômico (PR-I): com sonnetOnlyForHandoff, só o pedido de humano
  // (intent handoff) escala; o resto responde no tier corrente, mais barato.
  const escalaPermitida = !req.sonnetOnlyForHandoff || intent === 'handoff';
  const softPrefer =
    !hardForce && escalaPermitida && shouldEscalateToSonnet(intent) ? 'anthropic-sonnet' : undefined;

  if (intent !== 'normal') {
    if (softPrefer) {
      logger.info(
        `[izaTurnRouter] Intent=${intent} → prefer Sonnet com fallback (tier=${req.tier})`,
        { orgId: req.orgId, conversationId: req.conversationId },
      );
    } else if (req.sonnetOnlyForHandoff && !hardForce) {
      logger.info(
        `[izaTurnRouter] Intent=${intent} sem escalada (Modo Econômico: Sonnet só pra handoff)`,
        { orgId: req.orgId, conversationId: req.conversationId },
      );
    }
  }

  // ── 4. Chamada LLM principal ─────────────────────────────────
  const messages: LLMMessage[] = [
    ...history,
    { role: 'user', content: req.userMessage },
  ];

  const hasTools = Array.isArray(req.tools) && req.tools.length > 0;
  // Gemini não suporta tools. Quando há tools (ex.: agendamento), preferimos um
  // provider tool-capable (Sonnet, com fallback pra OpenAI que também suporta).
  // Sem tools, mantém exatamente o routing anterior.
  const toolPrefer: LLMProviderId | undefined = hasTools && !hardForce ? 'anthropic-sonnet' : softPrefer;
  const useTier = hardForce || toolPrefer ? undefined : req.tier;

  let resp = await llmRouter.complete({
    system: req.systemPrompt,
    messages,
    maxTokens: req.maxTokens ?? 2048,
    operation: 'chat',
    forceProvider: hardForce,
    preferProvider: toolPrefer,
    tier: useTier,
    orgId: req.orgId ?? null,
    conversationId: req.conversationId ?? null,
    tools: hasTools ? req.tools : undefined,
  });

  let llmCalls = req.skipClassify ? 1 : 2;

  // ── 4b. Loop de function-calling (só quando há tools) ─────────
  // Enquanto o modelo pedir tools, executamos e devolvemos o resultado, até
  // ele produzir a resposta final (ou o teto de rodadas). Cada rodada é um
  // par assistant(tool_use) → user(tool_result), no formato Anthropic.
  if (hasTools) {
    const toolCtx: ToolContext = {
      organizationId: req.orgId || '',
      conversationId: req.conversationId ?? null,
      contactId: req.contactId ?? null,
    };
    let rounds = 0;
    while (resp.stopReason === 'tool_use' && (resp.toolCalls?.length ?? 0) > 0 && rounds < MAX_TOOL_ROUNDS) {
      rounds++;
      const calls = resp.toolCalls!;
      // Bloco assistant com os tool_use pedidos.
      messages.push({
        role: 'assistant',
        content: calls.map((c) => ({ type: 'tool_use' as const, id: c.id, name: c.name, input: c.input })),
      });
      // Executa cada tool e monta os tool_result.
      const results = await Promise.all(
        calls.map(async (c) => ({
          type: 'tool_result' as const,
          tool_use_id: c.id,
          content: JSON.stringify(await executeToolCall(c.name, c.input, toolCtx)),
        })),
      );
      messages.push({ role: 'user', content: results });

      resp = await llmRouter.complete({
        system: req.systemPrompt,
        messages,
        maxTokens: req.maxTokens ?? 2048,
        operation: 'chat',
        forceProvider: hardForce,
        preferProvider: toolPrefer,
        tier: useTier,
        orgId: req.orgId ?? null,
        conversationId: req.conversationId ?? null,
        tools: req.tools,
      });
      llmCalls++;
    }
    if (rounds >= MAX_TOOL_ROUNDS && resp.stopReason === 'tool_use') {
      logger.warn('[izaTurnRouter] teto de rodadas de tools atingido', { orgId: req.orgId, conversationId: req.conversationId });
    }
  }

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
    llmCallsMade: llmCalls,
  };
}
