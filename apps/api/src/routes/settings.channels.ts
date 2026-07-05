/**
 * settings.channels — desconectar canal + monitor de saúde (FEATURE 5b.3).
 *
 * Contexto: hoje a UI de canais (ConectarCanais) só CONECTA. Não havia como o
 * cliente REVOGAR as credenciais de um canal pelo dashboard — o token e o
 * quality_rating morriam em silêncio ao trocar de número / encerrar a conta.
 * Aqui damos o caminho de saída: zerar as credenciais do canal na Organization
 * e um indicador de saúde (conectado/desconectado; + quality_rating do número
 * quando dá pra buscar na Graph API).
 *
 * Módulo de LÓGICA PURA (zero I/O): o route handler em settings.ts é um wrapper
 * fino em cima destes helpers, exatamente no mesmo padrão de settings.schema.ts
 * (testado por settings.security.test.ts). Assim conseguimos testar o contrato
 * de disconnect sem harness supertest (o server.ts puxa Redis/OTel/BullMQ).
 */

export const DISCONNECTABLE_CHANNELS = ['whatsapp', 'instagram'] as const;
export type Channel = (typeof DISCONNECTABLE_CHANNELS)[number];

export function isDisconnectableChannel(v: string): v is Channel {
  return (DISCONNECTABLE_CHANNELS as readonly string[]).includes(v);
}

/**
 * Colunas de credencial que cada canal ocupa na Organization. Desconectar =
 * setar TODAS pra null (revogação local; a Meta continua com o app assinado até
 * o cliente remover no painel dela, mas sem token a ZappIQ para de usar).
 */
export const CHANNEL_CREDENTIAL_FIELDS: Record<Channel, readonly string[]> = {
  whatsapp: ['whatsappPhoneNumberId', 'whatsappBusinessAccountId', 'whatsappAccessToken'],
  instagram: ['instagramAccountId', 'instagramPageId', 'instagramAccessToken'],
} as const;

/**
 * Monta o `data` do prisma.organization.update que ZERA as credenciais do canal.
 * Só toca nas colunas do canal pedido — nunca mexe no outro canal nem em
 * plan/billing/settings. Determinístico e sem I/O → testável.
 */
export function buildDisconnectData(channel: Channel): Record<string, null> {
  const out: Record<string, null> = {};
  for (const field of CHANNEL_CREDENTIAL_FIELDS[channel]) {
    out[field] = null;
  }
  return out;
}

/**
 * Limpa o bloco de metadados do canal em `settings` (ex.: settings.whatsapp com
 * pin/connectedAt), preservando o resto. Marca disconnectedAt pro histórico.
 * Não muta o input.
 */
export function buildDisconnectSettings(
  channel: Channel,
  current: Record<string, any> | null | undefined,
  now: string,
): Record<string, any> {
  const base = { ...(current || {}) };
  const prev = (base[channel] as Record<string, any>) || {};
  base[channel] = {
    // preserva metadados úteis (ex.: pageName) mas derruba o estado de conexão
    ...prev,
    connectedAt: null,
    disconnectedAt: now,
  };
  // channelActivation: se o cliente desconectou o único canal ativo, não forçamos
  // nada aqui — o cliente reativa escolhendo de novo. Deixamos como está pra não
  // surpreender quem tem 'both' e desconectou só um.
  return base;
}

type OrgChannelSnapshot = {
  whatsappAccessToken?: string | null;
  whatsappPhoneNumberId?: string | null;
  whatsappBusinessAccountId?: string | null;
  instagramAccessToken?: string | null;
  instagramAccountId?: string | null;
  instagramPageId?: string | null;
  settings?: Record<string, any> | null;
};

export interface ChannelHealth {
  channel: Channel;
  connected: boolean;
  /** quality_rating do número (GREEN/YELLOW/RED/UNKNOWN) quando buscável na Graph API. */
  qualityRating?: string | null;
  /** status do número na Cloud API (CONNECTED/FLAGGED/...) quando buscável. */
  numberStatus?: string | null;
  connectedAt?: string | null;
  disconnectedAt?: string | null;
}

/**
 * Deriva a saúde base de cada canal a partir só da presença de credencial na org
 * (sem chamar a Graph API). O route handler pode enriquecer o WhatsApp com
 * quality_rating buscado ao vivo; se a chamada falhar, cai neste base
 * (conectado/desconectado), nunca quebra.
 */
export function deriveChannelHealth(org: OrgChannelSnapshot): Record<Channel, ChannelHealth> {
  const settings = org.settings || {};
  const wa = (settings.whatsapp as Record<string, any>) || {};
  const ig = (settings.instagram as Record<string, any>) || {};
  return {
    whatsapp: {
      channel: 'whatsapp',
      connected: !!(org.whatsappAccessToken && org.whatsappPhoneNumberId),
      qualityRating: null,
      numberStatus: null,
      connectedAt: wa.connectedAt ?? null,
      disconnectedAt: wa.disconnectedAt ?? null,
    },
    instagram: {
      channel: 'instagram',
      connected: !!(org.instagramAccessToken && org.instagramAccountId),
      qualityRating: null,
      numberStatus: null,
      connectedAt: ig.connectedAt ?? null,
      disconnectedAt: ig.disconnectedAt ?? null,
    },
  };
}
