/* ══════════════════════════════════════════════════════════════════════
 * V2-018 · LLM cost estimator (Sprint 0 Blocker 1)
 * --------------------------------------------------------------------
 * Estimativa de custo por chamada LLM em USD, baseada em preços
 * publicados pelos providers no momento da implementação (abril/2026).
 *
 * Tabela canônica em USD/1M tokens:
 *   - claude-sonnet-4-6:        $3.00 in  / $15.00 out
 *   - claude-haiku-4-5-20251001:$1.00 in  / $5.00  out
 *   - gpt-4o-mini:              $0.15 in  / $0.60  out
 *   - claude-opus-4-6:          $15.00 in / $75.00 out  (não em uso ativo)
 *
 * Uso:
 *   const usd = estimateCostUsd('claude-sonnet-4-6', 1500, 250);
 *   //   = (1500 / 1e6) * 3.00 + (250 / 1e6) * 15.00
 *   //   = 0.0045 + 0.00375 = 0.00825
 *
 * Política de atualização: quando preço de provider mudar, atualizar
 * MODEL_PRICING e bumpar a constante PRICING_VERSION. Inserir nota
 * em CHANGELOG.md com a data. Não invocar API de pricing dinâmico —
 * tabela hardcoded é mais previsível e barata.
 *
 * Limitações conhecidas:
 *   - Não conta cache hit (Anthropic prompt caching) — quando ativarmos
 *     em Q3 (Apêndice C do plano V2.0), adicionar costBreakdown com
 *     cache_creation_input_tokens e cache_read_input_tokens.
 *   - Não conta image tokens (vision) — adicionar quando entrar.
 * ══════════════════════════════════════════════════════════════════════ */

export const PRICING_VERSION = '2026-04-27';

export interface ModelPricing {
  /** USD por 1M input tokens */
  inputUsdPerMillion: number;
  /** USD por 1M output tokens */
  outputUsdPerMillion: number;
}

/**
 * Tabela canônica de preços. Chaves devem casar EXATAMENTE com o `model`
 * string usado nas chamadas (Anthropic API, OpenAI API).
 *
 * Quando adicionar modelo novo, atualizar também o teste em llmCost.test.ts.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  'claude-sonnet-4-6':           { inputUsdPerMillion: 3.0,   outputUsdPerMillion: 15.0 },
  'claude-haiku-4-5-20251001':   { inputUsdPerMillion: 1.0,   outputUsdPerMillion: 5.0  },
  'claude-opus-4-6':             { inputUsdPerMillion: 15.0,  outputUsdPerMillion: 75.0 },
  // OpenAI
  'gpt-4o-mini':                 { inputUsdPerMillion: 0.15,  outputUsdPerMillion: 0.60 },
  'gpt-4o':                      { inputUsdPerMillion: 2.5,   outputUsdPerMillion: 10.0 },
};

/**
 * Estima custo em USD de uma chamada. Retorna 0 se modelo desconhecido
 * (e loga warning via console — logger pode não estar disponível em
 * contexto de teste).
 *
 * Precisão: 6 casas decimais (suficiente pra rastrear ~$0.000001).
 */
export function estimateCostUsd(
  model: string,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    // eslint-disable-next-line no-console
    console.warn(`[llmCost] Unknown model "${model}" — cost estimated as 0`);
    return 0;
  }
  const inTok = Number(inputTokens ?? 0);
  const outTok = Number(outputTokens ?? 0);
  const cost =
    (inTok / 1_000_000) * pricing.inputUsdPerMillion +
    (outTok / 1_000_000) * pricing.outputUsdPerMillion;
  // 6 decimais — evita acumular erro de float em queries de SUM no Postgres.
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Retorna o pricing de um modelo, ou null se desconhecido.
 * Útil pra UI/dashboard que exibe breakdown.
 */
export function getModelPricing(model: string): ModelPricing | null {
  return MODEL_PRICING[model] ?? null;
}

/**
 * Lista todos os modelos com pricing conhecido.
 * Útil pra healthcheck/admin UI.
 */
export function listKnownModels(): string[] {
  return Object.keys(MODEL_PRICING);
}
