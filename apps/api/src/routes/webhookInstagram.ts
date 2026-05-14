/**
 * /api/webhook/instagram — FASE 4 (#251) Instagram Direct Messaging
 *
 * Espelha estrutura de routes/webhook.ts (WhatsApp Cloud API), porque ambos
 * passam pelo mesmo Meta Graph API e usam mesma assinatura HMAC.
 *
 * Differences vs WhatsApp:
 *   • Endpoint: /api/webhook/instagram (Meta App subscription separada)
 *   • Org lookup: por Organization.instagramAccountId (vs whatsappPhoneNumberId)
 *   • Contact lookup: por instagramScopedId (IGSID, vs whatsappId)
 *   • Conversation.channel = 'instagram' (vs 'whatsapp')
 *   • Message.externalMessageId = msg.id (vs whatsappMessageId)
 *   • Job channel='instagram' pra worker rotear envio outbound certo
 *
 * MESMO usados:
 *   • verifyMetaSignature (HMAC sha256 com META_APP_SECRET)
 *   • aiProcessQueue (mesma fila — agentOrchestrator é channel-agnostic)
 *   • Contact, Conversation, Message tables (mesmos schemas)
 *
 * Webhook payload reference:
 * https://developers.facebook.com/docs/messenger-platform/instagram/features/webhook
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { aiProcessQueue } from '../services/queueService.js';

const router = Router();

// ── HMAC signature verification (mesma lógica do WhatsApp) ──
// Meta usa o MESMO APP SECRET pra assinar webhooks de WhatsApp e Instagram
// (porque o "subscription" mora no mesmo Meta App). Logo, reusamos.
function verifyMetaSignature(payload: string | Buffer, signature: string | undefined): boolean {
  if (!signature) return false;
  const appSecret = env.META_APP_SECRET || env.WHATSAPP_ACCESS_TOKEN;
  if (!appSecret) {
    logger.warn('[WebhookIG] META_APP_SECRET not set — cannot verify, rejecting POST');
    return false;
  }
  const expectedSig =
    'sha256=' +
    crypto.createHmac('sha256', appSecret).update(payload).digest('hex');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

// ── GET /api/webhook/instagram — Meta verification ──
// Mesma lógica de verify_token do WhatsApp. Pode reusar
// WHATSAPP_WEBHOOK_VERIFY_TOKEN ou ter um separado pro IG (recomendado).
router.get('/instagram', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  // FASE 4: aceita IG_WEBHOOK_VERIFY_TOKEN dedicado OU fallback pro do WhatsApp
  // (algumas configs Meta usam o mesmo token pros 2 webhooks).
  const expected = env.IG_WEBHOOK_VERIFY_TOKEN || env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (mode === 'subscribe' && token === expected) {
    logger.info('[WebhookIG] Instagram webhook verified successfully');
    res.status(200).send(challenge);
    return;
  }
  logger.warn('[WebhookIG] Instagram verification failed', { mode, token });
  res.status(403).json({ error: 'Verification failed' });
});

// ── POST /api/webhook/instagram — Incoming DMs + status ──
router.post('/instagram', async (req: Request, res: Response) => {
  const rawBody: Buffer = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  const signature = req.headers['x-hub-signature-256'] as string | undefined;

  if (env.NODE_ENV === 'production' && !verifyMetaSignature(rawBody, signature)) {
    logger.warn('[WebhookIG] Invalid Instagram signature — rejecting');
    res.status(403).json({ error: 'Invalid signature' });
    return;
  }

  // Always 200 immediately (Meta retry agressivamente em delays)
  res.status(200).json({ status: 'received' });

  try {
    const body = JSON.parse(rawBody.toString('utf8'));

    // IG webhook payload shape (object="instagram"):
    // { object: 'instagram', entry: [{ id: <ig_business_account_id>, time, messaging: [...] }] }
    if (body?.object !== 'instagram') {
      logger.warn('[WebhookIG] Payload object != instagram', { object: body?.object });
      return;
    }

    for (const entry of body.entry || []) {
      const igAccountId: string | undefined = entry.id;
      const messagingArray: any[] = entry.messaging || [];

      if (!igAccountId || messagingArray.length === 0) continue;

      // Find org by Instagram Business Account ID
      const org = await prisma.organization.findFirst({
        where: { instagramAccountId: igAccountId },
      });

      if (!org) {
        logger.warn(`[WebhookIG] No org for instagramAccountId: ${igAccountId}`);
        continue;
      }

      for (const event of messagingArray) {
        // Status callbacks (delivery, read) — atualizam Message.status existente
        if (event.delivery || event.read) {
          await handleStatusCallback(event);
          continue;
        }

        // Echo: mensagem que NÓS enviamos via API. Ignora pra não loopar
        // o agente respondendo a si mesmo. Já gravamos outbound no DB
        // quando enviamos (em sendInstagramMessage).
        if (event.message?.is_echo) continue;

        // Inbound: DM real do usuário
        if (event.message) {
          await handleIncomingMessage(org.id, event);
        }
      }
    }
  } catch (err) {
    logger.error('[WebhookIG] Processing error:', err);
  }
});

// ── handleIncomingMessage — espelha lógica do WhatsApp ──
async function handleIncomingMessage(orgId: string, event: any): Promise<void> {
  // event shape:
  // {
  //   sender: { id: '<igsid>' },     ← IGSID do usuário (estável por org)
  //   recipient: { id: '<ig_business_id>' },
  //   timestamp,
  //   message: { mid: '<msg_id>', text?, attachments? }
  // }
  const igsid = event.sender?.id;
  const messageId = event.message?.mid;
  if (!igsid || !messageId) {
    logger.warn('[WebhookIG] Missing igsid or mid', { event });
    return;
  }

  // Dedup: mesma mensagem reentregue pela Meta? Já temos no DB?
  const existing = await prisma.message.findUnique({
    where: { externalMessageId: messageId },
    select: { id: true },
  });
  if (existing) {
    logger.info(`[WebhookIG] Message ${messageId} already processed, skipping dedup`);
    return;
  }

  // Conteúdo: texto direto OU descrição de attachment
  let content = event.message?.text;
  let messageType: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' = 'TEXT';
  let mediaUrl: string | null = null;
  let mediaType: string | null = null;

  if (!content && event.message?.attachments?.length) {
    const att = event.message.attachments[0];
    mediaUrl = att.payload?.url || null;
    mediaType = att.type || 'unknown';
    if (att.type === 'image') messageType = 'IMAGE';
    else if (att.type === 'audio') messageType = 'AUDIO';
    else if (att.type === 'video') messageType = 'VIDEO';
    else messageType = 'DOCUMENT';
    content = `[${att.type}]`; // placeholder; worker pode transcrever áudio depois
  }
  content = content || '[mídia sem conteúdo extraível]';

  // Upsert contact por (instagramScopedId, organizationId)
  const contact = await prisma.contact.upsert({
    where: {
      instagramScopedId_organizationId: {
        instagramScopedId: igsid,
        organizationId: orgId,
      },
    },
    update: {
      lastInteractionAt: new Date(),
    },
    create: {
      // IG não nos dá phone do usuário — gravamos um placeholder reconhecível
      // (whatsappId é required na schema, então usamos um identificador IG).
      whatsappId: `ig:${igsid}`,
      phone: `ig:${igsid}`,
      instagramScopedId: igsid,
      name: null, // Username só vem se a gente chamar Graph API; pode buscar async depois
      organizationId: orgId,
      leadStatus: 'NEW',
      lastInteractionAt: new Date(),
    },
  });

  // Find or create conversation (channel='instagram')
  let conversation = await prisma.conversation.findFirst({
    where: {
      contactId: contact.id,
      organizationId: orgId,
      channel: 'instagram',
      status: { in: ['OPEN', 'WAITING', 'ASSIGNED'] },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        contactId: contact.id,
        organizationId: orgId,
        status: 'OPEN',
        channel: 'instagram',
      },
    });
  }

  // Save inbound message
  await prisma.message.create({
    data: {
      externalMessageId: messageId,
      direction: 'INBOUND',
      type: messageType,
      content,
      status: 'DELIVERED',
      conversationId: conversation.id,
      isFromBot: false,
      mediaUrl,
      mediaType,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  logger.info(`[WebhookIG] Message ${messageId} saved for conversation ${conversation.id}`);

  // Enfileira processamento LLM (mesma fila — worker é channel-agnostic)
  await aiProcessQueue.add(
    'process-incoming',
    {
      organizationId: orgId,
      conversationId: conversation.id,
      contactId: contact.id,
      contactPhone: `ig:${igsid}`, // pra logs/audit
      contactName: contact.name || `IG ${igsid.slice(-6)}`,
      messageContent: content,
      messageType: messageType.toLowerCase(),
      // FASE 4: distingue canal pro worker rotear envio outbound
      channel: 'instagram',
      instagramScopedId: igsid,
      // Preenche externalMessageId em vez de whatsappMessageId
      externalMessageId: messageId,
      orgSettings: {},
      mediaId: mediaUrl, // IG já entrega URL direta (não ID como WA)
    },
    {
      jobId: `igmsg_${messageId}`, // dedup BullMQ
    },
  );

  logger.info(`[WebhookIG] AI job enqueued for conversation ${conversation.id} (mid: ${messageId})`);
}

// ── handleStatusCallback — atualiza Message.status quando Meta confirma ──
async function handleStatusCallback(event: any): Promise<void> {
  // event shape para read/delivery:
  // { sender: {id}, recipient: {id}, timestamp, delivery: { mids: [...] } }
  // OU: { ..., read: { mid: '...' } } (apenas mid único)
  const mids: string[] = [];
  if (event.delivery?.mids?.length) mids.push(...event.delivery.mids);
  if (event.read?.mid) mids.push(event.read.mid);

  if (mids.length === 0) return;

  const newStatus = event.read ? 'READ' : 'DELIVERED';
  await prisma.message.updateMany({
    where: { externalMessageId: { in: mids } },
    data: { status: newStatus as any },
  });

  logger.debug(`[WebhookIG] Status updated for ${mids.length} messages → ${newStatus}`);
}

export default router;
