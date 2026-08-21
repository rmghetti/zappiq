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
  /** PR-D: tier de envio (TIER_250, TIER_1K...) quando pedido via opts. */
  messagingTier?: string;
  /** Instagram: dados da conta quando ok. */
  username?: string;
  name?: string;
  /** Quando !ok: mensagem crua da Graph API + dica acionável em pt-BR. */
  error?: string;
  hint?: string;
  /** PR-D: código numérico do erro da Graph (190, 100...), quando houver. */
  errorCode?: number;
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
  return { ok: false, error: message, hint, ...(typeof code === 'number' ? { errorCode: code } : {}) };
}

/**
 * GET no node do número: prova token + Phone Number ID de uma vez.
 *
 * PR-D: `opts.includeMessagingTier` acrescenta `messaging_limit_tier` aos
 * fields (usado pela varredura de saúde). Opcional de propósito: os callers
 * existentes (Testar conexão) continuam com a mesma requisição de sempre.
 */
export async function checkWhatsappCredentials(
  phoneNumberId: string,
  accessToken: string,
  opts?: { includeMessagingTier?: boolean },
): Promise<CredentialCheckResult> {
  const fields = opts?.includeMessagingTier
    ? 'display_phone_number,verified_name,quality_rating,messaging_limit_tier'
    : 'display_phone_number,verified_name,quality_rating';
  try {
    const { data } = await axios.get(`${GRAPH}/${encodeURIComponent(phoneNumberId)}`, {
      params: { fields },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: TIMEOUT_MS,
    });
    return {
      ok: true,
      displayPhoneNumber: data?.display_phone_number,
      verifiedName: data?.verified_name,
      qualityRating: data?.quality_rating,
      ...(data?.messaging_limit_tier ? { messagingTier: data.messaging_limit_tier } : {}),
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
