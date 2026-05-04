/* ══════════════════════════════════════════════════════════════════════
 * V4 #160 (PR #72) · Text-to-Speech outbound — Google Neural2 pt-BR + OpenAI fallback
 * --------------------------------------------------------------------
 * Sintetiza voz a partir do texto de resposta da Iza/agente, gera arquivo
 * temporário, faz upload pro WhatsApp Cloud API como audio media, e
 * retorna o mediaId pra envio via sendAudio.
 *
 * MUDANÇA vs PR #70:
 *   - Provider PRIMÁRIO: Google Cloud TTS Neural2 pt-BR ($0.000016/char ≈ $0.0024/min)
 *   - Provider FALLBACK: OpenAI tts-1 ($0.015/min) — só dispara se Google falhar
 *   - Razão: voz natural pt-BR (sem sotaque "gringo") + 84% redução de custo
 *
 * Vozes Google pt-BR Neural2 disponíveis:
 *   pt-BR-Neural2-A — feminina madura
 *   pt-BR-Neural2-B — masculina madura
 *   pt-BR-Neural2-C — feminina jovem (DEFAULT — mapeada do antigo "nova")
 *
 * Mapeamento legacy → novo (orgs que tinham settings.voice_routing.voice
 * setado pra voz OpenAI continuam funcionando):
 *   nova    → pt-BR-Neural2-C (feminina jovem)
 *   shimmer → pt-BR-Neural2-A (feminina madura)
 *   alloy   → pt-BR-Neural2-A (neutra → feminina madura)
 *   echo    → pt-BR-Neural2-B (masculina jovem → masculina)
 *   onyx    → pt-BR-Neural2-B (masculina grave → masculina)
 *   fable   → pt-BR-Neural2-B (masculina UK → masculina)
 *
 * Flow:
 *   1. POST Google TTS /v1/text:synthesize (voice pt-BR-Neural2-C, format OGG_OPUS)
 *      → audioContent base64 → Buffer
 *   2. Se falhar, fallback OpenAI tts-1 (mesmo flow do PR #70)
 *   3. POST /PHONE_ID/media (multipart) com audio/ogg → mediaId WhatsApp
 *   4. Caller usa mediaId em sendAudio(to, mediaId)
 *
 * Audit em llm_call_logs:
 *   provider='google-tts' (primário) ou 'openai-tts' (fallback)
 *   model='pt-BR-Neural2-C' ou 'tts-1'
 *
 * Auth:
 *   Google: usa GOOGLE_APPLICATION_CREDENTIALS_JSON (mesmo que Gemini)
 *   OpenAI: OPENAI_API_KEY
 *
 * Fail-soft:
 *   Google falha → tenta OpenAI → ambos falham → retorna mediaId=null,
 *   caller cai pro sendText.
 * ══════════════════════════════════════════════════════════════════════ */

import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { logLLMCall } from './llmCallAudit.js';

// ── Google TTS ──────────────────────────────────────────────────────
const GOOGLE_TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const GOOGLE_DEFAULT_VOICE = 'pt-BR-Neural2-C'; // feminina jovem

// ── OpenAI TTS (fallback) ──────────────────────────────────────────
const OPENAI_TTS_ENDPOINT = 'https://api.openai.com/v1/audio/speech';
const OPENAI_TTS_MODEL = 'tts-1';
const OPENAI_DEFAULT_VOICE: OpenAITTSVoice = 'nova';

const TTS_TIMEOUT_MS = 30_000;
const WHATSAPP_MEDIA_ENDPOINT = (phoneId: string) =>
  `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${phoneId}/media`;

/**
 * Vozes Google pt-BR Neural2 + WaveNet disponíveis (nativas em pt-BR).
 * Default Iza: pt-BR-Neural2-C (feminina jovem, melhor tom conversacional).
 */
export type GoogleTTSVoice =
  | 'pt-BR-Neural2-A' // feminina madura
  | 'pt-BR-Neural2-B' // masculina madura
  | 'pt-BR-Neural2-C' // feminina jovem
  | 'pt-BR-Wavenet-A' | 'pt-BR-Wavenet-B' | 'pt-BR-Wavenet-C' | 'pt-BR-Wavenet-D' | 'pt-BR-Wavenet-E';

export type OpenAITTSVoice = 'alloy' | 'echo' | 'fable' | 'nova' | 'onyx' | 'shimmer';
export type TTSVoice = GoogleTTSVoice | OpenAITTSVoice;

/**
 * Mapeia voz legacy OpenAI → equivalente Google pt-BR.
 * Garante back-compat de orgs que tinham settings.voice_routing.voice='nova'
 * antes do PR #72.
 */
function mapToGoogleVoice(voice: string | undefined): GoogleTTSVoice {
  if (!voice) return GOOGLE_DEFAULT_VOICE;
  // Se já é voz Google, retorna direto
  if (voice.startsWith('pt-BR-')) return voice as GoogleTTSVoice;
  // Mapeamento OpenAI legacy → Google
  const map: Record<string, GoogleTTSVoice> = {
    nova: 'pt-BR-Neural2-C',
    shimmer: 'pt-BR-Neural2-A',
    alloy: 'pt-BR-Neural2-A',
    echo: 'pt-BR-Neural2-B',
    onyx: 'pt-BR-Neural2-B',
    fable: 'pt-BR-Neural2-B',
  };
  return map[voice] || GOOGLE_DEFAULT_VOICE;
}

/**
 * Estimativa heurística de minutos de fala a partir do texto INPUT.
 *
 * ⚠️ CALIBRAÇÃO CRÍTICA — NÃO MEXER SEM RECONFIRMAR PRICING.
 *
 * Esta função é usada em DUAS contas distintas:
 *   1. CUSTO Google TTS (cobrado por chars de input): R$ 0,06/min @ 750 chars/min
 *      Fórmula: chars × $0.000016 = USD; × 5 (USD/BRL) = BRL
 *   2. COBRANÇA do cliente (por minutos de áudio gerados): tabela em planConfig
 *
 * Heurística pt-BR: ~750 chars/min de áudio gerado em ritmo conversacional.
 *   - 150 wpm × 5 chars/palavra + espaços = ~900 chars/min faladas
 *   - −15-20% de pausas naturais entre frases
 *   - = ~750 chars/min (conservador, favorável ao cliente)
 *
 * HISTÓRICO DE BUG (2026-05-04): inicialmente assumi 150 chars/min (5x errado),
 * o que gerou subestimativa de custo de 5x e Stripe Prices em PREJUÍZO em 3
 * dos 6 pacotes do PR #72 v2. Corrigido pra 750 chars/min antes de qualquer
 * venda (v3 atual).
 */
export function estimateMinutesFromText(text: string): number {
  const len = (text || '').length;
  if (len === 0) return 0;
  // 750 chars/min — calibração validada após bug de 2026-05-04
  return Math.max(0.05, Math.ceil((len / 750) * 100) / 100);
}

export interface TTSContext {
  organizationId?: string | null;
  conversationId?: string | null;
  contactPhone?: string;
  /** WhatsApp Phone Number ID da org */
  phoneNumberId: string;
  /** Voz preferida da org (default: pt-BR-Neural2-C) */
  voice?: TTSVoice;
}

export interface TTSResult {
  /** WhatsApp media ID pronto pra usar em sendAudio. null se falhou. */
  mediaId: string | null;
  /** Estimativa de minutos consumidos */
  minutesEstimate: number;
  /** Latência total */
  latencyMs: number;
  /** Provider usado pra síntese (google-tts | openai-tts | none) */
  providerUsed?: 'google-tts' | 'openai-tts' | 'none';
  /** Erro caso mediaId=null */
  error?: string;
}

/**
 * Tenta sintetizar via Google Cloud TTS.
 * Retorna Buffer ou null em caso de falha (caller decide fallback).
 */
async function synthesizeGoogle(
  text: string,
  voice: GoogleTTSVoice,
): Promise<{ buffer: Buffer | null; latencyMs: number; error?: string }> {
  const t0 = Date.now();

  const apiKey = process.env.GOOGLE_API_KEY || env.GOOGLE_API_KEY;
  if (!apiKey) {
    return {
      buffer: null,
      latencyMs: 0,
      error: 'GOOGLE_API_KEY ausente — pular pra fallback OpenAI',
    };
  }

  try {
    const { data } = await axios.post(
      `${GOOGLE_TTS_ENDPOINT}?key=${apiKey}`,
      {
        input: { text: text.slice(0, 5000) }, // Google limita a 5000 chars/request
        voice: { languageCode: 'pt-BR', name: voice },
        audioConfig: {
          audioEncoding: 'OGG_OPUS', // formato nativo WhatsApp
          sampleRateHertz: 16000, // suficiente pra voz, reduz tamanho
          // V4 #162 (PR #74 hotfix 2026-05-04) — feedback usuário: voz default
          // (1.0) está rápida demais pra entender em pt-BR conversacional.
          // 0.92 = 8% mais devagar — mais natural pra ouvido brasileiro,
          // ainda dentro do range que o Google considera "natural".
          // Range válido: 0.25-4.0. Mexer só se feedback de usuário mudar.
          speakingRate: 0.92,
          // pitch default (0.0) já é adequado pra Neural2-C feminina jovem.
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: TTS_TIMEOUT_MS,
        maxBodyLength: 30 * 1024 * 1024,
        maxContentLength: 30 * 1024 * 1024,
      },
    );

    const audioBase64: string | undefined = data?.audioContent;
    if (!audioBase64) {
      return { buffer: null, latencyMs: Date.now() - t0, error: 'Google TTS retornou audioContent vazio' };
    }
    const buffer = Buffer.from(audioBase64, 'base64');
    return { buffer, latencyMs: Date.now() - t0 };
  } catch (err) {
    let errMsg = err instanceof Error ? err.message : String(err);
    if (err instanceof AxiosError) {
      const status = err.response?.status;
      const body = err.response?.data;
      const bodyStr = JSON.stringify(body).slice(0, 200);
      errMsg = `Google TTS HTTP ${status}: ${bodyStr}`;
    }
    return { buffer: null, latencyMs: Date.now() - t0, error: errMsg };
  }
}

/**
 * Tenta sintetizar via OpenAI tts-1 (fallback).
 */
async function synthesizeOpenAI(
  text: string,
  voice: OpenAITTSVoice,
): Promise<{ buffer: Buffer | null; latencyMs: number; error?: string }> {
  const t0 = Date.now();

  if (!env.OPENAI_API_KEY) {
    return { buffer: null, latencyMs: 0, error: 'OPENAI_API_KEY ausente' };
  }

  try {
    const ttsResp = await axios.post(
      OPENAI_TTS_ENDPOINT,
      {
        model: OPENAI_TTS_MODEL,
        voice,
        input: text.slice(0, 4096),
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
    const buffer = Buffer.from(ttsResp.data);
    return { buffer, latencyMs: Date.now() - t0 };
  } catch (err) {
    let errMsg = err instanceof Error ? err.message : String(err);
    if (err instanceof AxiosError) {
      const status = err.response?.status;
      errMsg = `OpenAI TTS HTTP ${status}`;
    }
    return { buffer: null, latencyMs: Date.now() - t0, error: errMsg };
  }
}

/**
 * Faz upload do audio Buffer no WhatsApp Cloud API e retorna mediaId.
 */
async function uploadToWhatsApp(audioBuf: Buffer, phoneNumberId: string): Promise<string | null> {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'audio/ogg');
  form.append('file', audioBuf, {
    filename: `iza_tts_${Date.now()}.ogg`,
    contentType: 'audio/ogg',
  });

  const uploadResp = await axios.post(WHATSAPP_MEDIA_ENDPOINT(phoneNumberId), form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
    },
    timeout: 30_000,
    maxBodyLength: 30 * 1024 * 1024,
    maxContentLength: 30 * 1024 * 1024,
  });
  return uploadResp?.data?.id ?? null;
}

/**
 * Sintetiza voz e faz upload no WhatsApp. Retorna mediaId pronto pra envio.
 *
 * Flow: Google primário → OpenAI fallback → uploadWhatsApp
 *
 * @param text  Texto a sintetizar
 * @param ctx   Contexto pra audit + WhatsApp upload
 */
export async function generateAndUploadSpeech(
  text: string,
  ctx: TTSContext,
): Promise<TTSResult> {
  const t0 = Date.now();

  if (!text || text.trim().length === 0) {
    return { mediaId: null, minutesEstimate: 0, latencyMs: 0, error: 'texto vazio', providerUsed: 'none' };
  }
  if (!ctx.phoneNumberId) {
    return { mediaId: null, minutesEstimate: 0, latencyMs: 0, error: 'phoneNumberId ausente', providerUsed: 'none' };
  }

  const minutesEstimate = estimateMinutesFromText(text);
  const googleVoice = mapToGoogleVoice(ctx.voice);

  // ── 1. Tentativa primária: Google Cloud TTS pt-BR ──
  let synthBuffer: Buffer | null = null;
  let synthLatency = 0;
  let providerUsed: 'google-tts' | 'openai-tts' | 'none' = 'none';
  let model = '';
  let lastError: string | undefined;

  const googleResult = await synthesizeGoogle(text, googleVoice);
  if (googleResult.buffer) {
    synthBuffer = googleResult.buffer;
    synthLatency = googleResult.latencyMs;
    providerUsed = 'google-tts';
    model = googleVoice;
  } else {
    lastError = googleResult.error;
    logger.warn('[textToSpeech] Google TTS falhou, tentando fallback OpenAI', {
      error: googleResult.error,
      contactPhone: ctx.contactPhone,
    });

    // ── 2. Fallback: OpenAI tts-1 ──
    const openaiResult = await synthesizeOpenAI(text, OPENAI_DEFAULT_VOICE);
    if (openaiResult.buffer) {
      synthBuffer = openaiResult.buffer;
      synthLatency = googleResult.latencyMs + openaiResult.latencyMs;
      providerUsed = 'openai-tts';
      model = OPENAI_TTS_MODEL;
    } else {
      lastError = `Google: ${googleResult.error} | OpenAI: ${openaiResult.error}`;
    }
  }

  if (!synthBuffer) {
    return {
      mediaId: null,
      minutesEstimate,
      latencyMs: Date.now() - t0,
      error: lastError || 'Ambos providers falharam',
      providerUsed: 'none',
    };
  }

  if (synthBuffer.length === 0) {
    return {
      mediaId: null,
      minutesEstimate,
      latencyMs: Date.now() - t0,
      error: `${providerUsed} retornou buffer vazio`,
      providerUsed,
    };
  }

  // ── 3. Upload no WhatsApp ──
  let mediaId: string | null = null;
  try {
    mediaId = await uploadToWhatsApp(synthBuffer, ctx.phoneNumberId);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      mediaId: null,
      minutesEstimate,
      latencyMs: Date.now() - t0,
      error: `WhatsApp upload falhou: ${errMsg}`,
      providerUsed,
    };
  }

  const totalLatency = Date.now() - t0;

  if (!mediaId) {
    return { mediaId: null, minutesEstimate, latencyMs: totalLatency, error: 'WhatsApp upload sem id', providerUsed };
  }

  // ── 4. Audit em llm_call_logs ──
  await logLLMCall({
    organizationId: ctx.organizationId ?? null,
    conversationId: ctx.conversationId ?? null,
    provider: providerUsed,
    model,
    operation: 'sentiment' as any, // TODO bumpar enum pra incluir 'tts' explícito
    inputTokens: null,
    outputTokens: null,
    latencyMs: synthLatency,
    fallbackTriggered: providerUsed === 'openai-tts',
    attemptCount: providerUsed === 'openai-tts' ? 2 : 1,
  });

  logger.info('[textToSpeech] Síntese + upload OK', {
    contactPhone: ctx.contactPhone,
    providerUsed,
    voice: model,
    textChars: text.length,
    minutesEstimate,
    audioBytes: synthBuffer.length,
    synthLatency,
    totalLatency,
    mediaId,
  });

  return { mediaId, minutesEstimate, latencyMs: totalLatency, providerUsed };
}
