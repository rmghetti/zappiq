import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const BASE_URL = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}`;

function createClient(): AxiosInstance {
  const client = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN || ''}`,
      'Content-Type': 'application/json',
    },
    timeout: 15_000,
  });

  client.interceptors.response.use(
    (res) => res,
    (err) => {
      logger.error('[WA] API error', {
        status: err.response?.status,
        error: err.response?.data?.error,
        url: err.config?.url,
      });
      throw err;
    }
  );

  return client;
}

const waClient = createClient();
const PHONE_ID = env.WHATSAPP_PHONE_NUMBER_ID || '';

export async function sendText(to: string, text: string, previewUrl = false) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text, preview_url: previewUrl },
  };

  const { data } = await waClient.post(`/${PHONE_ID}/messages`, payload);
  logger.info(`[WA] Text sent to ${to}`, { messageId: data.messages?.[0]?.id });
  return data;
}

export async function sendTemplate(to: string, templateName: string, languageCode: string, components: any[] = []) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  };

  const { data } = await waClient.post(`/${PHONE_ID}/messages`, payload);
  logger.info(`[WA] Template "${templateName}" sent to ${to}`);
  return data;
}

export async function sendButtons(to: string, headerText: string | null, bodyText: string, buttons: Array<{ id: string; title: string }>) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      ...(headerText ? { header: { type: 'text', text: headerText } } : {}),
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  };

  const { data } = await waClient.post(`/${PHONE_ID}/messages`, payload);
  return data;
}

export async function sendList(
  to: string,
  headerText: string,
  bodyText: string,
  footerText: string | null,
  buttonLabel: string,
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>
) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: headerText },
      body: { text: bodyText },
      ...(footerText ? { footer: { text: footerText } } : {}),
      action: {
        button: buttonLabel || 'Ver opções',
        sections: sections.map((sec) => ({
          title: sec.title,
          rows: sec.rows.slice(0, 10).map((r) => ({
            id: r.id,
            title: r.title.slice(0, 24),
            description: r.description?.slice(0, 72),
          })),
        })),
      },
    },
  };

  const { data } = await waClient.post(`/${PHONE_ID}/messages`, payload);
  return data;
}

export async function markAsRead(messageId: string) {
  await waClient.post(`/${PHONE_ID}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  });
}

export async function getMediaUrl(mediaId: string): Promise<string> {
  const { data } = await waClient.get(`/${mediaId}`);
  return data.url;
}

export async function downloadMedia(mediaUrl: string): Promise<Buffer> {
  const { data } = await axios.get(mediaUrl, {
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
    responseType: 'arraybuffer',
  });
  return Buffer.from(data);
}

export function verifyWebhookToken(mode: string, token: string, challenge: string): string | null {
  if (mode === 'subscribe' && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return challenge;
  }
  return null;
}

export function verifyPayloadSignature(rawBody: Buffer | string, signatureHeader: string): boolean {
  if (!signatureHeader || !env.WHATSAPP_ACCESS_TOKEN) return false;
  const expectedSignature = crypto
    .createHmac('sha256', env.WHATSAPP_ACCESS_TOKEN)
    .update(rawBody)
    .digest('hex');
  const receivedSignature = signatureHeader.replace('sha256=', '');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

export interface ParsedWebhookEvent {
  type: 'message' | 'status_update';
  phoneNumberId?: string;
  from?: string;
  senderName?: string;
  text?: string;
  msgType?: string;
  messageId?: string;
  timestamp?: string;
  status?: string;
  recipient?: string;
  buttonTitle?: string;
  listTitle?: string;
  mediaId?: string;
}

export function parseWebhookEvent(body: any): ParsedWebhookEvent | null {
  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    if (!value) return null;

    const statuses = value.statuses?.[0];
    if (statuses) {
      return {
        type: 'status_update',
        messageId: statuses.id,
        status: statuses.status,
        recipient: statuses.recipient_id,
        timestamp: statuses.timestamp,
      };
    }

    const message = value.messages?.[0];
    if (!message) return null;

    const contactInfo = value.contacts?.[0];

    return {
      type: 'message',
      phoneNumberId: value.metadata?.phone_number_id,
      from: message.from,
      senderName: contactInfo?.profile?.name || message.from,
      text: message.text?.body || message.caption || '',
      msgType: message.type,
      messageId: message.id,
      timestamp: message.timestamp,
      buttonTitle: message.interactive?.button_reply?.title,
      listTitle: message.interactive?.list_reply?.title,
      mediaId: message.image?.id || message.audio?.id || message.document?.id || message.video?.id,
    };
  } catch {
    return null;
  }
}
