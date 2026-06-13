/**
 * Channel Dispatcher — FASE 4 (#251)
 *
 * Abstração thin pra rotear envio outbound entre canais (WhatsApp, Instagram,
 * web futuro). Permite que o agentOrchestrator continue chamando uma única
 * função independente do canal de origem da conversa.
 *
 * Política de roteamento:
 *   1. Se conversation.channel === 'instagram' → usa instagramService
 *   2. Default (incluindo 'whatsapp' e legados sem channel) → whatsappService
 *
 * Erros de configuração (org sem token IG, contato sem IGSID) propagam.
 * Caller (agentOrchestrator) já tem try/catch que loga e segue.
 */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import * as waService from './whatsappService.js';
import * as igService from './instagramService.js';

export interface SendReplyInput {
  organizationId: string;
  conversationId: string;
  /** Texto a enviar. */
  content: string;
}

export interface SendReplyResult {
  channel: 'whatsapp' | 'instagram';
  externalMessageId?: string;
}

/**
 * Envia mensagem de texto pelo canal correto da conversa.
 * Lê conversation.channel + dados de routing necessários (igAccountId, token,
 * IGSID) on-demand do DB pra não exigir que o caller carregue tudo.
 */
export async function sendReplyText(input: SendReplyInput): Promise<SendReplyResult> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    select: {
      channel: true,
      contact: {
        select: { whatsappId: true, instagramScopedId: true, phone: true },
      },
    },
  });

  if (!conversation) {
    throw new Error(`Conversation ${input.conversationId} not found`);
  }

  // ── Instagram path ──────────────────────────────────────────────
  if (conversation.channel === 'instagram') {
    const org = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: {
        instagramAccountId: true,
        instagramAccessToken: true,
      },
    });
    if (!org?.instagramAccountId || !org?.instagramAccessToken) {
      throw new Error(
        `Org ${input.organizationId} sem instagramAccountId/AccessToken configurado`,
      );
    }
    const igsid = conversation.contact?.instagramScopedId;
    if (!igsid) {
      throw new Error(
        `Contact da conversation ${input.conversationId} sem instagramScopedId — vir de DM IG?`,
      );
    }
    const result = await igService.sendText(
      org.instagramAccountId,
      org.instagramAccessToken,
      igsid,
      input.content,
    );
    logger.info('[Dispatcher] IG reply sent', {
      conversationId: input.conversationId,
      messageId: result.message_id,
    });
    return { channel: 'instagram', externalMessageId: result.message_id };
  }

  // ── WhatsApp path (default) ─────────────────────────────────────
  // contactPhone vem do whatsappId ou do phone field — historicamente são iguais.
  const phone = conversation.contact?.whatsappId || conversation.contact?.phone || '';
  if (!phone) {
    throw new Error(`Conversation ${input.conversationId} sem phone/whatsappId no contact`);
  }
  // Token por org (self-serve multi-tenant). Mesmo padrão do IG acima: carrega
  // as credenciais WA da org e passa pro send. Sem token próprio → whatsappService
  // cai no token global (Iza dogfood inalterada).
  const waOrg = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { whatsappPhoneNumberId: true, whatsappAccessToken: true },
  });
  const result = await waService.sendText(phone, input.content, false, {
    accessToken: waOrg?.whatsappAccessToken ?? undefined,
    phoneNumberId: waOrg?.whatsappPhoneNumberId ?? undefined,
  });
  return {
    channel: 'whatsapp',
    externalMessageId: result?.messages?.[0]?.id,
  };
}

/**
 * Marca a mensagem inbound como lida no canal de origem.
 * IG = sender_action 'mark_seen' (com IGSID, não com message ID).
 * WhatsApp = mark_as_read (com wamid).
 */
export async function markIncomingAsRead(input: {
  organizationId: string;
  conversationId: string;
  externalMessageId: string;
}): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    select: {
      channel: true,
      contact: { select: { instagramScopedId: true } },
    },
  });
  if (!conversation) return;

  if (conversation.channel === 'instagram') {
    const org = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { instagramAccountId: true, instagramAccessToken: true },
    });
    const igsid = conversation.contact?.instagramScopedId;
    if (!org?.instagramAccountId || !org.instagramAccessToken || !igsid) return;
    await igService.markSeen(org.instagramAccountId, org.instagramAccessToken, igsid).catch(() => {});
    return;
  }

  // WhatsApp default — token por org (fallback global pra Iza).
  const waOrg = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { whatsappPhoneNumberId: true, whatsappAccessToken: true },
  });
  await waService.markAsRead(input.externalMessageId, {
    accessToken: waOrg?.whatsappAccessToken ?? undefined,
    phoneNumberId: waOrg?.whatsappPhoneNumberId ?? undefined,
  }).catch(() => {});
}

/** Envia botões/lista pelo WhatsApp. IG não suporta interactive → fallback texto. */
export async function sendReplyInteractive(input: {
  organizationId: string;
  conversationId: string;
  kind: 'button' | 'list';
  body: string;
  options: { id: string; title: string }[];
}): Promise<SendReplyResult> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    select: { channel: true, contact: { select: { whatsappId: true, phone: true } } },
  });
  if (!conversation) throw new Error(`Conversation ${input.conversationId} not found`);

  // IG: degrada para texto (corpo + opções numeradas).
  if (conversation.channel === 'instagram') {
    const lines = [input.body, ...input.options.map((o, i) => `${i + 1}. ${o.title}`)].join('\n');
    return sendReplyText({ organizationId: input.organizationId, conversationId: input.conversationId, content: lines });
  }

  const phone = conversation.contact?.whatsappId || conversation.contact?.phone || '';
  if (!phone) throw new Error(`Conversation ${input.conversationId} sem phone/whatsappId`);
  const waOrg = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { whatsappPhoneNumberId: true, whatsappAccessToken: true },
  });
  const creds = { accessToken: waOrg?.whatsappAccessToken ?? undefined, phoneNumberId: waOrg?.whatsappPhoneNumberId ?? undefined };

  let result: any;
  if (input.kind === 'button') {
    result = await waService.sendButtons(phone, null, input.body, input.options.slice(0, 3), creds);
  } else {
    const rows = input.options.slice(0, 10).map((o) => ({ id: o.id, title: o.title }));
    result = await waService.sendList(phone, ' ', input.body, null, 'Ver opções', [{ title: ' ', rows }], creds);
  }
  return { channel: 'whatsapp', externalMessageId: result?.messages?.[0]?.id };
}

/** Envia mídia por link pelo WhatsApp. IG → fallback texto (caption + url). */
export async function sendReplyMedia(input: {
  organizationId: string;
  conversationId: string;
  mediaType: 'image' | 'audio' | 'document';
  url: string;
  caption?: string;
}): Promise<SendReplyResult> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    select: { channel: true, contact: { select: { whatsappId: true, phone: true } } },
  });
  if (!conversation) throw new Error(`Conversation ${input.conversationId} not found`);

  if (conversation.channel === 'instagram') {
    const txt = [input.caption, input.url].filter(Boolean).join('\n');
    return sendReplyText({ organizationId: input.organizationId, conversationId: input.conversationId, content: txt });
  }

  const phone = conversation.contact?.whatsappId || conversation.contact?.phone || '';
  if (!phone) throw new Error(`Conversation ${input.conversationId} sem phone/whatsappId`);
  const waOrg = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { whatsappPhoneNumberId: true, whatsappAccessToken: true },
  });
  const creds = { accessToken: waOrg?.whatsappAccessToken ?? undefined, phoneNumberId: waOrg?.whatsappPhoneNumberId ?? undefined };

  let result: any;
  if (input.mediaType === 'image') result = await waService.sendImage(phone, input.url, input.caption, creds);
  else if (input.mediaType === 'document') result = await waService.sendDocument(phone, input.url, input.caption, undefined, creds);
  else throw new Error(`sendReplyMedia: áudio por link não suportado (use mediaId)`); // áudio fica fora da 1A
  return { channel: 'whatsapp', externalMessageId: result?.messages?.[0]?.id };
}
