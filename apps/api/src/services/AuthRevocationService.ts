/* ------------------------------------------------------------------ */
/* V2-021 · Token revocation (JTI blacklist)                           */
/*                                                                     */
/* Armazena JTI revogados em Redis com TTL = tempo restante até        */
/* expiração do token. Se Redis indisponível, degrada para Map         */
/* in-memory com purge automático.                                     */
/*                                                                     */
/* Middleware auth.ts deve invocar `isRevoked(jti)` antes de considerar */
/* um access token válido. Quando usuário sai ou revoga sessão, chamar */
/* `revokeAccessToken(token)` para inserir JTI no blacklist.           */
/*                                                                     */
/* Regras:                                                             */
/*   - Refresh tokens são revogados deletando o registro no banco.     */
/*   - Access tokens (curtos, 15 min) vão pra blacklist Redis.         */
/*   - Rotação de senha → revoga TODOS os JTIs do usuário via          */
/*     prefixo `revoked:user:{userId}:*` + check combinado.            */
/* ------------------------------------------------------------------ */

import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

// ── Redis opcional ──
let redis: any = null;
async function getRedis() {
  if (redis !== null) return redis;
  try {
    const mod = await import('ioredis');
    const url = process.env.REDIS_URL;
    if (!url) { redis = false; return false; }
    const RedisCls = (mod.default ?? mod) as any;
    redis = new RedisCls(url, { maxRetriesPerRequest: 2, lazyConnect: true });
    await redis.connect().catch(() => {});
    return redis;
  } catch (err) {
    logger.warn('[AuthRevocation] Redis unavailable — using in-memory fallback', { err });
    redis = false;
    return false;
  }
}

// ── In-memory fallback ──
const memoryBlacklist = new Map<string, number>(); // jti -> expiresAt (epoch sec)
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
  const r = await getRedis();
  if (r && r !== false) {
    await r.set(jtiKey(jti), '1', 'EX', ttl);
    return;
  }
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
  const r = await getRedis();
  const nowSec = Math.floor(Date.now() / 1000);
  if (r && r !== false) {
    await r.set(userAllKey(userId), String(nowSec), 'EX', ttlSeconds);
    return;
  }
  memoryBlacklist.set(userAllKey(userId), nowSec + ttlSeconds);
}

export async function isRevoked(payload: { jti?: string; sub?: string; iat?: number }): Promise<boolean> {
  const r = await getRedis();
  memoryPurge();

  // Check 1: JTI direto
  if (payload.jti) {
    const key = jtiKey(payload.jti);
    if (r && r !== false) {
      const hit = await r.get(key);
      if (hit) return true;
    } else if (memoryBlacklist.has(key)) {
      return true;
    }
  }

  // Check 2: user-wide revoke (logout todos, password reset, account lock)
  if (payload.sub && payload.iat) {
    const key = userAllKey(payload.sub);
    let revokedAt: number | null = null;
    if (r && r !== false) {
      const v = await r.get(key);
      if (v) revokedAt = Number(v);
    } else {
      const v = memoryBlacklist.get(key);
      if (v) revokedAt = v;
    }
    if (revokedAt && payload.iat < revokedAt) return true;
  }

  return false;
}

export const __test__ = { memoryBlacklist };
