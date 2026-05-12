/**
 * Cloud abstractions factory (PR #V4-005).
 *
 * Singleton por env. Importe `cache`, `auth`, `storage` daqui — não acesse
 * os providers diretamente fora da pasta `cloud/`.
 *
 * Env vars que controlam:
 *   - CLOUD_CACHE_PROVIDER     redis (default) | memorystore | inmemory
 *   - CLOUD_AUTH_PROVIDER      supabase (default) | cognito | firebase
 *   - CLOUD_STORAGE_PROVIDER   supabase (default) | s3 | gcs
 *
 * Trocar requer restart — não suportamos swap dinâmico em runtime.
 */

import { RedisCacheProvider } from './providers/RedisCacheProvider.js';
import type { ICache } from './ICache.js';
import type { IAuth } from './IAuth.js';
import type { IStorage } from './IStorage.js';

function createCache(): ICache {
  const provider = process.env.CLOUD_CACHE_PROVIDER || 'redis';
  switch (provider) {
    case 'redis':
      return new RedisCacheProvider();
    // case 'memorystore': return new MemorystoreCacheProvider(); // TODO
    // case 'inmemory': return new InMemoryCacheProvider(); // TODO testes
    default:
      // eslint-disable-next-line no-console
      console.warn(`[cloud/factory] CLOUD_CACHE_PROVIDER=${provider} desconhecido, usando redis`);
      return new RedisCacheProvider();
  }
}

// TODO próxima PR — adapter Supabase Auth
// function createAuth(): IAuth { ... }

// TODO próxima PR — adapter Storage
// function createStorage(): IStorage { ... }

/** Cache cloud-agnostic. Redis hoje, Memorystore/ElastiCache amanhã. */
export const cache: ICache = createCache();

// Re-exports pra ergonomia
export type { ICache, IAuth, IStorage };
