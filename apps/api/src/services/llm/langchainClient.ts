import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

// ── Singleton Anthropic client ─────────────────────────────────
// maxRetries: SDK faz retry exponencial automatico em 408/409/429/5xx.
// Padrao interno do SDK e 2; subimos para 3 para tolerar blips transientes
// da API sem propagar falha para o worker BullMQ (que ja tem attempts=2).
// timeout: 60s cobre respostas longas de Claude Sonnet com contexto grande.
const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY || '',
  maxRetries: 3,
  timeout: 60_000,
});

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Main conversation call — uses Claude Sonnet
 */
export async function chatCompletion(
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens = 1024
): Promise<LLMResponse> {
  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

/**
 * Fast classification call — uses Claude Haiku (cheaper/faster)
 */
export async function classify(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 30,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].type === 'text' ? response.content[0].text.trim().toLowerCase() : '';
}

/**
 * Sentiment analysis
 */
export async function analyzeSentiment(text: string): Promise<'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'> {
  const result = await classify(
    `Classify the sentiment of this customer message as POSITIVE, NEUTRAL, or NEGATIVE. Reply with ONLY the word.\n\nMessage: "${text}"`
  );

  const upper = result.toUpperCase();
  if (upper.includes('POSITIVE')) return 'POSITIVE';
  if (upper.includes('NEGATIVE')) return 'NEGATIVE';
  return 'NEUTRAL';
}
