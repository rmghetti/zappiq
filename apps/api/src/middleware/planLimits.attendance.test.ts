/**
 * planLimits.attendance.test.ts — metering SOMBRA do atendimento de IA
 * ============================================================================
 * Resposta Meta out/2026: recordAttendanceShadow marca a conversa como
 * atendimento (SET NX, TTL 90d) e incrementa aiAttendancesPerMonth só quando
 * o marcador é NOVO. Fair use de 12: a 13ª resposta abre a parte :2 e conta
 * atendimento novo. Sombra pura — nunca bloqueia, nunca lança.
 *
 * Cobertura:
 *   ✓ 1 conversa = 1 atendimento (respostas dentro do fair use não duplicam)
 *   ✓ 13ª resposta vira o 2º atendimento; 25ª vira o 3º
 *   ✓ idempotente: marcador pré-existente não incrementa de novo
 *   ✓ conversas distintas contam separado
 *   ✓ backend de cache fora do ar → não lança e não conta
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/env.js', () => ({
  env: { QUOTA_OVERAGE_MODE: 'audit_only', RESOURCE_LIMITS_MODE: 'audit_only' },
}));

vi.mock('@zappiq/database', () => ({
  prisma: { organization: { findUnique: vi.fn() } },
}));

vi.mock('../services/quotaOverageService.js', () => ({
  reportOverageMeterEvent: vi.fn(async () => ({ reported: false, skipped: 'mode_audit_only' })),
  estimateOverageBrl: (n: number) => n * 0.03,
}));

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── cache em memória com a MESMA semântica fail-soft do ICache ───────────
const store = new Map<string, string>();
let backendFora = false;

const incrby = vi.fn(async (key: string, amount = 1) => {
  if (backendFora) return null;
  const next = parseInt(store.get(key) ?? '0', 10) + amount;
  store.set(key, String(next));
  return next;
});
const setNX = vi.fn(async (key: string, value: string) => {
  if (backendFora) return null;
  if (store.has(key)) return false; // já existia — não cria
  store.set(key, value);
  return true;
});
const cacheGet = vi.fn(async (key: string) => (backendFora ? null : (store.get(key) ?? null)));
const expire = vi.fn(async () => !backendFora);

vi.mock('../services/cloud/index.js', () => ({
  cache: {
    incrby: (...a: any[]) => incrby(...(a as [string, number])),
    incrbyfloat: vi.fn(async () => 0),
    get: (...a: any[]) => cacheGet(...(a as [string])),
    expire: () => expire(),
    setNX: (...a: any[]) => setNX(...(a as [string, string, number])),
    del: vi.fn(async () => true),
    mget: vi.fn(async () => []),
    ping: vi.fn(async () => true),
  },
}));

const { recordAttendanceShadow, ATTENDANCE_FAIR_USE_REPLIES } = await import('./planLimits.js');

// Mesma conta de mês UTC do usageKey() (yyyy-mm).
const ym = new Date().toISOString().slice(0, 7);
const usageDe = (org: string) =>
  parseInt(store.get(`zappiq:usage:${org}:${ym}:aiAttendancesPerMonth`) ?? '0', 10);

beforeEach(() => {
  store.clear();
  backendFora = false;
  vi.clearAllMocks();
});

describe('recordAttendanceShadow — sombra pura, nunca cobra nem bloqueia', () => {
  it('1 conversa = 1 atendimento, mesmo com várias respostas dentro do fair use', async () => {
    for (let i = 0; i < ATTENDANCE_FAIR_USE_REPLIES; i++) {
      await recordAttendanceShadow('org-1', 'conv-1');
    }

    expect(usageDe('org-1')).toBe(1);
    expect(store.has('zappiq:att:org-1:conv-1')).toBe(true);
    expect(store.has('zappiq:att:org-1:conv-1:2')).toBe(false);
    // Marcador com TTL de 90 dias, mesma janela do webchat.
    expect(setNX.mock.calls[0][2]).toBe(90 * 24 * 3600);
  });

  it('13ª resposta abre a parte :2 e conta o 2º atendimento; 25ª conta o 3º', async () => {
    for (let i = 0; i < 12; i++) await recordAttendanceShadow('org-1', 'conv-1');
    expect(usageDe('org-1')).toBe(1);

    await recordAttendanceShadow('org-1', 'conv-1'); // 13ª resposta
    expect(usageDe('org-1')).toBe(2);
    expect(store.has('zappiq:att:org-1:conv-1:2')).toBe(true);

    for (let i = 14; i <= 24; i++) await recordAttendanceShadow('org-1', 'conv-1');
    expect(usageDe('org-1')).toBe(2); // 14ª..24ª seguem dentro da parte 2

    await recordAttendanceShadow('org-1', 'conv-1'); // 25ª resposta
    expect(usageDe('org-1')).toBe(3);
    expect(store.has('zappiq:att:org-1:conv-1:3')).toBe(true);
  });

  it('idempotente: marcador pré-existente (ex.: já contado pelo webchat) não conta de novo', async () => {
    store.set('zappiq:att:org-1:conv-1', '1'); // outra rota já marcou esta conversa

    await recordAttendanceShadow('org-1', 'conv-1');

    expect(usageDe('org-1')).toBe(0);
  });

  it('conversas distintas contam atendimentos separados', async () => {
    await recordAttendanceShadow('org-1', 'conv-1');
    await recordAttendanceShadow('org-1', 'conv-2');

    expect(usageDe('org-1')).toBe(2);
    expect(store.has('zappiq:att:org-1:conv-1')).toBe(true);
    expect(store.has('zappiq:att:org-1:conv-2')).toBe(true);
  });

  it('backend de cache fora do ar: não lança e não conta nada', async () => {
    backendFora = true;

    await expect(recordAttendanceShadow('org-1', 'conv-1')).resolves.toBeUndefined();

    expect(store.size).toBe(0);
    expect(setNX).not.toHaveBeenCalled(); // INCR devolveu null, sombra parou ali
  });
});
