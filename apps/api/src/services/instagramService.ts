/**
 * Instagram Messaging Service — FASE 4 (#251)
 *
 * Outbound sender pra DMs via Meta Graph API. Espelha whatsappService.ts mas
 * com 2 diferenças críticas:
 *
 *   1. Multi-tenant: cada org tem seu próprio Page Access Token (60d, renovável).
 *      Funções recebem (accessToken, igAccountId) como parâmetros — não global.
 *   2. Payload shape: usa `recipient: { id: <IGSID> }` ao invés de `to: <phone>`.
 *      Não usa `messaging_product` (diferente do WhatsApp).
 *
 * Reference:
 *   https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message
 */

import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const GRAPH_VERSION = env.WHATSAPP_API_VERSION || 'v21.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

function clientFor(accessToken: string): AxiosInstance {
  const client = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 15_000,
  });
  client.interceptors.response.use(
    (res) => res,
    (err) => {
      logger.error('[IG] API error', {
        status: err.response?.status,
        error: err.response?.data?.error,
        url: err.config?.url,
      });
      throw err;
    },
  );
  return client;
}

export interface IgSendResult {
  recipient_id: string;
  message_id: string;
}

/**
 * Envia mensagem de texto via IG DM.
 *
 * @param igAccountId IG Business Account ID (ex: 17841...)
 * @param accessToken Page Access Token da Page linkada
 * @param recipientIgsid IGSID do destinatário (capturado quando ele te enviou DM)
 * @param text Conteúdo. Limite IG: ~1000 chars/mensagem (quebrar se exceder)
 */
export async function sendText(
  igAccountId: string,
  accessToken: string,
  recipientIgsid: string,
  text: string,
): Promise<IgSendResult> {
  // IG DM tem janela de 24h pós última mensagem do usuário. Fora dela só dá
  // pra mandar com tags MESSAGE_TAG=HUMAN_AGENT ou template (idem WhatsApp).
  // Pro caso da Iza/cliente respondendo, vamos sempre estar dentro da janela
  // de 24h. Adicionamos `messaging_type: 'RESPONSE'` que é o tipo padrão.
  const payload = {
    recipient: { id: recipientIgsid },
    message: { text },
    messaging_type: 'RESPONSE',
  };
  const client = clientFor(accessToken);
  const { data } = await client.post<IgSendResult>(
    `/${igAccountId}/messages`,
    payload,
  );
  logger.info(`[IG] Text sent`, {
    recipient: recipientIgsid,
    messageId: data.message_id,
  });
  return data;
}

/**
 * Envia mídia (imagem, áudio, vídeo) via URL pública.
 * IG aceita: image, video, audio. Diferente do WhatsApp, IG aceita URL direta
 * (não precisa upload prévio na Meta CDN).
 */
export async function sendMedia(
  igAccountId: string,
  accessToken: string,
  recipientIgsid: string,
  mediaType: 'image' | 'video' | 'audio',
  mediaUrl: string,
): Promise<IgSendResult> {
  const payload = {
    recipient: { id: recipientIgsid },
    message: {
      attachment: {
        type: mediaType,
        payload: { url: mediaUrl, is_reusable: false },
      },
    },
    messaging_type: 'RESPONSE',
  };
  const client = clientFor(accessToken);
  const { data } = await client.post<IgSendResult>(
    `/${igAccountId}/messages`,
    payload,
  );
  logger.info(`[IG] ${mediaType} sent`, {
    recipient: recipientIgsid,
    messageId: data.message_id,
  });
  return data;
}

/**
 * Marca "Seen" (visto) — equivalente ao markAsRead do WhatsApp.
 * Improves UX porque o usuário vê que o "agente" viu a mensagem.
 */
export async function markSeen(
  igAccountId: string,
  accessToken: string,
  recipientIgsid: string,
): Promise<void> {
  const payload = {
    recipient: { id: recipientIgsid },
    sender_action: 'mark_seen',
  };
  const client = clientFor(accessToken);
  await client.post(`/${igAccountId}/messages`, payload);
}

/**
 * Mostra indicador "digitando..." (typing_on) — UX igual app nativo IG.
 * Útil entre receber mensagem e responder (latência LLM ~1-3s).
 *
 * Tem que enviar typing_off OU mensagem real em até ~20s, senão para sozinho.
 */
export async function typingOn(
  igAccountId: string,
  accessToken: string,
  recipientIgsid: string,
): Promise<void> {
  const payload = {
    recipient: { id: recipientIgsid },
    sender_action: 'typing_on',
  };
  const client = clientFor(accessToken);
  await client.post(`/${igAccountId}/messages`, payload);
}

/**
 * Busca dados públicos do user (username, profile pic) usando IGSID.
 * IG REQUER permission `instagram_basic` ou `pages_messaging`.
 *
 * Útil pra popular Contact.name após primeira DM (no webhook só temos IGSID).
 * Chamada async (não blocking) — se falhar, contact fica com nome placeholder.
 */
export async function getUserProfile(
  accessToken: string,
  igsid: string,
): Promise<{ username?: string; name?: string; profile_pic?: string } | null> {
  try {
    const client = clientFor(accessToken);
    const { data } = await client.get(`/${igsid}`, {
      params: { fields: 'name,username,profile_pic' },
    });
    return data;
  } catch (err: any) {
    logger.warn('[IG] getUserProfile failed', {
      igsid,
      err: err.response?.data?.error?.message,
    });
    return null;
  }
}
