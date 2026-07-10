/*
 * metaCapi — Loop de Receita do Zap Impulso: envia a CONVERSÃO DE COMPRA de
 * volta à Meta (Conversions API) quando a venda de uma conversa vinda de anúncio
 * (Click-to-WhatsApp) entra no CRM. Assim a mídia passa a otimizar por quem
 * COMPRA, não por quem só clica.
 *
 * Requer, por org: dataset id + access token do app Meta (guardados em settings)
 * e o ctwa_clid capturado no clique do anúncio. Sem esses dados, nada é enviado
 * (inerte). Nada aqui move dinheiro.
 */
import { createHash } from 'crypto';
import { decryptSecret } from '../utils/crypto.js';

const GRAPH_VERSION = 'v21.0';

/**
 * Config da CAPI por org, lida de organization.settings (pura):
 *  - capiDatasetId: id do dataset/pixel do Meta.
 *  - capiAccessTokenEnc: token do app Meta, cifrado (crypto.encryptSecret).
 * Sem config, nada é enviado (inerte).
 */
export function getCapiConfigFromSettings(settings: unknown): { datasetId: string; accessToken: string } | null {
  const s = (settings && typeof settings === 'object' ? settings : {}) as Record<string, unknown>;
  const datasetId = typeof s.capiDatasetId === 'string' ? s.capiDatasetId : '';
  let accessToken = '';
  if (typeof s.capiAccessTokenEnc === 'string' && s.capiAccessTokenEnc) {
    try { accessToken = decryptSecret(s.capiAccessTokenEnc); } catch { accessToken = ''; }
  }
  if (!datasetId || !accessToken) return null;
  return { datasetId, accessToken };
}

// ── Partes puras (testadas) ─────────────────────────────────

/** Normaliza (trim+lowercase) e hasheia em SHA-256 hex, como a Meta exige. */
export function sha256Hex(value: string | undefined | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const norm = value.trim().toLowerCase();
  if (!norm) return undefined;
  return createHash('sha256').update(norm).digest('hex');
}

export interface CapiConfig {
  datasetId: string;
  accessToken: string;
}

export interface CapiPurchaseInput {
  ctwaClid: string;
  value: number;
  currency: string;
  phone?: string;
  email?: string;
  eventId: string; // dedup (ex.: id do deal)
  eventTimeSec: number; // unix seconds
}

export interface CapiEvent {
  event_name: 'Purchase';
  event_time: number;
  action_source: 'business_messaging';
  messaging_channel: 'whatsapp';
  event_id: string;
  user_data: { ctwa_clid: string; ph?: string[]; em?: string[] };
  custom_data: { value: number; currency: string };
}

/** Monta o evento Purchase de CTWA para a Conversions API. */
export function buildCapiPurchaseEvent(input: CapiPurchaseInput): CapiEvent {
  const ph = sha256Hex(input.phone);
  const em = sha256Hex(input.email);
  return {
    event_name: 'Purchase',
    event_time: input.eventTimeSec,
    action_source: 'business_messaging',
    messaging_channel: 'whatsapp',
    event_id: input.eventId,
    user_data: {
      ctwa_clid: input.ctwaClid,
      ...(ph ? { ph: [ph] } : {}),
      ...(em ? { em: [em] } : {}),
    },
    custom_data: { value: input.value, currency: input.currency },
  };
}

/** Só envia se houver dataset+token configurados E um ctwa_clid do anúncio. */
export function capiReady(config: CapiConfig | null | undefined, ctwaClid: string | null | undefined): boolean {
  return Boolean(config && config.datasetId && config.accessToken && ctwaClid);
}

// ── Cliente HTTP (Graph API) ────────────────────────────────

/** Envia o evento à Conversions API. Retorna o corpo da resposta da Meta. */
export async function sendCapiEvent(config: CapiConfig, event: CapiEvent): Promise<any> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${config.datasetId}/events`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [event], access_token: config.accessToken }),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    throw new Error(`Meta CAPI falhou (${res.status}): ${msg}`);
  }
  return data;
}
