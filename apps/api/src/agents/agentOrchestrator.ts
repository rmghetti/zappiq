import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
// PR #V4-005.6: migrado de redis direto pra cache cloud-agnostic.
// cache.get/set/del são fail-soft por contrato — null/false em erro de backend.
import { cache } from '../services/cloud/index.js';
import * as waService from '../services/whatsappService.js';
// FASE 4 (#251): channel-aware dispatcher — roteia send pra WA ou IG conforme conversation.channel
import { sendReplyText, markIncomingAsRead } from '../services/channelDispatcher.js';
import * as ragService from '../services/ragService.js';
import { chatCompletion, classify, type LLMMessage, type LLMContext } from '../services/llm/langchainClient.js';
import { routeIzaTurn } from '../services/llm/izaTurnRouter.js';
import type { LLMTier, LLMProviderId } from '../services/llm/LLMRouter.js';
import { transcribeAudio } from '../services/llm/audioTranscription.js';
import { getSystemPrompt } from './promptEngine.js';
import { CORE_AGENT_RULES_V1 } from './coreAgentRules.js';
import type { Server as SocketIOServer } from 'socket.io';

export interface ProcessMessageInput {
  organizationId: string;
  conversationId: string;
  contactId: string;
  contactPhone: string;
  contactName: string;
  messageContent: string;
  messageType: string;
  whatsappMessageId: string;
  orgSettings: any;
  io?: SocketIOServer;
  /** V4 #156 — mediaId Meta CDN (presente quando type=audio/image/document/video) */
  mediaId?: string | null;
  /**
   * FASE 4 (#251) — canal de origem da mensagem.
   * Default 'whatsapp' pra retro compat. Quando 'instagram', orchestrator
   * roteia outbound via instagramService (channelDispatcher.sendReplyText).
   */
  channel?: 'whatsapp' | 'instagram' | 'web';
}

export async function processIncomingMessage(input: ProcessMessageInput): Promise<void> {
  const { organizationId, conversationId, contactId, contactPhone, contactName, whatsappMessageId, orgSettings, io, mediaId } = input;

  // V4 #156 — messageContent e messageType são mutáveis: áudio é transcrito via
  // Whisper e segue como texto pelo motor de venda padrão (RAG, intent, prompt).
  let messageContent = input.messageContent;
  let messageType = input.messageType;

  logger.info(`[Agent] Processing message from ${contactPhone}`, { organizationId, messageType });

  try {
    // ── 0. Mark message as read ─────────────────────────
    // FASE 4 (#251): channel-aware. Em IG, faz mark_seen via Graph API.
    await markIncomingAsRead({
      organizationId,
      conversationId,
      externalMessageId: whatsappMessageId,
    }).catch(() => {});

    // ── 0.5. AUTOREPLY MODE (Plano B pre-Go-Live) ───────
    // Quando IZA_AUTOREPLY_TEMPLATE estiver setado em env, responder
    // sempre o mesmo texto fixo e marcar contato como handoff (pausa AI
    // até Rodrigo destrabar manualmente). Garante zero hallucination
    // enquanto Iza nao esta GA. Remover env quando Iza estiver pronta.
    const autoReplyTemplate = process.env.IZA_AUTOREPLY_TEMPLATE;
    if (autoReplyTemplate) {
      logger.info(`[Agent] AUTOREPLY mode active for ${contactPhone}`);
      try {
        await waService.sendText(contactPhone, autoReplyTemplate);
        await prisma.message.create({
          data: {
            direction: 'OUTBOUND',
            type: 'TEXT',
            content: autoReplyTemplate,
            status: 'SENT',
            conversationId,
            isFromBot: true,
            aiConfidence: 1.0,
          },
        });
        // Pausa AI pra esse contato — proximas mensagens nao geram autoreply
        // de novo, ficam aguardando atendimento humano.
        const pauseKey = `ai_paused:${organizationId}:${contactPhone}`;
        // cache.set já é fail-soft (false em erro). Removido .catch redundante.
        await cache.set(pauseKey, 'autoreply', 60 * 60 * 24 * 7);
      } catch (err) {
        logger.error('[Agent] Autoreply send failed:', err);
      }
      return;
    }

    // ── 1. Check if AI is paused (handoff mode) ─────────
    // V4 patch (2026-05-01): pause keys com valor 'autoreply' são LEGACY do
    // Plan B (já removido). Quando Plan B foi desligado, pause keys ativas
    // continuaram bloqueando V4. Detecção + cleanup automático.
    const pauseKey = `ai_paused:${organizationId}:${contactPhone}`;
    const pauseValue = await cache.get(pauseKey);
    if (pauseValue) {
      if (pauseValue === 'autoreply') {
        // Legacy Plan B — limpa silenciosamente e segue
        logger.info(`[Agent] Limpando pause key legacy Plan B para ${contactPhone}`);
        await cache.del(pauseKey);
        // continua processamento normal abaixo
      } else {
        // Pause real (handoff humano ativo) — respeita
        logger.info(`[Agent] AI paused for ${contactPhone} (value=${pauseValue}), skipping`);
        return;
      }
    }

    // V4 #157 (PR #70) — flag pra TTS mirror: se input foi áudio, marcamos
    // pra responder com áudio também (caso voice_routing esteja habilitado
    // e dentro do quota). Default trigger é "mirror_input".
    const inputWasAudio = messageType === 'audio' && !!mediaId;

    // ── 2. Audio inbound: transcrever via Whisper e seguir como texto ──
    // V4 #156 — Whisper STT permite que cliente mande áudio e Iza processe
    // o conteúdo igual a uma mensagem de texto (RAG, intent, prompt V6).
    // V4 #157 (PR #70) — Se voice_routing habilitado, resposta volta como áudio.
    if (messageType === 'audio' && mediaId) {
      logger.info(`[Agent] Transcrevendo áudio inbound (mediaId=${mediaId}) de ${contactPhone}`);
      const transcribeResult = await transcribeAudio(mediaId, {
        organizationId,
        conversationId,
        contactPhone,
      });

      if (transcribeResult.text && transcribeResult.text.trim().length > 0) {
        // V4 #159 (PR #71 HOTFIX) — Persiste transcript SEM prefixo "[áudio
        // transcrito]". Antes salvávamos "[áudio transcrito] X" mas isso
        // contaminava o history que vai pro LLM: a Iza imitava colocando
        // "[áudio]" no início das respostas (e TTS sintetizava literalmente).
        //
        // Agora salvamos texto puro. O sinal "veio de áudio" fica em
        // mediaType='audio' (já preenchido pelo webhook) — uso estruturado,
        // não polui o conteúdo visível.
        try {
          await prisma.message.updateMany({
            where: { whatsappMessageId },
            data: { content: transcribeResult.text },
          });
        } catch (err) {
          logger.warn('[Agent] Falha ao persistir transcript no Message', { err });
        }

        // Reescreve content + type pra seguir o fluxo de texto normal
        messageContent = transcribeResult.text;
        messageType = 'text';
        logger.info(`[Agent] Transcrição OK (${transcribeResult.text.length} chars, ${transcribeResult.latencyMs}ms) — segue fluxo texto`);
        // Cai pra fluxo de texto abaixo (não return)
      } else {
        // Transcrição falhou — manda fallback educado (sem emojis)
        logger.warn(`[Agent] Transcrição falhou: ${transcribeResult.error || 'unknown'} — fallback texto`);
        await waService.sendText(
          contactPhone,
          'Não consegui processar seu áudio agora. Pode me mandar em texto?',
        );
        return;
      }
    }

    // ── 2.5. Handle outros não-textos (image, document, video, location) ─
    if (messageType !== 'text' && messageType !== 'button_reply' && messageType !== 'list_reply') {
      await handleNonTextMessage(contactPhone, messageType);
      return;
    }

    // ── 3. Load conversation history (last 20 turns) ────
    const historyMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { direction: true, content: true },
    });

    // ── 4. Classify intent ──────────────────────────────
    // V2-018: passa contexto pra audit por turn em llm_call_logs
    const llmCtx: LLMContext = { orgId: organizationId, conversationId };
    const intent = await classifyIntent(messageContent, llmCtx);
    logger.info(`[Agent] Intent: ${intent}`, { contactPhone, organizationId });

    // ── 5. Check for handoff request ────────────────────
    if (intent === 'request_human') {
      await handleHandoff(organizationId, contactPhone, contactId, orgSettings, io);
      return;
    }

    // ── 6. Retrieve RAG context ─────────────────────────
    let ragContext = '';
    try {
      ragContext = await ragService.search(organizationId, messageContent, 5);
    } catch (e: any) {
      logger.warn('[Agent] RAG unavailable:', e.message);
    }

    // ── 7. Build system prompt ──────────────────────────
    // V2-021 (Sprint 0): persona dual via Agent table.
    // - lead/trial (leadStatus in NEW/CONTACTED/QUALIFIED/UNQUALIFIED) → role='comercial'
    // - customer (leadStatus = CONVERTED)                              → role='suporte'
    // Fallback pro promptEngine antigo se Agent não existir (orgs sem seed).
    const systemPrompt = await buildSystemPromptForContact({
      organizationId,
      contactId,
      contactPhone, // V4 #157 (PR #70) — pra REGRA 9 do prompt V7
      orgSettings,
      ragContext,
    });

    // ── 8. Build history array (sem messageContent — routeIzaTurn adiciona) ───
    const history: LLMMessage[] = historyMessages.map((msg) => ({
      role: msg.direction === 'INBOUND' ? 'user' as const : 'assistant' as const,
      content: msg.content,
    }));

    // ── 9. V4 routing: pre-filter + classify + tier-based ─────
    // V4 #V4-001 + #143 (2026-04-30): routeIzaTurn aplica defesa em camadas:
    //   1. Pre-filter regex de verticais bloqueadas (apostas/cripto/MLM/porn) —
    //      retorna template estático SEM custo LLM
    //   2. Classify intent via Haiku — escala pra Sonnet em handoff/objection/
    //      enterprise mesmo em tiers Gemini
    //   3. Tier-based default — Starter/Growth=Gemini, Scale+=Sonnet
    //   4. Cascade fallback Sonnet→Haiku→OpenAI preservado (V3)
    // Per-org override via organizations.settings.llm_routing (#133):
    //   { forceProvider: "anthropic-sonnet" | ... } → bypassa tier-based
    //   { useDefaultCascade: true }                 → cascade default (Iza)
    const { tier, forceProvider } = await pickTierAndOverride(organizationId);
    const turnResult = await routeIzaTurn({
      systemPrompt,
      userMessage: messageContent,
      history,
      tier,
      forceProvider,
      orgId: organizationId,
      conversationId,
    });

    // ── 9.5. Vertical bloqueada — template estático, sem LLM ──────
    if (turnResult.kind === 'blocked') {
      logger.info(`[Agent] Vertical bloqueada: ${turnResult.vertical}`, {
        contactPhone,
        organizationId,
        snippet: turnResult.matchedSnippet,
      });
      // FASE 4 (#251): channel-aware. WhatsApp e Instagram convergem aqui.
      await sendReplyText({
        organizationId,
        conversationId,
        content: turnResult.response,
      });
      await prisma.message.create({
        data: {
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: turnResult.response,
          status: 'SENT',
          conversationId,
          isFromBot: true,
          aiConfidence: 1.0, // resposta determinística (regex match)
        },
      });
      return;
    }

    if (turnResult.escalated) {
      logger.info(`[Agent] Intent ${turnResult.intent} → escalou pra ${turnResult.response.provider}`, {
        contactPhone,
        organizationId,
      });
    }

    // ── 10. Parse structured response ───────────────────
    const llmResponse = { text: turnResult.response.text };
    const parsed = parseAgentResponse(llmResponse.text);

    // ── 11. Execute actions ─────────────────────────────
    if (parsed.action) {
      await executeAction(organizationId, contactId, contactPhone, parsed.action, parsed.actionData, io);
    }

    // ── 12. Send reply via WhatsApp ─────────────────────
    if (parsed.replyText) {
      // V4 #157 (PR #70) — Decide se resposta vai como áudio (TTS) ou texto.
      // Critérios pra responder por VOZ:
      //   1. Input foi áudio (trigger mirror_input) — default da Iza/clientes
      //   2. Org tem voice_routing.enabled = true em settings
      //   3. Buttons não estão presentes (botões precisam ser texto interativo)
      //   4. Texto < 4096 chars (limite OpenAI tts-1)
      //   5. (Futuro #PR70.1) — não excedeu quota mensal de minutos
      const voiceCfg = (orgSettings?.voice_routing || {}) as {
        enabled?: boolean;
        trigger?: 'mirror_input' | 'always' | 'off';
        voice?: 'alloy' | 'echo' | 'fable' | 'nova' | 'onyx' | 'shimmer';
      };
      const trigger = voiceCfg.trigger || 'mirror_input';
      // V4 #162 (PR #74 hotfix 2026-05-04) — Limite reduzido de 4096 → 800 chars.
      // Feedback usuário: respostas longas viraram áudio incompreensível
      // (TTS narrando tabela inteira de pricing) e cortavam por estouro de
      // limite TTS. Solução: respostas > 800 chars vão SEMPRE como texto,
      // mesmo se input foi áudio. Prompt V7.4 (REGRA 14) ensina a Iza a
      // proativamente dizer "vou te passar a tabela por texto" em vez de
      // tentar narrar tudo em áudio.
      const MAX_TTS_CHARS = 800;
      const wantVoiceReply =
        voiceCfg.enabled === true &&
        trigger !== 'off' &&
        (!parsed.buttons || parsed.buttons.length === 0) &&
        parsed.replyText.length <= MAX_TTS_CHARS &&
        (trigger === 'always' || (trigger === 'mirror_input' && inputWasAudio));

      if (
        voiceCfg.enabled === true &&
        inputWasAudio &&
        parsed.replyText.length > MAX_TTS_CHARS
      ) {
        logger.info('[Agent] Resposta > 800 chars — pulando TTS, enviando texto', {
          contactPhone, replyChars: parsed.replyText.length,
        });
      }

      let sentAsAudio = false;
      if (wantVoiceReply) {
        try {
          const phoneNumberId = (orgSettings?.whatsappPhoneNumberId
            || (await prisma.organization.findUnique({
                 where: { id: organizationId },
                 select: { whatsappPhoneNumberId: true },
               }))?.whatsappPhoneNumberId) as string | undefined;

          if (phoneNumberId) {
            const { generateAndUploadSpeech } = await import('../services/llm/textToSpeech.js');
            const ttsResult = await generateAndUploadSpeech(parsed.replyText, {
              organizationId,
              conversationId,
              contactPhone,
              phoneNumberId,
              voice: voiceCfg.voice,
            });
            if (ttsResult.mediaId) {
              await waService.sendAudio(contactPhone, ttsResult.mediaId);
              sentAsAudio = true;
              logger.info('[Agent] Resposta enviada como ÁUDIO (TTS)', {
                contactPhone, minutesEstimate: ttsResult.minutesEstimate,
              });
            } else {
              logger.warn('[Agent] TTS falhou, fallback texto', {
                contactPhone, error: ttsResult.error,
              });
            }
          }
        } catch (err) {
          logger.warn('[Agent] TTS exception, fallback texto', { err });
        }
      }

      // Fallback ou caminho normal: envia como texto
      if (!sentAsAudio) {
        if (parsed.buttons && parsed.buttons.length > 0) {
          await waService.sendButtons(contactPhone, null, parsed.replyText, parsed.buttons);
        } else {
          await waService.sendText(contactPhone, parsed.replyText);
        }
      }

      // Save outbound message
      await prisma.message.create({
        data: {
          direction: 'OUTBOUND',
          type: sentAsAudio ? 'AUDIO' as any : 'TEXT',
          content: parsed.replyText,
          status: 'SENT',
          conversationId,
          isFromBot: true,
          aiConfidence: parsed.action ? 0.9 : 0.95,
        },
      });
    }

    // ── 13. Real-time dashboard push ────────────────────
    if (io) {
      io.to(`org:${organizationId}`).emit('new_message', {
        conversationId,
        message: {
          content: parsed.replyText,
          direction: 'OUTBOUND',
          isFromBot: true,
          createdAt: new Date().toISOString(),
        },
      });
    }

  } catch (err) {
    logger.error('[Agent] Error processing message:', err);

    // Fallback message
    await waService.sendText(
      contactPhone,
      'Olá! Estou com uma dificuldade técnica momentânea. Em breve um atendente entrará em contato. Desculpe o inconveniente! 🙏'
    ).catch(() => {});
  }
}

// ── V4 #133 + #68 · Per-org LLM routing (lê organizations.settings.llm_routing) ──
// Schema esperado em org.settings.llm_routing (todos opcionais):
//   {
//     forceProvider?: 'anthropic-sonnet' | 'anthropic-haiku' | 'openai-mini' | 'google-gemini-flash'
//        // Bypassa tier completamente. ATENÇÃO: cascade pular fallback automático
//        // quando forceProvider está setado (LLMRouter.buildChain retorna [único provider]).
//        // Use só pra Enterprise customizado ou debug.
//     tierOverride?: 'STARTER' | 'GROWTH' | 'SCALE' | 'BUSINESS' | 'ENTERPRISE'
//        // PR #68: força tier específico mesmo se org.plan for diferente.
//        // Cascade COMPLETA preservada (fallback Sonnet→Haiku→OpenAI).
//        // Caso de uso: dogfood Iza com tier de cliente real (testar Gemini).
//     useDefaultCascade?: boolean
//        // true = ignora tier, usa Sonnet primário (vitrine Iza original).
//   }
// Prioridade: forceProvider > tierOverride > useDefaultCascade > tier-based padrão (org.plan).
// Sem settings.llm_routing → fallback pra tier-based via org.plan.
// Sem org → fallback pra cascade default (Sonnet primário).
const VALID_TIERS: LLMTier[] = ['STARTER', 'GROWTH', 'SCALE', 'BUSINESS', 'ENTERPRISE'];

async function pickTierAndOverride(orgId: string): Promise<{
  tier?: LLMTier;
  forceProvider?: LLMProviderId;
}> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true, settings: true },
    });
    if (!org) return {};

    // Per-org override (#133 + #68)
    const settings = (org.settings as any) ?? {};
    const llmRouting = settings.llm_routing;
    if (llmRouting && typeof llmRouting === 'object') {
      // 1. forceProvider (mais alta prioridade — Enterprise customizado, sem fallback)
      if (typeof llmRouting.forceProvider === 'string') {
        return { forceProvider: llmRouting.forceProvider as LLMProviderId };
      }
      // 2. tierOverride (#68 — força tier específico, cascade completa preservada)
      if (typeof llmRouting.tierOverride === 'string'
          && VALID_TIERS.includes(llmRouting.tierOverride as LLMTier)) {
        return { tier: llmRouting.tierOverride as LLMTier };
      }
      // 3. useDefaultCascade (Iza vitrine original — Sonnet primário)
      if (llmRouting.useDefaultCascade === true) {
        return {};
      }
    }

    // 4. Tier-based padrão (#V4-001) — derivado de org.plan
    if (VALID_TIERS.includes(org.plan as LLMTier)) {
      return { tier: org.plan as LLMTier };
    }
    return {};
  } catch (err: any) {
    logger.warn(`[Agent] pickTierAndOverride failed: ${err.message} — fallback default cascade`, { orgId });
    return {};
  }
}

// ── Intent Classification ───────────────────────────────
async function classifyIntent(text: string, ctx?: LLMContext): Promise<string> {
  const cacheKey = `intent:${Buffer.from(text).toString('base64').slice(0, 32)}`;

  // cache.get é fail-soft (null em erro). Sem try/catch defensivo.
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  // V4 #156 (2026-05-03) — calibração conservadora pra request_human.
  // Bug observado smoke test 03/05: cliente perguntou "responde por voz?"
  // (técnica) e classify retornou request_human → disparou handoff
  // indevido. Agora request_human EXIGE keyword explícita.
  const prompt = `Classify the LAST customer message into ONE intent.
Categories: scheduling | pricing | faq | complaint | purchase | request_human | greeting | followup | other

REGRA CRÍTICA pra request_human:
  Só classifique como request_human se a mensagem EXPLICITAMENTE pede falar com humano usando frases como:
  - "quero falar com gente"
  - "não quero bot"
  - "prefiro humano"
  - "humano por favor"
  - "fale com alguém aí"
  - "atendente"
  - "pessoa real"

Pergunta TÉCNICA do cliente (ex: "responde por voz?", "tem integração com X?",
"qual a diferença pra Y?", "como funciona Z?") NÃO é request_human — classifique
como faq.

Pergunta de PREÇO/PLANO (ex: "quanto custa?", "qual plano cabe pra mim?")
classifique como pricing.

Saudação simples (ex: "oi", "olá", "bom dia") classifique como greeting.

Em DÚVIDA, nunca classifique como request_human — use other ou faq.

Customer message: "${text}"

Respond with ONLY the intent word, nothing else.`;

  // V2-018: classify usa Haiku 4.5 forçado via LLMRouter (com fallback automático
  // pra cascade completa se Haiku cair). Audit por turn em llm_call_logs.
  const intent = await classify(prompt, ctx);

  // cache.set é fail-soft (false em erro). TTL idêntico (300s = 5min).
  await cache.set(cacheKey, intent, 300);

  return intent;
}

// ── Parse Structured Response ───────────────────────────
interface ParsedResponse {
  replyText: string | null;
  action: string | null;
  actionData: any;
  buttons: Array<{ id: string; title: string }> | null;
}

function parseAgentResponse(rawResponse: string): ParsedResponse {
  const result: ParsedResponse = { replyText: null, action: null, actionData: null, buttons: null };

  // Extract structured tags first
  const actionMatch = rawResponse.match(/<action>(.*?)<\/action>/i);
  if (actionMatch) result.action = actionMatch[1].trim();

  const dataMatch = rawResponse.match(/<action_data>([\s\S]*?)<\/action_data>/i);
  if (dataMatch) {
    try { result.actionData = JSON.parse(dataMatch[1].trim()); } catch {}
  }

  const btnMatch = rawResponse.match(/<buttons>([\s\S]*?)<\/buttons>/i);
  if (btnMatch) {
    try { result.buttons = JSON.parse(btnMatch[1].trim()); } catch {}
  }

  // V4 #159 (PR #71 HOTFIX 2026-05-03) — Strip TODAS tags estruturadas do
  // replyText antes de retornar. Bug detectado em smoke real: Iza emitia
  // "<action>set_contact_name</action><action_data>{...}</action_data>texto"
  // e o texto inteiro (com tags) ia pro WhatsApp porque o regex <reply>…</reply>
  // não batia. Cliente recebia tags raw no chat.
  //
  // Strategy: se houver <reply>…</reply> usa esse conteúdo. Caso contrário,
  // usa rawResponse mas REMOVE todas as tags conhecidas + prefixos vazados
  // do PR #69 (ex: "[áudio]" / "[áudio transcrito]" no INÍCIO da resposta —
  // a Iza imitava do history corrompido).
  const replyMatch = rawResponse.match(/<reply>([\s\S]*?)<\/reply>/i);
  let candidate = replyMatch ? replyMatch[1].trim() : rawResponse.trim();
  candidate = stripStructuredTags(candidate);
  candidate = stripLeakedPrefixes(candidate);
  result.replyText = candidate;

  return result;
}

/**
 * V4 #159 (PR #71 HOTFIX) — Remove tags estruturadas que escaparam pra
 * dentro do replyText. Cobre: <action>, <action_data>, <buttons>, <reply>
 * (open/close, e self-closing por garantia). Case-insensitive. Multi-line.
 */
export function stripStructuredTags(text: string): string {
  if (!text) return text;
  return text
    .replace(/<action_data>[\s\S]*?<\/action_data>/gi, '')
    .replace(/<action>[\s\S]*?<\/action>/gi, '')
    .replace(/<buttons>[\s\S]*?<\/buttons>/gi, '')
    .replace(/<\/?reply>/gi, '')
    // Tags solitárias remanescentes (ex: <action> sem fechamento por bug LLM)
    .replace(/<\/?(action|action_data|buttons|reply)\b[^>]*>/gi, '')
    .trim();
}

/**
 * V4 #159 (PR #71 HOTFIX) — Remove prefixos vazados do PR #69.
 * Quando audio inbound era transcrito, salvávamos "[áudio transcrito] X"
 * no Message.content. Esse texto entrava no history e a Iza, vendo o padrão,
 * imitava em respostas (ex: "[áudio] Oi, Rodrigo!"). TTS sintetizava
 * literalmente "abre colchete áudio fecha colchete".
 *
 * Esta função remove SOMENTE no INÍCIO do texto (não no meio — alguém pode
 * legitimamente discutir áudios em geral). Conservador.
 */
export function stripLeakedPrefixes(text: string): string {
  if (!text) return text;
  // Remove "[áudio]", "[audio]", "[áudio transcrito]", "[texto]", "[transcrito]"
  // no início, com possíveis espaços. Case-insensitive.
  return text
    .replace(/^\s*\[(áudio|audio|áudio transcrito|audio transcrito|texto|transcrito)\]\s*/i, '')
    .trim();
}

// ── Execute Actions ─────────────────────────────────────
async function executeAction(
  organizationId: string,
  contactId: string,
  contactPhone: string,
  action: string,
  actionData: any,
  io?: SocketIOServer
): Promise<void> {
  logger.info(`[Agent] Executing action: ${action}`, { organizationId, contactPhone });

  try {
    switch (action) {
      case 'schedule':
        if (io) {
          io.to(`org:${organizationId}`).emit('notification', {
            type: 'info',
            title: 'Novo agendamento solicitado',
            message: `Cliente ${contactPhone} quer agendar`,
          });
        }
        break;

      case 'handoff':
        await handleHandoff(organizationId, contactPhone, contactId, {}, io);
        break;

      case 'save_lead':
        await prisma.contact.update({
          where: { id: contactId },
          data: { leadStatus: 'QUALIFIED', leadScore: { increment: 20 } },
        });
        if (io) {
          io.to(`org:${organizationId}`).emit('notification', {
            type: 'success',
            title: 'Lead qualificado!',
            message: `${contactPhone} foi qualificado automaticamente pela IA`,
          });
        }
        break;

      // V4 #157 (PR #70) — Iza captura ou atualiza o nome preferido do cliente
      // Trigger pelo prompt V7 REGRA 9 quando: (a) primeiro contato sem nome
      // no profile WhatsApp, (b) cliente pediu pra ser chamado de forma
      // diferente ("me chama de X", "prefiro Y", "pode me chamar X").
      // actionData esperado: { name: string }
      case 'set_contact_name': {
        const newName = (actionData?.name || '').toString().trim().slice(0, 80);
        if (!newName) {
          logger.warn('[Agent] set_contact_name sem name no actionData', { contactPhone });
          break;
        }
        await prisma.contact.update({
          where: { id: contactId },
          data: { name: newName },
        });
        logger.info(`[Agent] Contact name atualizado: "${newName}"`, { contactPhone });
        break;
      }

      default:
        logger.warn(`[Agent] Unknown action: ${action}`);
    }
  } catch (err) {
    logger.error('[Agent] Action execution error:', err);
  }
}

// ── Handoff to Human ────────────────────────────────────
async function handleHandoff(
  organizationId: string,
  contactPhone: string,
  contactId: string,
  orgSettings: any,
  io?: SocketIOServer
): Promise<void> {
  logger.info(`[Agent] Handoff triggered for ${contactPhone}`, { organizationId });

  // Pause AI for 1 hour
  await cache.set(`ai_paused:${organizationId}:${contactPhone}`, '1', 3600);

  // Update conversation status
  await prisma.conversation.updateMany({
    where: { contactId, organizationId, status: { in: ['OPEN', 'ASSIGNED'] } },
    data: { status: 'WAITING' },
  });

  // Notify agents
  if (io) {
    io.to(`org:${organizationId}`).emit('notification', {
      type: 'warning',
      title: 'Transbordo solicitado',
      message: `Cliente ${contactPhone} precisa de atendimento humano`,
    });
  }

  // Send holding message
  const holdMsg = orgSettings?.handoffMessage ||
    'Vou te conectar com um de nossos especialistas agora. Em instantes você será atendido! 😊';
  await waService.sendText(contactPhone, holdMsg);
}

// ── Handle Non-Text Messages ────────────────────────────
// V4 #156 (2026-05-03): emojis 🎙️ 📷 📄 🎥 📍 e tom V3 ("Como posso te
// ajudar?") removidos. Agora alinhado com REGRA 4 (anti-padrões) do
// prompt V6 da Iza. Áudio NÃO cai mais aqui — é interceptado em
// processIncomingMessage (etapa 2) e transcrito via Whisper.
async function handleNonTextMessage(phone: string, msgType: string): Promise<void> {
  const responses: Record<string, string> = {
    // audio nunca chega aqui em prod (Whisper trata antes), mas mantém fallback
    // pra caso mediaId esteja vazio ou OPENAI_API_KEY desconfigurada.
    audio: 'Não consegui processar seu áudio agora. Pode me mandar em texto?',
    image: 'Recebi sua imagem. Me conta em texto o que você precisa que eu já te ajudo.',
    document: 'Recebi seu documento. Me diz em texto o que você precisa resolver.',
    video: 'Recebi seu vídeo. Me conta em texto o que você precisa.',
    location: 'Recebi sua localização. Me diz em texto como posso ajudar.',
  };

  const reply = responses[msgType] || 'Recebi sua mensagem. Me conta em texto o que você precisa.';
  await waService.sendText(phone, reply);
}

// ═══════════════════════════════════════════════════════════════════
// V2-021 (Sprint 0 §11.3) · Persona dual via Agent table
// ─────────────────────────────────────────────────────────────────
// Decisão de persona:
//   - leadStatus in [NEW, CONTACTED, QUALIFIED, UNQUALIFIED] → comercial
//   - leadStatus = CONVERTED                                  → suporte
//
// Carrega Agent.systemPrompt do DB se existir (seedado em V2-021 migration).
// Se não existir (ex.: org criada antes da migration ou seed falhou),
// faz fallback pro promptEngine antigo — preserva back-compat.
// ═══════════════════════════════════════════════════════════════════
async function buildSystemPromptForContact(input: {
  organizationId: string;
  contactId: string;
  contactPhone?: string;
  orgSettings: any;
  ragContext: string;
}): Promise<string> {
  const { organizationId, contactId, contactPhone, orgSettings, ragContext } = input;

  // V4 #157 (PR #70) — Lookup completo do Contact pra injetar nome no prompt.
  // Antes: lookup só pegava leadStatus → Iza não sabia o nome → sempre
  // perguntava ou ficava genérica. Agora puxa name + leadStatus + history count
  // pra REGRA 9 do prompt V7 ter contexto suficiente.
  let role: 'comercial' | 'suporte' = 'comercial';
  let contactName: string | null = null;
  let leadStatus: string = 'NEW';
  let messageCount = 0;
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        leadStatus: true,
        name: true,
        _count: { select: { conversations: { where: {} } } },
      },
    });
    if (contact) {
      contactName = (contact.name || '').trim() || null;
      leadStatus = contact.leadStatus || 'NEW';
      if (contact.leadStatus === 'CONVERTED') role = 'suporte';
    }
    // Conta mensagens reais do contato (mais útil que conversation count)
    if (contact) {
      messageCount = await prisma.message.count({
        where: { conversation: { contactId } },
      });
    }
  } catch (err) {
    logger.warn('[Agent] buildSystemPromptForContact: lookup contact falhou — assumindo comercial', { err });
  }

  // V4 #157 — bloco "# Cliente atual" injetado SEMPRE antes do RAG.
  // Iza usa isso pra cumprir REGRA 9 (use o nome desde o "oi" se já tem).
  const isFirstContact = messageCount <= 1; // 1 = a mensagem inbound atual
  const clienteBlock = [
    '# Cliente atual',
    contactName
      ? `Nome registrado: ${contactName}`
      : 'Nome registrado: (ainda não capturado — peça no primeiro turno conforme REGRA 9)',
    contactPhone ? `Telefone: ${contactPhone}` : '',
    `Status do lead: ${leadStatus}`,
    `Mensagens trocadas até agora: ${messageCount}`,
    `Primeiro contato? ${isFirstContact ? 'SIM' : 'NÃO (já tem histórico — não pergunte nome de novo, use o que está acima)'}`,
  ].filter(Boolean).join('\n');

  // 2. Tentar carregar Agent live correspondente
  try {
    const agent = await prisma.agent.findFirst({
      where: { organizationId, role, status: 'live' },
      select: { systemPrompt: true, name: true },
      orderBy: { createdAt: 'desc' }, // se houver múltiplos, pega o mais recente
    });
    if (agent?.systemPrompt) {
      // V4 task #234 (2026-05-13): Universal Core Rules V1 prependado.
      // Cliente customiza agent.systemPrompt livremente, mas comportamento
      // crítico (purchase_intent, handoff, anti-padrões, dados sensíveis)
      // é IMUTÁVEL. Reduz risco de bug silencioso em agentes de clientes
      // externos que não saberiam reportar gap de calibração.
      const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      return [
        CORE_AGENT_RULES_V1,
        agent.systemPrompt,
        '',
        clienteBlock,
        '',
        `# Contexto recuperado (RAG)`,
        ragContext || '(sem contexto relevante encontrado para esta query)',
        '',
        `# Agora`,
        now,
      ].join('\n');
    }
  } catch (err) {
    logger.warn('[Agent] buildSystemPromptForContact: lookup agent falhou — fallback promptEngine', { err });
  }

  // 3. Fallback (orgs sem seed): CORE rules + promptEngine antigo + cliente block.
  // CORE rules são SEMPRE prependadas independente do path (DB ou promptEngine).
  const fallback = getSystemPrompt({
    niche: orgSettings.niche || 'generic',
    agentName: orgSettings.agentName || 'Assistente',
    businessName: orgSettings.businessName || 'Empresa',
    tone: orgSettings.tone || 'friendly',
    businessHours: orgSettings.businessHours,
    ragContext,
    currentDateTime: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
  });
  return `${CORE_AGENT_RULES_V1}${fallback}\n\n${clienteBlock}`;
}
