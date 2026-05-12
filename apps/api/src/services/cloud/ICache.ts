/**
 * ICache — interface cloud-agnostic pra cache key-value.
 *
 * Backends suportados (hoje + futuro):
 *   - Redis (Upstash) — `RedisCacheProvider`
 *   - GCP Memorystore — TODO
 *   - AWS ElastiCache — TODO
 *   - In-memory (testes) — TODO
 *
 * Operações cobrem 90% do uso atual em ZappIQ (rate limit, circuit breaker,
 * dedup webhook, rag cache, planLimits quota). Operações exóticas
 * (HSET, LIST, ZSET) NÃO entram nessa interface — quem precisar usa o
 * backend nativo diretamente e fica explicitamente cloud-specific.
 *
 * Fail-soft semantics: todos os adapters retornam null/false em caso de
 * erro de backend ao invés de throw — preserva graceful degrade do produto.
 */
export interface ICache {
  /** Retorna valor ou null se não existe. Erros de backend → null + log. */
  get(key: string): Promise<string | null>;

  /**
   * Seta valor com TTL opcional em segundos. Sem TTL = sem expiração.
   * Erros de backend → false + log (não throw).
   */
  set(key: string, value: string, ttlSeconds?: number): Promise<boolean>;

  /** Remove a key. Idempotente — null/inexistente não é erro. */
  del(key: string): Promise<boolean>;

  /**
   * INCRBY atômico. Útil pra contadores (quota, rate limit).
   * `amount` default 1 (equivale ao Redis INCR). Retorna valor pós-incremento;
   * null em erro de backend.
   */
  incrby(key: string, amount?: number): Promise<number | null>;

  /**
   * INCRBYFLOAT atômico. Usado pra acumular valores monetários (trial cost,
   * billing). Precisão limitada pelo backend — Redis usa long double.
   * Retorna valor pós-incremento; null em erro de backend.
   */
  incrbyfloat(key: string, amount: number): Promise<number | null>;

  /**
   * EXPIRE key — seta TTL em segundos numa key já existente.
   * Útil em conjunto com INCR (incr + expire pattern).
   */
  expire(key: string, ttlSeconds: number): Promise<boolean>;

  /**
   * Lê várias keys em batch. null pras inexistentes.
   * Não é transaction — só round-trip menor.
   */
  mget(keys: string[]): Promise<(string | null)[]>;

  /**
   * Healthcheck — retorna true se backend responde em <500ms.
   * Usado pelo /api/health e pelo circuit breaker do próprio cache layer.
   */
  ping(): Promise<boolean>;

  /**
   * SET key value EX ttl NX — atomic set-if-not-exists com TTL.
   * Útil pra dedup (webhook replay protection, idempotency keys).
   *
   * Retorno tri-estado:
   *   - `true`  → criou (key não existia, agora existe com TTL)
   *   - `false` → não criou (key já existia)
   *   - `null`  → erro de backend (caller decide fail-open/closed)
   *
   * Por que tri-estado: em dedup, `false` (já existia) e `null` (erro)
   * têm consequências MUITO diferentes — o primeiro deve bloquear o
   * webhook, o segundo deve fail-open pra não perder eventos. Adapters
   * concretos (Redis, Memorystore) DEVEM distinguir esses casos.
   */
  setNX(key: string, value: string, ttlSeconds: number): Promise<boolean | null>;
}
