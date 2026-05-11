/**
 * Redis-backed Circuit Breaker pro LLMRouter (PR #V4-003).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * Por que existir
 * ════════════════════════════════════════════════════════════════════════════
 * Substitui o circuit breaker IN-MEMORY (Map em LLMRouter.ts antes deste PR)
 * por estado compartilhado em Redis. Motivação:
 *
 *   - Multi-instância Fly (≥2 máquinas): se a instância A detecta 3 falhas
 *     de Anthropic, a instância B NÃO sabia disso com o Map local — continuava
 *     tentando, multiplicando custo + saturando rate-limit.
 *
 *   - Restart de instância: Map em memória perde estado, breaker volta pro
 *     zero e a próxima request pode bater no provider ainda quebrado.
 *
 *   - Coordenação operacional: Grafana/dashboard pode ler o estado direto
 *     do Redis (chaves `zappiq:breaker:*`) sem precisar pingar instâncias.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * Modelo de chaves
 * ════════════════════════════════════════════════════════════════════════════
 *   zappiq:breaker:{providerId}:failures        → counter de falhas na janela
 *   zappiq:breaker:{providerId}:open_until      → epoch ms até quando ABERTO
 *   zappiq:breaker:{providerId}:last_failure_at → epoch ms da última falha
 *
 * TTLs:
 *   - failures: TTL = janela de contagem (60s). Após silêncio de 60s, zera.
 *   - open_until: TTL = duração da abertura (120s). Auto-expira → half-open.
 *   - last_failure_at: TTL = janela de contagem (60s).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * Resiliência ao Redis cair
 * ════════════════════════════════════════════════════════════════════════════
 * Fail-OPEN (prefere servir a bloquear): se Redis estiver indisponível,
 * `breakerIsOpen()` retorna `false` — pipeline LLM continua tentando provider.
 * Razão: degradação parcial > queda total. Mesmo padrão de `planLimits.ts`.
 *
 * Writes (`recordSuccess` / `recordFailure`) também são fail-soft — falha
 * silenciosa só loga WARN. Pipeline de geração não é bloqueado pelo breaker.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * Trade-offs documentados
 * ════════════════════════════════════════════════════════════════════════════
 * - Latência: cada chamada LLM adiciona ~1ms (1 GET no Redis). Aceitável
 *   versus latency total de 500-2000ms da chamada externa.
 *
 * - Concorrência: o INCR é atômico no Redis. Mas a janela de tempo é
 *   aproximada (TTL no Redis tem granularidade de segundo). Em pico, pode
 *   abrir breaker com 2 ou 4 falhas em vez de exatos 3 — irrelevante.
 *
 * - Half-open: quando `open_until` expira, a próxima request entra e tenta
 *   o provider. Se falhar, vira full-open de novo (recordFailure aumenta
 *   counter). Se passar, recordSuccess limpa as chaves. Simples e correto.
 */

import { redis } from '../../utils/redis.js';
import { logger } from '../../utils/logger.js';

export type FailureKind = 'timeout' | '5xx' | '429' | 'quota' | 'client';

// ─── Configuração ────────────────────────────────────────────────────────
const FAIL_THRESHOLD = 3;
const FAIL_WINDOW_MS = 60 * 1000;
const OPEN_DURATION_MS = 120 * 1000;

// TTLs em segundos (Redis EXPIRE usa segundos)
const FAIL_WINDOW_SEC = Math.ceil(FAIL_WINDOW_MS / 1000);
const OPEN_DURATION_SEC = Math.ceil(OPEN_DURATION_MS / 1000);

// ─── Chaves Redis ────────────────────────────────────────────────────────
function failuresKey(id: string): string {
  return `zappiq:breaker:${id}:failures`;
}
function openUntilKey(id: string): string {
  return `zappiq:breaker:${id}:open_until`;
}
function lastFailureKey(id: string): string {
  return `zappiq:breaker:${id}:last_failure_at`;
}

// ─── API pública ─────────────────────────────────────────────────────────

/**
 * Retorna `true` se o breaker do provider está ABERTO (i.e., pular este
 * provider na cascade). Half-open é tratado pela expiração natural do TTL —
 * quando `open_until` expira, a chave some e a função retorna `false`.
 *
 * Fail-OPEN: erro de Redis ⇒ retorna `false` (não bloqueia).
 */
export async function breakerIsOpen(id: string): Promise<boolean> {
  try {
    const raw = await redis.get(openUntilKey(id));
    if (!raw) return false;
    const openUntil = Number(raw);
    if (!Number.isFinite(openUntil)) return false;
    return Date.now() < openUntil;
  } catch (err: any) {
    logger.warn(`[redisBreaker] breakerIsOpen Redis falhou (fail-open): ${err.message}`);
    return false;
  }
}

/**
 * Registra sucesso — zera as 3 chaves do provider. Idempotente.
 * Fail-soft: erro de Redis só loga WARN.
 */
export async function recordSuccess(id: string): Promise<void> {
  try {
    await redis.del(failuresKey(id), openUntilKey(id), lastFailureKey(id));
  } catch (err: any) {
    logger.warn(`[redisBreaker] recordSuccess Redis falhou: ${err.message}`);
  }
}

/**
 * Registra falha do provider. Erros 'client' (4xx do usuário) NÃO contam —
 * são problema de quem chamou, não do provider.
 *
 * Lógica:
 *   1. INCR counter (atômico). Se for o primeiro increment, SET TTL.
 *   2. Atualiza last_failure_at.
 *   3. Se counter >= THRESHOLD, SET open_until = now + OPEN_DURATION_MS.
 *
 * Fail-soft: erro de Redis só loga WARN.
 */
export async function recordFailure(id: string, kind: FailureKind): Promise<void> {
  // Erros de cliente (4xx input inválido) não contam contra o provider
  if (kind === 'client') return;

  const now = Date.now();
  try {
    // Atomic increment
    const failures = await redis.incr(failuresKey(id));

    // TTL: se primeiro incremento OU expirou, seta janela
    if (failures === 1) {
      await redis.expire(failuresKey(id), FAIL_WINDOW_SEC);
    }

    // Atualiza last_failure (informativo + debugging)
    await redis.set(lastFailureKey(id), String(now), 'EX', FAIL_WINDOW_SEC);

    if (failures >= FAIL_THRESHOLD) {
      const openUntil = now + OPEN_DURATION_MS;
      await redis.set(openUntilKey(id), String(openUntil), 'EX', OPEN_DURATION_SEC);
      logger.warn(
        `[redisBreaker] BREAKER OPEN provider=${id} failures=${failures} kind=${kind} openUntil=${new Date(openUntil).toISOString()}`,
      );
    } else {
      logger.info(
        `[redisBreaker] failure recorded provider=${id} failures=${failures}/${FAIL_THRESHOLD} kind=${kind}`,
      );
    }
  } catch (err: any) {
    logger.warn(`[redisBreaker] recordFailure Redis falhou: ${err.message}`);
  }
}

/**
 * Snapshot do estado do breaker — pra healthcheck `/api/admin/llm-status`.
 * Retorna `{ failures, openUntil, isOpen }`. Fail-open em erro de Redis.
 */
export async function getBreakerState(id: string): Promise<{
  failures: number;
  openUntil: number | null;
  isOpen: boolean;
}> {
  try {
    const [failuresRaw, openUntilRaw] = await Promise.all([
      redis.get(failuresKey(id)),
      redis.get(openUntilKey(id)),
    ]);
    const failures = failuresRaw ? Number(failuresRaw) || 0 : 0;
    const openUntil = openUntilRaw ? Number(openUntilRaw) || null : null;
    const isOpen = openUntil != null && Date.now() < openUntil;
    return { failures, openUntil, isOpen };
  } catch (err: any) {
    logger.warn(`[redisBreaker] getBreakerState Redis falhou: ${err.message}`);
    return { failures: 0, openUntil: null, isOpen: false };
  }
}

/**
 * Hook de teste: zera TODOS os breakers conhecidos. Uso restrito a Vitest.
 * Em prod, breakers expiram naturalmente pelo TTL.
 *
 * Aceita lista de provider IDs pra apagar especificamente — evita SCAN/DEL
 * em produção acidental.
 */
export async function __resetBreakersForTest(providerIds: string[]): Promise<void> {
  try {
    const keys = providerIds.flatMap((id) => [
      failuresKey(id),
      openUntilKey(id),
      lastFailureKey(id),
    ]);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err: any) {
    logger.warn(`[redisBreaker] resetForTest falhou: ${err.message}`);
  }
}
