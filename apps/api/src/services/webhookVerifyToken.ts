/**
 * webhookVerifyToken — verify token de webhook POR ORGANIZAÇÃO (13/08).
 *
 * Contexto: no caminho manual ("traga seu token"), o cliente cadastra a
 * Callback URL + Verify Token no app Meta DELE. Até aqui o produto nunca
 * mostrava nenhum dos dois, e o único verify token era o global de env
 * (compartilhado por todos os tenants — um cliente podia verificar o webhook
 * de outro).
 *
 * Solução sem migração: token DERIVADO por HMAC do orgId com o segredo do
 * servidor — `zpq1.<orgId>.<assinatura>`. Determinístico (o cliente vê sempre
 * o mesmo), verificável sem consulta ao banco, e não-forjável sem o segredo.
 * Os GETs de verificação (webhook.ts / webhookInstagram.ts) aceitam o token
 * global (retrocompat com configs Meta existentes) OU um token derivado válido.
 *
 * Nota: o verify token só participa do handshake de assinatura do webhook na
 * Meta. A autenticidade de cada POST continua garantida pelo HMAC
 * x-hub-signature-256 com o App Secret (global ou por org).
 */
import crypto from 'node:crypto';
import { env } from '../config/env.js';

const PREFIX = 'zpq1';
const SIG_HEX_CHARS = 20;

function signature(orgId: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`zappiq-webhook-verify:${orgId}`)
    .digest('hex')
    .slice(0, SIG_HEX_CHARS);
}

/** Token determinístico da org: `zpq1.<orgId>.<hmac20>`. */
export function buildOrgWebhookVerifyToken(orgId: string, secret: string = env.JWT_SECRET): string {
  return `${PREFIX}.${orgId}.${signature(orgId, secret)}`;
}

/** Valida um token derivado. Nunca lança; qualquer formato inválido → false. */
export function isValidOrgWebhookVerifyToken(
  token: string | undefined | null,
  secret: string = env.JWT_SECRET,
): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;
  const [, orgId, provided] = parts;
  if (!orgId || !provided || provided.length !== SIG_HEX_CHARS) return false;
  const expected = signature(orgId, secret);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
