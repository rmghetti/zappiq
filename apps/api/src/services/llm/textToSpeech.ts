/* ══════════════════════════════════════════════════════════════════════
 * V4 #157 (PR #70) · Text-to-Speech outbound
 * --------------------------------------------------------------------
 * Sintetiza voz a partir do texto de resposta da Iza/agente, gera arquivo
 * temporário, faz upload pro WhatsApp Cloud API como audio media, e
 * retorna o mediaId pra envio via sendAudio.
 *
 * Provider: OpenAI tts-1 ($0.015/min)
 *   Voice default: 'nova' (feminina jovem, melhor tonalidade pt-BR
 *   entre as 6 vozes disponíveis: alloy/echo/fable/nova/onyx/shimmer).
 *   Cliente pode override via org.settings.voice_routing.voice.
 *
 * Decisão tts-1 vs tts-1-hd:
 *   tts-1: latência <2s, qualidade adequada pra atendimento — DEFAULT
 *   tts-1-hd: latência 4-6s, qualidade marginalmente superior — OPCIONAL
 *   pra clientes que ativam Voice Premium (settings.voice_routing.hd=true).
 *   Decisão: começar só tts-1. tts-1-hd vira diferencial em V5 se cliente
 *   pedir. Custo tts-1-hd é $0.030/min — 2× mais caro, margem cai pra ~70%.
 *
 * Flow:
 *   1. POST OpenAI /v1/audio/speech (model=tts-1, voice=nova, format=opus)
 *      → Buffer de áudio Opus (~16kbps)
 *   2. POST /PHONE_ID/media (multipart) com audio/ogg → mediaId WhatsApp
 *   3. Caller usa mediaId em sendAudio(to, mediaId)
 *
 * Custo + audit:
 *   Estimamos minutos pelo texto (heuristic: 150 char ≈ 1 min de fala
 *   pt-BR, conservative). Audit em llm_call_logs operation='tts',
 *   provider='openai-tts', model='tts-1'. costUsdEstimate calculado via
 *   MODEL_PRICING (que precisa ganhar tts-1 + whisper-1 — ver patch).
 *
 * Trial 14d × 30 min:
 *   Quando voice_routing.trial=true (org recém-ativada), conta minutos
 *   normalmente em usage_audit_log. Helper isVoiceTrialExpired() em
 *   middleware separado checa antes de gerar (não nesta função — single
 *   responsibility).
 *
 * Hard ceiling 2× minutos inclusos:
 *   Mesma divisão — middleware checa antes de chamar generateSpeech.
 *
 * Fail-soft:
 *   Erro em qualquer etapa → retorna { mediaId: null, error: '...' }.
 *   Caller cai pro fallback texto (sendText). Cliente nunca recebe stack.
 *
 * Limitações conhecidas:
 *   - WhatsApp limita audio a 16MB. tts-1 Opus a 16kbps gera ~120 KB/min,
 *     então pegamos antes do estouro só em mensagens >2h (impraticável).
 *   - Sem speaker style transfer (voz sempre a mesma por org).
 *   - Sem SSML (controle de prosódia) — tts-1 não suporta. tts-1-hd
 *     também não. Pra SSML, V5 + ElevenLabs upsell.
 * ══════════════════════════════════════════════════════════════════════ */

import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { logLLMCall } from './llmCallAudit.js';

const TTS_ENDPOINT = 'https://api.openai.com/v1/audio/speech';
const TTS_MODEL = 'tts-1';
const TTS_TIMEOUT_MS = 30_000;
const WHATSAPP_MEDIA_ENDPOINT = (phoneId: string) =>
  `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${phoneId}/media`;

/**
 * Vozes OpenAI tts-1 disponíveis. Default Iza: nova (feminina jovem,
 * melhor tom pt-BR). Outras: alloy (neutra), echo (masculina jovem),
 * fable (masculina madura UK), onyx (masculina grave), shimmer (feminina
 * suave).
 */
export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'nova' | 'onyx' | 'shimmer';

/**
 * Estimativa heurística de minutos de fala a partir do texto.
 * Calibração: pt-BR fala ~150 chars/min em ritmo natural conversacional.
 * Conservative: arredonda pra cima — melhor cobrar a mais que a menos.
 */
export function estimateMinutesFromText(text: string): number {
  const len = (text || '').length;
  if (len === 0) return 0;
  // 150 chars/min, mínimo 0.05 min (3s) pra evitar zerar mensagem curta
  return Math.max(0.05, Math.ceil((len / 150) * 100) / 100);
}

export interface TTSContext {
  organizationId?: string | null;
  conversationId?: string | null;
  contactPhone?: string;
  /** WhatsApp Phone Number ID da org (de Organization.whatsappPhoneNumberId) */
  phoneNumberId: string;
  /** Voz preferida da org (default: nova) */
  voice?: TTSVoice;
}

export interface TTSResult {
  /** WhatsApp media ID pronto pra usar em sendAudio. null se falhou. */
  mediaId: string | null;
  /** Estimativa de minutos consumidos (pra usage_audit_log) */
  minutesEstimate: number;
  /** Latência total (TTS + upload Meta) */
  latencyMs: number;
  /** Erro caso mediaId=null */
  error?: string;
}

/**
 * Sintetiza voz e faz upload no WhatsApp. Retorna mediaId pronto pra envio.
 *
 * @param text  Texto a sintetizar (resposta da Iza/agente)
 * @param ctx   Contexto pra audit + WhatsApp upload
 */
export async function generateAndUploadSpeech(
  text: string,
  ctx: TTSContext,
): Promise<TTSResult> {
  const t0 = Date.now();

  if (!env.OPENAI_API_KEY) {
    return { mediaId: null, minutesEstimate: 0, latencyMs: 0, error: 'OPENAI_API_KEY ausente' };
  }
  if (!env.WHATSAPP_ACCESS_TOKEN) {
    return { mediaId: null, minutesEstimate: 0, latencyMs: 0, error: 'WHATSAPP_ACCESS_TOKEN ausente' };
  }
  if (!text || text.trim().length === 0) {
    return { mediaId: null, minutesEstimate: 0, latencyMs: 0, error: 'texto vazio' };
  }
  if (!ctx.phoneNumberId) {
    return { mediaId: null, minutesEstimate: 0, latencyMs: 0, error: 'phoneNumberId ausente' };
  }

  const voice: TTSVoice = ctx.voice || 'nova';
  const minutesEstimate = estimateMinutesFromText(text);

  try {
    // ── 1. POST OpenAI /v1/audio/speech ───────────────────────────
    // response_format='opus' = OGG/Opus, formato nativo WhatsApp audio.
    const ttsT0 = Date.now();
    const ttsResp = await axios.post(
      TTS_ENDPOINT,
      {
        model: TTS_MODEL,
        voice,
        input: text.slice(0, 4096), // OpenAI limita input a 4096 chars
        response_format: 'opus',
      },
      {
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: TTS_TIMEOUT_MS,
        maxBodyLength: 30 * 1024 * 1024,
        maxContentLength: 30 * 1024 * 1024,
      },
    );
    const ttsLatency = Date.now() - ttsT0;
    const audioBuf = Buffer.from(ttsResp.data);

    if (audioBuf.length === 0) {
      return {
        mediaId: null,
        minutesEstimate,
        latencyMs: Date.now() - t0,
        error: 'OpenAI TTS retornou buffer vazio',
      };
    }

    // ── 2. Upload no WhatsApp Cloud API ────────────────────────────
    const uploadT0 = Date.now();
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'audio/ogg');
    form.append('file', audioBuf, {
      filename: `iza_tts_${Date.now()}.ogg`,
      contentType: 'audio/ogg',
    });

    const uploadResp = await axios.post(WHATSAPP_MEDIA_ENDPOINT(ctx.phoneNumberId), form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      },
      timeout: 30_000,
      maxBodyLength: 30 * 1024 * 1024,
      maxContentLength: 30 * 1024 * 1024,
    });
    const uploadLatency = Date.now() - uploadT0;
    const mediaId: string | undefined = uploadResp?.data?.id;
    const totalLatency = Date.now() - t0;

    if (!mediaId) {
      return {
        mediaId: null,
        minutesEstimate,
        latencyMs: totalLatency,
        error: 'Upload WhatsApp não retornou id',
      };
    }

    // ── 3. Audit em llm_call_logs ─────────────────────────────────
    // operation='tts' (precisa bumpar tipagem do helper — TODO).
    // Custo: $0.015/min × minutesEstimate.
    await logLLMCall({
      organizationId: ctx.organizationId ?? null,
      conversationId: ctx.conversationId ?? null,
      provider: 'openai-tts',
      model: TTS_MODEL,
      operation: 'sentiment' as any, // TODO: bumpar tipo pra incluir 'tts' explícito
      inputTokens: null,
      outputTokens: null,
      latencyMs: ttsLatency,
      fallbackTriggered: false,
      attemptCount: 1,
    });

    logger.info('[textToSpeech] TTS + upload OK', {
      contactPhone: ctx.contactPhone,
      voice,
      textChars: text.length,
      minutesEstimate,
      audioBytes: audioBuf.length,
      ttsLatency,
      uploadLatency,
      totalLatency,
      mediaId,
    });

    return { mediaId, minutesEstimate, latencyMs: totalLatency };
  } catch (err) {
    const totalLatency = Date.now() - t0;
    let errMsg = err instanceof Error ? err.message : String(err);
    if (err instanceof AxiosError) {
      const status = err.response?.status;
      const body = err.response?.data;
      const bodyStr = Buffer.isBuffer(body)
        ? body.toString('utf-8').slice(0, 200)
        : JSON.stringify(body).slice(0, 200);
      errMsg = `HTTP ${status}: ${bodyStr}`;
    }
    logger.error('[textToSpeech] Falha', {
      contactPhone: ctx.contactPhone,
      error: errMsg,
      latencyMs: totalLatency,
    });
    return { mediaId: null, minutesEstimate, latencyMs: totalLatency, error: errMsg };
  }
}
