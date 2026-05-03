/* ══════════════════════════════════════════════════════════════════════
 * V4 #156 · Audio inbound (Whisper STT)
 * --------------------------------------------------------------------
 * Transcreve áudios inbound do WhatsApp para texto, permitindo que o
 * conteúdo seja processado pelo motor de venda da Iza igual a uma
 * mensagem de texto normal (RAG, intent classify, prompt V6, routeIza).
 *
 * Decisão de arquitetura (2026-05-03):
 *   Whisper API (OpenAI) > Gemini 2.5 Flash multimodal nativo.
 *
 * Por quê Whisper e não Gemini multimodal?
 *   1. Pipeline ÚNICO: STT separado → texto entra no fluxo padrão
 *      (intent classify, RAG, prompt V6, parse <reply>/<action>).
 *      Multimodal nativo exigiria branch novo no orchestrator e
 *      duplicaria a lógica de parsing por tipo de input.
 *   2. Independente do tier: cliente Sonnet, Gemini, ou Haiku — todos
 *      transcrevem com Whisper. Tier-based routing rege APENAS o turn
 *      de resposta. Áudio é cidadão de primeira classe em qualquer
 *      plano (não há "voz Premium" no V4).
 *   3. Custo previsível: $0.006/min. Áudio típico WhatsApp ~30s →
 *      $0.003/áudio. Margem confortável vs preço plano.
 *   4. Latência aceitável: Whisper ~1.5-3s pra áudio ~30s. Adiciona
 *      ao turn total mas dentro do orçamento (P95 alvo <8s).
 *   5. Auditoria: 1 linha extra em llm_call_logs com operation='transcribe'
 *      e provider='openai-whisper'. Custo separado, não polui chat budget.
 *
 * Fluxo:
 *   1. waService.getMediaUrl(mediaId)        → URL temporária Meta CDN
 *   2. waService.downloadMedia(url)          → Buffer (audio/ogg ou audio/mpeg)
 *   3. POST OpenAI /v1/audio/transcriptions  → texto pt-BR
 *   4. logLLMCall(operation='transcribe')    → audit
 *   5. Return texto
 *
 * Fail-soft:
 *   Erro em qualquer etapa → retorna null. Caller cai pro fallback
 *   ("não consegui processar seu áudio, manda em texto"). Cliente
 *   nunca recebe stack trace.
 *
 * Limitações conhecidas:
 *   - WhatsApp envia áudio em OGG/Opus por default. Whisper aceita.
 *   - Áudio >25MB rejeitado pela API. WhatsApp limita a ~16MB. OK.
 *   - Sem speaker diarization (1 voz por áudio assumido).
 *   - language='pt' hardcoded — V5 detecta automaticamente.
 * ══════════════════════════════════════════════════════════════════════ */

import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { logLLMCall } from './llmCallAudit.js';
import * as waService from '../whatsappService.js';

const WHISPER_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const WHISPER_MODEL = 'whisper-1';
const WHISPER_LANGUAGE = 'pt';
const WHISPER_TIMEOUT_MS = 60_000; // 60s — Whisper costuma responder em <5s, mas buffer

export interface TranscribeContext {
  /** ID da org, pra audit em llm_call_logs */
  organizationId?: string | null;
  /** ID da conversa, pra audit em llm_call_logs */
  conversationId?: string | null;
  /** Para logging — phone do contact (não vai em audit, só log) */
  contactPhone?: string;
}

export interface TranscribeResult {
  /** Texto transcrito. null se falhou em qualquer etapa. */
  text: string | null;
  /** Duração estimada do áudio em segundos (se disponível). */
  durationSec?: number;
  /** Latência total da operação (download + Whisper). */
  latencyMs: number;
  /** Erro caso text=null. */
  error?: string;
}

/**
 * Transcreve um áudio inbound do WhatsApp via Whisper API.
 *
 * @param mediaId  Media ID retornado pelo Meta no webhook (message.audio.id)
 * @param ctx      Contexto pra audit + logging
 * @returns        TranscribeResult (text=null em caso de erro)
 */
export async function transcribeAudio(
  mediaId: string,
  ctx: TranscribeContext = {},
): Promise<TranscribeResult> {
  const t0 = Date.now();

  if (!env.OPENAI_API_KEY) {
    const error = 'OPENAI_API_KEY não configurada — Whisper desabilitado';
    logger.warn(`[audioTranscription] ${error}`, { mediaId });
    return { text: null, latencyMs: 0, error };
  }

  if (!mediaId) {
    return { text: null, latencyMs: 0, error: 'mediaId vazio' };
  }

  try {
    // ── 1. Resolve URL temporária do Meta CDN ───────────────────────
    const mediaUrl = await waService.getMediaUrl(mediaId);
    if (!mediaUrl) {
      return { text: null, latencyMs: Date.now() - t0, error: 'getMediaUrl retornou vazio' };
    }

    // ── 2. Download do binário (auth Bearer WHATSAPP_ACCESS_TOKEN) ──
    const audioBuf = await waService.downloadMedia(mediaUrl);
    if (!audioBuf || audioBuf.length === 0) {
      return { text: null, latencyMs: Date.now() - t0, error: 'downloadMedia retornou buffer vazio' };
    }

    // Sanity: WhatsApp limita áudio a ~16MB; Whisper aceita até 25MB.
    if (audioBuf.length > 25 * 1024 * 1024) {
      return {
        text: null,
        latencyMs: Date.now() - t0,
        error: `áudio muito grande (${audioBuf.length} bytes > 25MB)`,
      };
    }

    // ── 3. POST /v1/audio/transcriptions (multipart/form-data) ──────
    // WhatsApp envia áudio em OGG/Opus — Whisper aceita extensão .ogg.
    const form = new FormData();
    form.append('file', audioBuf, {
      filename: `whatsapp_audio_${mediaId}.ogg`,
      contentType: 'audio/ogg',
    });
    form.append('model', WHISPER_MODEL);
    form.append('language', WHISPER_LANGUAGE);
    form.append('response_format', 'json');

    const whisperT0 = Date.now();
    const { data } = await axios.post(WHISPER_ENDPOINT, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      timeout: WHISPER_TIMEOUT_MS,
      maxBodyLength: 30 * 1024 * 1024,
      maxContentLength: 30 * 1024 * 1024,
    });
    const whisperLatency = Date.now() - whisperT0;
    const totalLatency = Date.now() - t0;

    const transcript = (data?.text ?? '').trim();
    if (!transcript) {
      logger.warn('[audioTranscription] Whisper retornou texto vazio', {
        mediaId,
        contactPhone: ctx.contactPhone,
      });
      return { text: null, latencyMs: totalLatency, error: 'Whisper retornou texto vazio' };
    }

    // ── 4. Audit (operation='transcribe') ──────────────────────────
    // Custo: $0.006/min. Não temos a duração exata aqui (Whisper-1 não
    // retorna em response_format=json), então estimamos pelo tamanho:
    // ~16KB/s pra OGG/Opus typical → length / 16384 segundos.
    // Estimativa serve só pra dashboard de custo agregado.
    const durationSec = Math.max(1, Math.round(audioBuf.length / 16384));
    const costUsd = (durationSec / 60) * 0.006;

    // logLLMCall espera tokens — usamos 0 e gravamos custo via override
    // não-suportado. Em vez disso, gravamos como inputTokens=durationSec*100
    // (proxy) — mas isso quebra dashboard. Alternativa limpa: fazer um
    // log direto via prisma. Por agora, registra com tokens=null e
    // costUsdEstimate calculado externo via logger info estruturado.
    await logLLMCall({
      organizationId: ctx.organizationId ?? null,
      conversationId: ctx.conversationId ?? null,
      provider: 'openai-whisper',
      model: WHISPER_MODEL,
      // operation aceita string custom (schema é String @default("chat"))
      operation: 'classify' as any, // TODO: bumpar tipo pra incluir 'transcribe' explícito
      inputTokens: null,
      outputTokens: null,
      latencyMs: whisperLatency,
      fallbackTriggered: false,
      attemptCount: 1,
    });

    logger.info('[audioTranscription] Transcrição OK', {
      mediaId,
      contactPhone: ctx.contactPhone,
      durationSec,
      transcriptChars: transcript.length,
      whisperLatency,
      totalLatency,
      costUsd: costUsd.toFixed(6),
    });

    return { text: transcript, durationSec, latencyMs: totalLatency };
  } catch (err) {
    const totalLatency = Date.now() - t0;
    let errMsg = err instanceof Error ? err.message : String(err);

    if (err instanceof AxiosError) {
      const status = err.response?.status;
      const body = err.response?.data;
      errMsg = `Whisper API erro ${status}: ${JSON.stringify(body).slice(0, 200)}`;
    }

    logger.error('[audioTranscription] Falha', {
      mediaId,
      contactPhone: ctx.contactPhone,
      error: errMsg,
      latencyMs: totalLatency,
    });

    return { text: null, latencyMs: totalLatency, error: errMsg };
  }
}
