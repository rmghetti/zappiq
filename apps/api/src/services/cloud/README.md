# Cloud Abstractions (PR #V4-005)

**Status:** terreno preparado. Interfaces criadas, providers atuais wrappados.
Call sites do código NÃO foram migrados ainda — issue rastreável pra "Onda 2 cloud-agnostic".

## Por quê

ZappIQ roda hoje em stack Supabase + Fly + Upstash Redis. Conforme o produto
escala, opções viáveis incluem GCP (Cloud SQL + Memorystore + Cloud Run),
AWS (RDS + ElastiCache + ECS) ou continuar Supabase com proxies regionais.

A escolha de cloud não deve sangrar nas 17+ chamadas diretas a `redis.get()`
e `supabase.auth.*` espalhadas pelo backend. Esta camada existe pra que a
migração custe um adapter novo, não uma varredura.

## Estrutura

```
cloud/
├── README.md                    # este arquivo (ADR)
├── ICache.ts                    # interface cache (Redis hoje, GCP Memorystore amanhã)
├── IAuth.ts                     # interface auth (Supabase Auth hoje, Cognito/Firebase amanhã)
├── IStorage.ts                  # interface storage (RAG service hoje, S3/GCS amanhã)
├── providers/
│   ├── RedisCacheProvider.ts    # adapter ioredis → ICache
│   ├── SupabaseAuthProvider.ts  # adapter supabase-js → IAuth (TODO próxima PR)
│   └── (futuro) S3StorageProvider, GcsStorageProvider, MemorystoreCacheProvider
```

## Como migrar um call site

**Antes:**
```typescript
import { redis } from '../utils/redis.js';
const cached = await redis.get(`org:${orgId}:plan`);
```

**Depois:**
```typescript
import { cache } from '../services/cloud/index.js';
const cached = await cache.get(`org:${orgId}:plan`);
```

A factory `cache` em `index.ts` retorna `RedisCacheProvider` por default,
controlado por env `CLOUD_CACHE_PROVIDER=redis|memorystore|inmemory`.

## Roadmap

- **PR #V4-005 (esta):** interfaces + 1 adapter (Redis) + factory.
- **PR #V4-005.1:** migrar 12 consumers Redis → ICache. Não-funcional, só wiring.
- **PR #V4-005.2:** IAuth adapter Supabase + migrar 5 routes auth.
- **PR Onda 2:** segundo provider (Memorystore ou ElastiCache) + load test.

## Decisão arquitetural

- **Não usar DI framework** (InversifyJS, tsyringe). Module-level singletons
  são suficientes pro tamanho do código; DI explícito vira ritual sem ROI.
- **Factory por env, não por config dinâmico** — config dinâmico em runtime
  requer reload com state; env permite restart-to-switch que é mais simples.
- **Fail-soft preservado** — todos os adapters devem manter graceful degrade
  quando o backend está down (mesmo padrão do `redisBreaker.ts`).
