/* ══════════════════════════════════════════════════════════════════════
 * V4 #V4-004 (2026-05-11) · LLM streaming opt-in
 * --------------------------------------------------------------------
 * Tipos + parser SSE pra streaming. Não-breaking: o LLMRouter.complete()
 * tradicional continua existindo intacto. Quem quiser stream chama
 * llmRouter.completeStream(req) e itera sobre o AsyncIterable<LLMStreamChunk>.
 *
 * Por que streaming?
 *   - Iza em respostas longas (Sonnet pode chegar a 800+ tokens) tem TTFT
 *     de ~3-5s. Stream reduz TTFT pra <500ms e mantém usuário engajado.
 *   - Endpoint admin de teste (/api/admin/llm-stream-test) valida o
 *     pipeline antes de plugar no webhook WhatsApp (próximo PR).
 *
 * Roadmap:
 *   - Esta PR: AnthropicProvider streaming + endpoint admin SSE.
 *   - Próxima: plugar no agentOrchestrator (Iza) atrás de feature flag
 *     `org.settings.llm_streaming = true`.
 *   - Eventual: OpenAI + Gemini streaming (cada API tem formato próprio).
 *
 * Importante: WhatsApp não suporta streaming nativo. Pra Iza, streaming
 * é "pseudo": juntamos chunks no servidor e mandamos 1 mensagem final +
 * opcionalmente "digitando..." indicator durante o stream. O ganho é só
 * em UX no painel web (próximo PR).
 * ══════════════════════════════════════════════════════════════════════ */

import type { LLMCompletionResponse, LLMProviderId, ToolCall } from './LLMRouter.js';

/**
 * Chunk individual entregue pelo stream. Cada provider gera chunks com
 * granularidade própria (Anthropic = ~1-2 tokens, OpenAI = ~1 token).
 */
export type LLMStreamChunk =
  | { type: 'text-delta'; delta: string; cumulativeText: string }
  | { type: 'tool-use-start'; toolCall: ToolCall }
  | { type: 'tool-use-end'; toolCallId: string }
  | { type: 'done'; final: LLMCompletionResponse }
  | { type: 'error'; error: string; provider: LLMProviderId };

/**
 * Parser SSE genérico (Anthropic Messages API stream).
 * Anthropic stream events:
 *   - message_start
 *   - content_block_start (text ou tool_use)
 *   - content_block_delta (text_delta ou input_json_delta)
 *   - content_block_stop
 *   - message_delta (stop_reason, usage)
 *   - message_stop
 *
 * Refs: https://docs.anthropic.com/en/api/messages-streaming
 */
export async function* parseAnthropicSSE(
  body: ReadableStream<Uint8Array>,
  provider: LLMProviderId,
  model: string,
  startedAt: number,
): AsyncIterable<LLMStreamChunk> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = '';
  let cumulativeText = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason: LLMCompletionResponse['stopReason'] = 'unknown';
  const toolCalls: ToolCall[] = [];
  const toolCallsInProgress = new Map<number, { id: string; name: string; jsonAcc: string }>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Separa eventos SSE (delimitados por \n\n)
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const dataLine = part.split('\n').find((l) => l.startsWith('data: '));
        if (!dataLine) continue;
        const payload = dataLine.slice(6).trim();
        if (!payload || payload === '[DONE]') continue;

        let event: any;
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }

        const t = event?.type;
        if (t === 'content_block_start') {
          const idx = event.index ?? 0;
          const block = event.content_block;
          if (block?.type === 'tool_use') {
            toolCallsInProgress.set(idx, {
              id: block.id,
              name: block.name,
              jsonAcc: '',
            });
            yield {
              type: 'tool-use-start',
              toolCall: { id: block.id, name: block.name, input: {} },
            };
          }
        } else if (t === 'content_block_delta') {
          const delta = event.delta;
          if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
            cumulativeText += delta.text;
            yield { type: 'text-delta', delta: delta.text, cumulativeText };
          } else if (delta?.type === 'input_json_delta') {
            const idx = event.index ?? 0;
            const tc = toolCallsInProgress.get(idx);
            if (tc && typeof delta.partial_json === 'string') {
              tc.jsonAcc += delta.partial_json;
            }
          }
        } else if (t === 'content_block_stop') {
          const idx = event.index ?? 0;
          const tc = toolCallsInProgress.get(idx);
          if (tc) {
            let parsed: Record<string, unknown> = {};
            try {
              parsed = tc.jsonAcc ? JSON.parse(tc.jsonAcc) : {};
            } catch {
              parsed = { _raw: tc.jsonAcc };
            }
            toolCalls.push({ id: tc.id, name: tc.name, input: parsed });
            toolCallsInProgress.delete(idx);
            yield { type: 'tool-use-end', toolCallId: tc.id };
          }
        } else if (t === 'message_delta') {
          if (event.delta?.stop_reason) {
            const r = event.delta.stop_reason;
            if (r === 'end_turn' || r === 'tool_use' || r === 'max_tokens' || r === 'stop_sequence') {
              stopReason = r;
            }
          }
          if (event.usage?.output_tokens) outputTokens = event.usage.output_tokens;
        } else if (t === 'message_start') {
          if (event.message?.usage?.input_tokens) inputTokens = event.message.usage.input_tokens;
        }
      }
    }

    const final: LLMCompletionResponse = {
      text: cumulativeText,
      provider,
      model,
      latencyMs: Date.now() - startedAt,
      usage: { inputTokens, outputTokens },
      attempt: 1,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason,
    };
    yield { type: 'done', final };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}
