/* ------------------------------------------------------------------ */
/* V2-021 · Token revocation (JTI blacklist)                           */
/*                                                                     */
/* Armazena JTI revogados em cache (Redis hoje, futuro qualquer) com   */
/* TTL = tempo restante até expiração do token. Memory fallback        */
/* paralelo (write-through) preserva semântica em caso de cache down.  */
/*                                                                     */
/* PR #V4-005.4 (2026-05-12): migrado de import direto de ioredis pra  */
/* abstração cloud-agnostic via cache. Removida lazy-load do client    */
/* (cache é singleton no boot). Mantido memory fallback como rede de   */
/* segurança write-through — cada revoke escreve em ambos; reads       */
/* tentam cache primeiro, caem em memory se cache devolveu null.       */
/*                                                                     */
/* Middleware auth.ts deve invocar `isRevoked(jti)` antes de considerar */
/* um access token válido. Quando usuário sai ou revoga sessão, chamar */
/* `revokeAccessToken(token)` para inserir JTI no blacklist.           */
/*                                                                     */
/* Regras:                                                             */
/*   - Refresh tokens são revogados deletando o registro no banco.     */
/*   - Access tokens (curtos, 15 min) vão pra blacklist cache.         */
/*   - Rotação de senha → revoga TODOS os JTIs do usuário via          */
/*     prefixo `revoked:user:{userId}:*` + check combinado.            */
/* ------------------------------------------------------------------ */

import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { cache } from './cloud/index.js';

// ── In-memory fallback (write-through paralelo ao cache) ──
const memoryBlacklist = new Map<string, number>(); // key -> expiresAt (epoch sec)
function memoryPurge() {
  const now = Date.now() / 1000;
  for (const [k, exp] of memoryBlacklist.entries()) {
    if (exp < now) memoryBlacklist.delete(k);
  }
}

function jtiKey(jti: string) { return `revoked:jti:${jti}`; }
function userAllKey(userId: string) { return `revoked:user:${userId}`; }

export async function revokeJti(jti: string, expiresAtEpochSec: number) {
  const nowSec = Date.now() / 1000;
  const ttl = Math.max(1, Math.ceil(expiresAtEpochSec - nowSec));
  // Write-through: cache + memory em paralelo. cache.set é fail-soft;
  // memory garante que mesmo se cache cair, o revoke não é perdido até
  // expirar naturalmente.
  await cache.set(jtiKey(jti), '1', ttl);
  memoryPurge();
  memoryBlacklist.set(jtiKey(jti), expiresAtEpochSec);
}

export async function revokeAccessToken(token: string) {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded) return;
    const jti: string | undefined = decoded.jti;
    const exp: number | undefined = decoded.exp;
    if (!jti || !exp) return;
    await revokeJti(jti, exp);
    logger.info('[AuthRevocation] token revoked', { jti, exp });
  } catch (err) {
    logger.warn('[AuthRevocation] failed to revoke token', { err });
  }
}

export async function revokeAllUserTokens(userId: string, ttlSeconds = 60 * 60 * 24 * 7) {
  // Registra timestamp. Middleware compara iat do token contra esse timestamp:
  // se token.iat < timestamp_revogação → considerar revogado.
  const nowSec = Math.floor(Date.now() / 1000);
  // Write-through: cache + memory em paralelo.
  await cache.set(userAllKey(userId), String(nowSec), ttlSeconds);
  memoryBlacklist.set(userAllKey(userId), nowSec + ttlSeconds);
}

export async function isRevoked(payload: { jti?: string; sub?: string; iat?: number }): Promise<boolean> {
  memoryPurge();

  // Check 1: JTI direto
  if (payload.jti) {
    const key = jtiKey(payload.jti);
    const hit = await cache.get(key);
    if (hit) return true;
    // cache.get retorna null tanto pra "não existe" quanto pra "erro de backend".
    // Memory fallback cobre ambos os casos — se foi revogado mas cache não tem,
    // memory tem (write-through garante).
    if (memoryBlacklist.has(key)) return true;
  }

  // Check 2: user-wide revoke (logout todos, password reset, account lock)
  if (payload.sub && payload.iat) {
    const key = userAllKey(payload.sub);
    let revokedAt: number | null = null;
    const v = await cache.get(key);
    if (v) {
      revokedAt = Number(v);
    } else {
      const m = memoryBlacklist.get(key);
      if (m) revokedAt = m;
    }
    if (revokedAt && payload.iat < revokedAt) return true;
  }

  return false;
}

export const __test__ = { memoryBlacklist };
