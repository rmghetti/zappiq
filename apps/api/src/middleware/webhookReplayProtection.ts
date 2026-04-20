/* ------------------------------------------------------------------ */
/* V2-022 · Webhook replay protection                                  */
/*                                                                     */
/* Protege POST /api/webhook/whatsapp contra:                          */
/*   (1) Replay de payload antigo — janela ±5 min no X-Hub-Timestamp   */
/*       (quando presente) ou Date header.                             */
/*   (2) Reprocessamento duplicado — cache de messageId no Redis com   */
/*       TTL 24h via pattern SETNX. Duplicatas são respondidas com     */
/*       200 mas não disparam side-effects (Meta exige 200 para não    */
/*       retry agressivo).                                             */
/*                                                                     */
/* Plugado em apps/api/src/server.ts antes da rota whatsapp:           */
/*     app.use('/api/webhook/whatsapp', webhookReplayProtection());    */
/*                                                                     */
/* Fallback sem Redis: em dev/test degrada para Set in-memory com TTL  */
/* auto-purge a cada 60s. Nunca falha aberto em produção — se Redis    */
/* estiver indisponível, middleware loga ERROR e deixa passar (porque  */
/* perder um webhook é pior que aceitar replay raro).                  */
/* ------------------------------------------------------------------ */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

const REPLAY_WINDOW_SECONDS = 5 * 60; // ±5 min
const DEDUP_TTL_SECONDS = 24 * 60 * 60; // 24h

// ── Redis (opcional) ──
let redisClient: any = null;
async function getRedis() {
  if (redisClient !== null) return redisClient;
  try {
    // Lazy import — evita import circular no boot
    const mod = await import('ioredis');
    const url = process.env.REDIS_URL;
    if (!url) {
      redisClient = false;
      return false;
    }
    const RedisCls = (mod.default ?? mod) as any;
    redisClient = new RedisCls(url, { maxRetriesPerRequest: 2, lazyConnect: true });
    await redisClient.connect().catch(() => {});
    return redisClient;
  } catch (err) {
    logger.warn('[ReplayProtection] Redis not available — falling back to in-memory dedup', { err });
    redisClient = false;
    return false;
  }
}

// ── In-memory fallback ──
const memoryCache = new Map<string, number>();
function memoryHasSeen(key: string): boolean {
  const now = Date.now() / 1000;
  // Purge expired a cada chamada (O(n) ok para volume típico)
  for (const [k, expiresAt] of memoryCache.entries()) {
    if (expiresAt < now) memoryCache.delete(k);
  }
  return memoryCache.has(key);
}
function memorySetSeen(key: string, ttl: number) {
  memoryCache.set(key, Date.now() / 1000 + ttl);
}

// ── Timestamp freshness ──
export function isTimestampFresh(rawTs: string | undefined, now: Date = new Date()): boolean {
  if (!rawTs) return true; // header opcional; Meta nem sempre envia
  const ts = Number(rawTs);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  // Meta envia em segundos. Se > ~1e12 assumimos ms e convertemos.
  const tsSec = ts > 1e12 ? ts / 1000 : ts;
  const nowSec = now.getTime() / 1000;
  return Math.abs(nowSec - tsSec) <= REPLAY_WINDOW_SECONDS;
}

// ── Extract messageId do payload Meta ──
export function extractMessageId(body: any): string | null {
  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const messages = changes?.value?.messages;
    if (Array.isArray(messages) && messages.length > 0 && messages[0].id) {
      return String(messages[0].id);
    }
    const statuses = changes?.value?.statuses;
    if (Array.isArray(statuses) && statuses.length > 0 && statuses[0].id) {
      return `status:${statuses[0].id}`;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Seen-cache check (Redis ou fallback) ──
async function alreadyProcessed(messageId: string): Promise<boolean> {
  const key = `webhook:seen:${messageId}`;
  const r = await getRedis();
  if (r && r !== false) {
    try {
      // SET key 1 NX EX 24*3600 — retorna "OK" se criou, null se já existia
      const result = await r.set(key, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
      return result === null;
    } catch (err) {
      logger.error('[ReplayProtection] Redis SET failed — fail-open', { err });
      return false;
    }
  }
  // Fallback in-memory
  if (memoryHasSeen(key)) return true;
  memorySetSeen(key, DEDUP_TTL_SECONDS);
  return false;
}

// ── Middleware ──
export function webhookReplayProtection() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Só protege POST
    if (req.method !== 'POST') return next();

    // (1) Timestamp freshness — header custom + fallback Date
    const hubTs = (req.headers['x-hub-timestamp'] ?? req.headers['x-hub-timestamp-ms']) as string | undefined;
    if (!isTimestampFresh(hubTs)) {
      logger.warn('[ReplayProtection] stale timestamp — rejecting', { hubTs });
      res.status(408).json({ error: 'Stale webhook timestamp' });
      return;
    }

    // (2) Dedup por messageId (se extrair com sucesso)
    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
    const messageId = extractMessageId(body);
    if (messageId) {
      const duplicate = await alreadyProcessed(messageId);
      if (duplicate) {
        logger.info('[ReplayProtection] duplicate messageId — ack 200 without side-effect', { messageId });
        // Responde 200 pra Meta não reintentar, mas NÃO continua a cadeia.
        res.status(200).json({ status: 'duplicate', messageId });
        return;
      }
    }

    next();
  };
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}

export const __test__ = { memoryCache };
