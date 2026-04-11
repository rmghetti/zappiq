import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import redis from '../utils/redis.js';
import * as waService from '../services/whatsappService.js';
import * as ragService from '../services/ragService.js';
import { chatCompletion, classify, type LLMMessage } from '../services/llm/langchainClient.js';
import { getSystemPrompt } from './promptEngine.js';
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
}

export async function processIncomingMessage(input: ProcessMessageInput): Promise<void> {
  const { organizationId, conversationId, contactId, contactPhone, contactName, messageContent, messageType, whatsappMessageId, orgSettings, io } = input;

  logger.info(`[Agent] Processing message from ${contactPhone}`, { organizationId, messageType });

  try {
    // ── 0. Mark message as read ─────────────────────────
    await waService.markAsRead(whatsappMessageId).catch(() => {});

    // ── 1. Check if AI is paused (handoff mode) ─────────
    const pauseKey = `ai_paused:${organizationId}:${contactPhone}`;
    const isPaused = await redis.get(pauseKey).catch(() => null);
    if (isPaused) {
      logger.info(`[Agent] AI paused for ${contactPhone}, skipping`);
      return;
    }

    // ── 2. Handle non-text messages ─────────────────────
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
    const intent = await classifyIntent(messageContent);
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
    const systemPrompt = getSystemPrompt({
      niche: orgSettings.niche || 'generic',
      agentName: orgSettings.agentName || 'Assistente',
      businessName: orgSettings.businessName || 'Empresa',
      tone: orgSettings.tone || 'friendly',
      businessHours: orgSettings.businessHours,
      ragContext,
      currentDateTime: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    });

    // ── 8. Build messages array ─────────────────────────
    const messages: LLMMessage[] = historyMessages.map((msg) => ({
      role: msg.direction === 'INBOUND' ? 'user' as const : 'assistant' as const,
      content: msg.content,
    }));
    messages.push({ role: 'user', content: messageContent });

    // ── 9. Call LLM ─────────────────────────────────────
    const llmResponse = await chatCompletion(systemPrompt, messages);

    // ── 10. Parse structured response ───────────────────
    const parsed = parseAgentResponse(llmResponse.text);

    // ── 11. Execute actions ─────────────────────────────
    if (parsed.action) {
      await executeAction(organizationId, contactId, contactPhone, parsed.action, parsed.actionData, io);
    }

    // ── 12. Send reply via WhatsApp ─────────────────────
    if (parsed.replyText) {
      if (parsed.buttons && parsed.buttons.length > 0) {
        await waService.sendButtons(contactPhone, null, parsed.replyText, parsed.buttons);
      } else {
        await waService.sendText(contactPhone, parsed.replyText);
      }

      // Save outbound message
      await prisma.message.create({
        data: {
          direction: 'OUTBOUND',
          type: 'TEXT',
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

// ── Intent Classification ───────────────────────────────
async function classifyIntent(text: string): Promise<string> {
  const cacheKey = `intent:${Buffer.from(text).toString('base64').slice(0, 32)}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return cached;
  } catch {}

  const prompt = `Classify this customer message into ONE of these intents:
scheduling | pricing | faq | complaint | purchase | request_human | greeting | followup | other

Message: "${text}"

Respond with ONLY the intent word, nothing else.`;

  const intent = await classify(prompt);

  try { await redis.setex(cacheKey, 300, intent); } catch {}

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

  const replyMatch = rawResponse.match(/<reply>([\s\S]*?)<\/reply>/i);
  result.replyText = replyMatch ? replyMatch[1].trim() : rawResponse.trim();

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

  return result;
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
  await redis.set(`ai_paused:${organizationId}:${contactPhone}`, '1', 'EX', 3600);

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
async function handleNonTextMessage(phone: string, msgType: string): Promise<void> {
  const responses: Record<string, string> = {
    audio: 'Recebi seu áudio! 🎙️ Para agilizar, você pode me enviar a mensagem em texto? Consigo te ajudar mais rápido assim 😊',
    image: 'Recebi sua imagem! 📷 Para que posso te ajudar hoje?',
    document: 'Recebi seu documento! 📄 Em breve um atendente irá analisá-lo. Posso te ajudar com algo mais?',
    video: 'Recebi seu vídeo! 🎥 Como posso te ajudar?',
    location: 'Recebemos sua localização! 📍 Um de nossos atendentes irá verificar.',
  };

  const reply = responses[msgType] || 'Recebi sua mensagem! Como posso te ajudar?';
  await waService.sendText(phone, reply);
}
