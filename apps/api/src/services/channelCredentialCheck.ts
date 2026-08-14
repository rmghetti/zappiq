/**
 * channelCredentialCheck — "Testar conexão" das credenciais de canal (13/08).
 *
 * Contexto: o cliente colava um token errado e lia "Credenciais salvas!" —
 * só descobria o problema quando um lead real ficava sem resposta. Aqui
 * fazemos um GET read-only na Graph API com as credenciais salvas e devolvemos
 * ok/erro com uma dica acionável em pt-BR. Read-only de propósito: nada de
 * mandar mensagem de teste pra número arbitrário (fora da janela de 24h a
 * Cloud API rejeitaria e o "teste" mentiria).
 *
 * Nunca lança — o route handler devolve o resultado como está.
 */
import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const GRAPH_VERSION = env.WHATSAPP_API_VERSION || 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const TIMEOUT_MS = 10_000;

export interface CredentialCheckResult {
  ok: boolean;
  /** WhatsApp: dados do número quando ok. */
  displayPhoneNumber?: string;
  verifiedName?: string;
  qualityRating?: string;
  /** Instagram: dados da conta quando ok. */
  username?: string;
  name?: string;
  /** Quando !ok: mensagem crua da Graph API + dica acionável em pt-BR. */
  error?: string;
  hint?: string;
  /** 13/08: teste feito com a credencial GLOBAL da plataforma (dogfood Iza). */
  viaGlobal?: boolean;
}

function graphErrorToResult(err: unknown, channel: 'whatsapp' | 'instagram'): CredentialCheckResult {
  const e = (err as any)?.response?.data?.error;
  const code: number | undefined = e?.code;
  const message: string = e?.message || (err instanceof Error ? err.message : String(err));

  let hint = 'Confira as credenciais e tente de novo. Se persistir, agende o onboarding assistido.';
  if (code === 190) {
    hint = 'Token inválido ou expirado. Gere um novo token na Meta e cole aqui de novo.';
  } else if (code === 100) {
    hint =
      channel === 'whatsapp'
        ? 'ID não encontrado com esse token. Confira o Phone Number ID (só números) e se o token pertence ao mesmo app.'
        : 'ID não encontrado com esse token. Confira o Instagram Account ID (só números) e se o token pertence à Página vinculada.';
  } else if (code === 10 || code === 200) {
    hint = 'O token não tem permissões suficientes pra esse recurso. Confira as permissões concedidas ao gerar o token.';
  }

  logger.warn('[ChannelCheck] credencial reprovada no teste', { channel, code, message });
  return { ok: false, error: message, hint };
}

/** GET no node do número: prova token + Phone Number ID de uma vez. */
export async function checkWhatsappCredentials(
  phoneNumberId: string,
  accessToken: string,
): Promise<CredentialCheckResult> {
  try {
    const { data } = await axios.get(`${GRAPH}/${encodeURIComponent(phoneNumberId)}`, {
      params: { fields: 'display_phone_number,verified_name,quality_rating' },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: TIMEOUT_MS,
    });
    return {
      ok: true,
      displayPhoneNumber: data?.display_phone_number,
      verifiedName: data?.verified_name,
      qualityRating: data?.quality_rating,
    };
  } catch (err) {
    return graphErrorToResult(err, 'whatsapp');
  }
}

/** GET no node da conta IG Business: prova token + Instagram Account ID. */
export async function checkInstagramCredentials(
  igAccountId: string,
  accessToken: string,
): Promise<CredentialCheckResult> {
  try {
    const { data } = await axios.get(`${GRAPH}/${encodeURIComponent(igAccountId)}`, {
      params: { fields: 'username,name' },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: TIMEOUT_MS,
    });
    return { ok: true, username: data?.username, name: data?.name };
  } catch (err) {
    return graphErrorToResult(err, 'instagram');
  }
}
