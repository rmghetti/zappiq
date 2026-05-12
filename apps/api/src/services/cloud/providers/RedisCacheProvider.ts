/**
 * RedisCacheProvider — adapter ioredis → ICache (PR #V4-005).
 *
 * Wrappa o `redis` client singleton existente em `apps/api/src/utils/redis.ts`.
 * Fail-soft: erros de backend retornam null/false + log.warn, nunca throw.
 *
 * Quando migrar call sites do código atual:
 *   - Trocar `import { redis } from '../../utils/redis.js'` por
 *     `import { cache } from '../../services/cloud/index.js'`
 *   - Trocar `redis.get(k)` por `cache.get(k)`
 *   - Trocar `redis.set(k, v, 'EX', ttl)` por `cache.set(k, v, ttl)`
 *
 * Operações exóticas (HSET, ZSET, pipelines) que NÃO estão em ICache
 * continuam usando `redis` diretamente — só o cache key-value comum
 * passa por esta camada.
 */

import { redis } from '../../../utils/redis.js';
import { logger } from '../../../utils/logger.js';
import type { ICache } from '../ICache.js';

export class RedisCacheProvider implements ICache {
  async get(key: string): Promise<string | null> {
    try {
      return await redis.get(key);
    } catch (err: any) {
      logger.warn('[RedisCacheProvider.get] failed', { key, err: err?.message });
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await redis.set(key, value, 'EX', ttlSeconds);
      } else {
        await redis.set(key, value);
      }
      return true;
    } catch (err: any) {
      logger.warn('[RedisCacheProvider.set] failed', { key, err: err?.message });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      return true;
    } catch (err: any) {
      logger.warn('[RedisCacheProvider.del] failed', { key, err: err?.message });
      return false;
    }
  }

  async incr(key: string): Promise<number | null> {
    try {
      return await redis.incr(key);
    } catch (err: any) {
      logger.warn('[RedisCacheProvider.incr] failed', { key, err: err?.message });
      return null;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const r = await redis.expire(key, ttlSeconds);
      return r === 1;
    } catch (err: any) {
      logger.warn('[RedisCacheProvider.expire] failed', { key, err: err?.message });
      return false;
    }
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    try {
      return await redis.mget(...keys);
    } catch (err: any) {
      logger.warn('[RedisCacheProvider.mget] failed', { count: keys.length, err: err?.message });
      return keys.map(() => null);
    }
  }

  async ping(): Promise<boolean> {
    try {
      const pong = await redis.ping();
      return pong === 'PONG';
    } catch (err: any) {
      logger.warn('[RedisCacheProvider.ping] failed', { err: err?.message });
      return false;
    }
  }
}
