/**
 * cotaDiaria.test.ts (A115, revisão de segurança do PR #369)
 * ============================================================================
 * A chave do contador virava do dia às 00:00 UTC, que em Brasília é 21:00. Quem
 * clicava às 22h de terça começava, na prática, a cota de quarta: o teto do dia
 * dobrava toda noite, justo no horário em que ninguém está olhando a conta.
 *
 * Aqui o relógio é falso e a virada é conferida nos dois lados: 22h de Brasília
 * ainda é o dia de hoje, e 21h de Brasília é a virada real.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const incrby = vi.fn(async () => 1);
const expire = vi.fn(async () => true);

vi.mock('../services/cloud/index.js', () => ({
  cache: { incrby: (...a: any[]) => incrby(...a), expire: (...a: any[]) => expire(...a) },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { chaveDaCotaDiaria, cotaDiaria, COTA_DIARIA_PADRAO } = await import('./cotaDiaria.js');

beforeEach(() => {
  vi.clearAllMocks();
  incrby.mockResolvedValue(1);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('chaveDaCotaDiaria: o dia é o de Brasília (P5)', () => {
  it('22h de Brasília ainda conta como o dia de hoje', () => {
    // 2026-09-15T01:00:00Z = 14/09 às 22:00 em Brasília.
    const agora = new Date('2026-09-15T01:00:00.000Z');
    expect(chaveDaCotaDiaria('org-1', 're-test', agora)).toBe(
      'zappiq:quota:org-1:re-test:2026-09-14',
    );
  });

  it('meia-noite de Brasília é a virada', () => {
    // 2026-09-15T02:59:00Z = 14/09 às 23:59; 03:00:00Z = 15/09 às 00:00.
    expect(chaveDaCotaDiaria('org-1', 're-test', new Date('2026-09-15T02:59:00.000Z'))).toBe(
      'zappiq:quota:org-1:re-test:2026-09-14',
    );
    expect(chaveDaCotaDiaria('org-1', 're-test', new Date('2026-09-15T03:00:00.000Z'))).toBe(
      'zappiq:quota:org-1:re-test:2026-09-15',
    );
  });

  it('meio-dia de Brasília não muda de dia', () => {
    expect(chaveDaCotaDiaria('org-1', 're-test', new Date('2026-09-14T15:00:00.000Z'))).toBe(
      'zappiq:quota:org-1:re-test:2026-09-14',
    );
  });
});

describe('cotaDiaria: o middleware usa a chave de Brasília', () => {
  function faz() {
    const req: any = { user: { organizationId: 'org-1' } };
    const res: any = { statusCode: 200, body: undefined };
    res.status = vi.fn((c: number) => {
      res.statusCode = c;
      return res;
    });
    res.json = vi.fn((b: any) => {
      res.body = b;
      return res;
    });
    return { req, res, next: vi.fn() };
  }

  it('às 22h de Brasília o contador é o mesmo do resto do dia', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T01:00:00.000Z')); // 14/09, 22:00 em Brasília
    const { req, res, next } = faz();

    await cotaDiaria('re-test')(req, res, next);

    expect(incrby).toHaveBeenCalledWith('zappiq:quota:org-1:re-test:2026-09-14', 1);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('acima do teto responde 429 e não chama o handler', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T01:00:00.000Z'));
    incrby.mockResolvedValue(COTA_DIARIA_PADRAO + 1);
    const { req, res, next } = faz();

    await cotaDiaria('re-test')(req, res, next);

    expect(res.statusCode).toBe(429);
    expect(next).not.toHaveBeenCalled();
  });
});
