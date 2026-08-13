import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { aiProcessQueue } from '../services/queueService.js';
import { inboundContentFromMessage } from '../services/inboundContent.js';
import { applyMessageStatusUpdate, attributeCampaignReply } from './campaignStatus.util.js';
import { recordCtwaAttribution } from '../services/ctwaAttribution.js';
import { isValidOrgWebhookVerifyToken } from '../services/webhookVerifyToken.js';

const router = Router();

// ── WhatsApp payload signature verification (X-Hub-Signature-256) ──
// Meta assina os payloads de webhook com o APP SECRET (Settings > Basic do
// Meta App), NAO com o WhatsApp Access Token. Sao credenciais distintas.
//
// Self-serve multi-tenant: cada cliente pode usar o app Meta DELE, que assina
// com o app secret DELE. Por isso resolvemos a org pelo phone_number_id do
// payload e verificamos contra org.metaAppSecret; se a org nao tem (Iza /
// cliente sob o app da ZappIQ), cai no META_APP_SECRET global.
function verifyWhatsAppSignature(payload: string | Buffer, signature: string | undefined, appSecret: string): boolean {
  if (!signature || !appSecret) return false;
  const expectedSig = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  // timingSafeEqual lanca se buffers tiverem tamanhos diferentes.
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

// Resolve o secret de assinatura pro payload: app secret DA ORG (dona do
// phone_number_id) com fallback pro global. Parse e lookup ANTES do verify —
// usamos o payload nao-verificado SO pra escolher a chave; o verify de fato
// valida a assinatura. Fail-soft: qualquer erro cai no global.
async function resolveWaSigningSecret(rawBody: Buffer): Promise<string> {
  const globalSecret = env.META_APP_SECRET || env.WHATSAPP_ACCESS_TOKEN || '';
  try {
    const body = JSON.parse(rawBody.toString('utf8'));
    const phoneNumberId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    if (!phoneNumberId) return globalSecret;
    const org = await prisma.organization.findFirst({
      where: { whatsappPhoneNumberId: phoneNumberId },
      select: { metaAppSecret: true } as any,
    });
    return ((org as any)?.metaAppSecret as string) || globalSecret;
  } catch {
    return globalSecret;
  }
}

// ── GET /api/webhook/whatsapp — Meta verification ──
router.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  // Aceita o token global (retrocompat) OU o token derivado por org
  // (zpq1.<orgId>.<hmac> — mostrado em Configurações → Canais → Webhook).
  const valid = token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || isValidOrgWebhookVerifyToken(token);
  if (mode === 'subscribe' && valid) {
    logger.info('[Webhook] WhatsApp webhook verified successfully');
    res.status(200).send(challenge);
    return;
  }

  logger.warn('[Webhook] WhatsApp verification failed', { mode, token });
  res.status(403).json({ error: 'Verification failed' });
});

// ── POST /api/webhook/whatsapp — Incoming messages ──
router.post('/whatsapp', async (req: Request, res: Response) => {
  // req.body chega como Buffer porque mountamos express.raw em server.ts.
  // Verify Meta signature before processing — usar bytes brutos.
  const rawBody: Buffer = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  const signature = req.headers['x-hub-signature-256'] as string | undefined;

  if (env.NODE_ENV === 'production') {
    const signingSecret = await resolveWaSigningSecret(rawBody);
    if (!verifyWhatsAppSignature(rawBody, signature, signingSecret)) {
      logger.warn('[Webhook] Invalid WhatsApp signature — rejecting request');
      res.status(403).json({ error: 'Invalid signature' });
      return;
    }
  }

  // Always respond 200 immediately (Meta expects fast response)
  res.status(200).json({ status: 'received' });

  try {
    const body = JSON.parse(rawBody.toString('utf8'));

    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) return;

    // Handle status updates
    // W2.4: além de gravar o status na Message, propaga delivered/read para os
    // contadores da Campanha quando a mensagem pertence a uma (campaignId). A
    // transição é monotônica (SENT→DELIVERED→READ), então só contamos na
    // PRIMEIRA vez que a mensagem cruza cada patamar — Meta reenvia status e
    // não podemos contar em dobro.
    if (value.statuses?.length) {
      for (const status of value.statuses) {
        await applyMessageStatusUpdate(prisma, status);
      }
      return;
    }

    // Handle incoming messages
    const message = value.messages?.[0];
    if (!message) return;

    const phoneNumberId = value.metadata?.phone_number_id;
    const from = message.from;
    const contactName = value.contacts?.[0]?.profile?.name || from;

    logger.info(`[Webhook] Message from ${from}: ${message.type}`, { phoneNumberId });

    // Find organization by WhatsApp phone number ID
    const org = await prisma.organization.findFirst({
      where: { whatsappPhoneNumberId: phoneNumberId },
    });

    if (!org) {
      logger.warn(`[Webhook] No org found for phone_number_id: ${phoneNumberId}`);
      return;
    }

    // Upsert contact
    const contact = await prisma.contact.upsert({
      where: {
        whatsappId_organizationId: {
          whatsappId: from,
          organizationId: org.id,
        },
      },
      update: {
        name: contactName,
        lastInteractionAt: new Date(),
      },
      create: {
        whatsappId: from,
        phone: from,
        name: contactName,
        organizationId: org.id,
        leadStatus: 'NEW',
        lastInteractionAt: new Date(),
      },
    });

    // Loop de Receita: se a mensagem veio de anúncio (CTWA), captura o ctwa_clid
    // para depois devolver a conversão de compra ao Meta (CAPI). Não bloqueia.
    await recordCtwaAttribution({ organizationId: org.id, contactId: contact.id, referral: (message as any).referral });

    // Find or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        contactId: contact.id,
        organizationId: org.id,
        status: { in: ['OPEN', 'WAITING', 'ASSIGNED'] },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          contactId: contact.id,
          organizationId: org.id,
          status: 'OPEN',
          channel: 'whatsapp',
        },
      });
    }

    // Save incoming message
    const content = inboundContentFromMessage(message);

    const inboundMsg = await prisma.message.create({
      data: {
        whatsappMessageId: message.id,
        direction: 'INBOUND',
        type: (message.type?.toUpperCase() as any) || 'TEXT',
        content,
        status: 'DELIVERED',
        conversationId: conversation.id,
        isFromBot: false,
        mediaUrl: message.image?.id || message.audio?.id || message.document?.id || null,
        mediaType: message.type !== 'text' ? message.type : null,
      },
      select: { id: true },
    });

    // W2.4: se este INBOUND é a primeira resposta a uma campanha, conta reply.
    // Best-effort — nunca derruba o webhook.
    try {
      await attributeCampaignReply(prisma, conversation.id, inboundMsg.id, contact.id);
    } catch (err) {
      logger.warn(`[Webhook] falha ao atribuir reply de campanha: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    logger.info(`[Webhook] Message saved for conversation ${conversation.id}`);

    // ── V2-023 (Sprint 0 Blocker 2): enfileira processamento LLM em BullMQ ──
    // ANTES: chamava processIncomingMessage inline (fire-and-forget no event
    // loop). Pico de mensagens estourava memória do Fly.
    // DEPOIS: webhook só enfileira; worker ai-process consome com retry
    // estruturado (3x exponential backoff) + deadletter automático.
    //
    // Persistência (org/contact/conversation/message) FICA síncrona no
    // webhook — é I/O DB rápido (~50-100ms) e garante que a mensagem é
    // gravada mesmo se o worker estiver atrás (não perdemos).
    //
    // Job payload: só IDs + minimal context. Worker reload via Prisma se
    // precisar mais. Mantém payload leve no Redis.
    await aiProcessQueue.add('process-incoming', {
      organizationId: org.id,
      conversationId: conversation.id,
      contactId: contact.id,
      contactPhone: from,
      contactName,
      messageContent: content,
      messageType: message.type || 'text',
      whatsappMessageId: message.id,
      orgSettings: (org.settings as any) || {},
      // V4 #156 — mediaId pra Whisper STT em áudio inbound
      mediaId: message.image?.id || message.audio?.id || message.document?.id || message.video?.id || null,
      // io não é serializável — worker reemite via app.get('io') após processar
    }, {
      // Cada job ganha jobId único pra dedupe (idempotência via whatsappMessageId)
      jobId: `wamid_${message.id}`,
    });

    logger.info(`[Webhook] AI job enqueued for conversation ${conversation.id} (wamid: ${message.id})`);

  } catch (err) {
    logger.error('[Webhook] Processing error:', err);
  }
});

export default router;
