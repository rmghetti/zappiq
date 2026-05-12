/* ------------------------------------------------------------------ */
/* V2-022 · Webhook replay protection                                  */
/*                                                                     */
/* Protege POST /api/webhook/whatsapp contra:                          */
/*   (1) Replay de payload antigo — janela ±5 min no X-Hub-Timestamp   */
/*       (quando presente) ou Date header.                             */
/*   (2) Reprocessamento duplicado — cache de messageId via cache.setNX*/
/*       (TTL 24h). Duplicatas são respondidas com 200 mas não         */
/*       disparam side-effects (Meta exige 200 para não retry          */
/*       agressivo).                                                   */
/*                                                                     */
/* PR #V4-005.2 (2026-05-12): migrado de import direto de ioredis para */
/* abstração cloud-agnostic via cache.setNX(). Removida a lazy-load do */
/* ioredis (cache é singleton no boot). Fallback in-memory preservado  */
/* PRA QUANDO setNX retorna null (erro de backend) — bloco que antes   */
/* ficava só pra "sem REDIS_URL" agora é fallback universal de falha.  */
/*                                                                     */
/* Plugado em apps/api/src/server.ts antes da rota whatsapp:           */
/*     app.use('/api/webhook/whatsapp', webhookReplayProtection());    */
/*                                                                     */
/* Semântica fail-open em erro de cache (preservada): se backend cai,  */
/* aceita o webhook em vez de bloquear (Meta penaliza não-ack).        */
/* ------------------------------------------------------------------ */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { cache } from '../services/cloud/index.js';

const REPLAY_WINDOW_SECONDS = 5 * 60; // ±5 min
const DEDUP_TTL_SECONDS = 24 * 60 * 60; // 24h

// ── In-memory fallback (usado SÓ quando cache.setNX retorna null = erro) ──
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

// ── Seen-cache check (cache.setNX ou fallback in-memory) ──
async function alreadyProcessed(messageId: string): Promise<boolean> {
  const key = `webhook:seen:${messageId}`;
  const result = await cache.setNX(key, '1', DEDUP_TTL_SECONDS);

  if (result === true) {
    // Criou agora — não é duplicado
    return false;
  }
  if (result === false) {
    // Já existia — é duplicado
    return true;
  }
  // result === null → erro de backend (cache.setNX já logou warning).
  // Fallback in-memory preserva dedup mesmo com Redis down.
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
