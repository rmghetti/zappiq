import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,

  // ── Reconnect strategy: exponential backoff com teto de 10s ──
  retryStrategy(times: number) {
    if (times > 20) {
      logger.error(`[Redis] Giving up after ${times} reconnect attempts`);
      return null; // stop retrying
    }
    const delay = Math.min(times * 200, 10_000); // 200ms, 400ms, ... max 10s
    logger.warn(`[Redis] Reconnecting attempt ${times} in ${delay}ms`);
    return delay;
  },

  // ── Reconnect on specific transient errors ──
  reconnectOnError(err: Error) {
    const targetErrors = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'READONLY'];
    return targetErrors.some((e) => err.message.includes(e));
  },

  // ── TLS para Upstash/Redis Cloud (rediss:// URLs) ──
  ...(env.REDIS_URL.startsWith('rediss://') ? { tls: { rejectUnauthorized: true } } : {}),
});

redis.on('connect', () => logger.info('[Redis] Connected'));
redis.on('ready', () => logger.info('[Redis] Ready — accepting commands'));
redis.on('close', () => logger.warn('[Redis] Connection closed'));
redis.on('reconnecting', (ms: number) => logger.info(`[Redis] Reconnecting in ${ms}ms`));
redis.on('error', (err) => logger.warn('[Redis] Error:', err.message));

export default redis;
