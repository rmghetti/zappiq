import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

const router = Router();

// ── WhatsApp payload signature verification (X-Hub-Signature-256) ──
function verifyWhatsAppSignature(payload: string | Buffer, signature: string | undefined): boolean {
  if (!signature) return false;
  const appSecret = env.WHATSAPP_ACCESS_TOKEN;
  if (!appSecret) {
    logger.warn('[Webhook] WHATSAPP_ACCESS_TOKEN not set — cannot verify signatures');
    return false;
  }
  const expectedSig = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(typeof payload === 'string' ? payload : payload)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
}

// ── GET /api/webhook/whatsapp — Meta verification ──
router.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  if (mode === 'subscribe' && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    logger.info('[Webhook] WhatsApp webhook verified successfully');
    res.status(200).send(challenge);
    return;
  }

  logger.warn('[Webhook] WhatsApp verification failed', { mode, token });
  res.status(403).json({ error: 'Verification failed' });
});

// ── POST /api/webhook/whatsapp — Incoming messages ──
router.post('/whatsapp', async (req: Request, res: Response) => {
  // Verify Meta signature before processing
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const signature = req.headers['x-hub-signature-256'] as string | undefined;

  if (env.NODE_ENV === 'production' && !verifyWhatsAppSignature(rawBody, signature)) {
    logger.warn('[Webhook] Invalid WhatsApp signature — rejecting request');
    res.status(403).json({ error: 'Invalid signature' });
    return;
  }

  // Always respond 200 immediately (Meta expects fast response)
  res.status(200).json({ status: 'received' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) return;

    // Handle status updates
    if (value.statuses?.length) {
      for (const status of value.statuses) {
        await prisma.message.updateMany({
          where: { whatsappMessageId: status.id },
          data: { status: status.status?.toUpperCase() === 'READ' ? 'READ' : status.status?.toUpperCase() === 'DELIVERED' ? 'DELIVERED' : 'SENT' },
        });
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
    const content = message.text?.body || message.caption || `[${message.type}]`;

    await prisma.message.create({
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
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    logger.info(`[Webhook] Message saved for conversation ${conversation.id}`);

    // ── Trigger AI processing ───────────────────────
    // Import dynamically to avoid circular deps at startup
    const { processIncomingMessage } = await import('../agents/agentOrchestrator.js');
    const io = req.app.get('io');

    // Fire and forget — don't block the webhook response
    processIncomingMessage({
      organizationId: org.id,
      conversationId: conversation.id,
      contactId: contact.id,
      contactPhone: from,
      contactName,
      messageContent: content,
      messageType: message.type || 'text',
      whatsappMessageId: message.id,
      orgSettings: org.settings as any || {},
      io,
    }).catch((err: any) => logger.error('[Webhook] AI processing error:', err));

  } catch (err) {
    logger.error('[Webhook] Processing error:', err);
  }
});

export default router;
