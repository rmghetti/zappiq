/* ══════════════════════════════════════════════════════════════════════
 * V2-024 · rlsTenant.test.ts (Sprint 0 Blocker 4)
 * --------------------------------------------------------------------
 * Testes unit do helper withTenant. Mocka prisma.$transaction +
 * tx.$executeRawUnsafe pra validar que:
 *   - SET LOCAL é chamado com o orgId correto antes de qualquer query
 *   - Callback recebe o tx (transaction client)
 *   - Erro de orgId ausente lança claramente
 *   - Erro de orgId inválido lança via setTenantContext
 *   - Resultado da callback é propagado
 *
 * Integration test com Postgres real (isolation entre 2 tenants) fica
 * pra Onda 3 (precisa CI com Postgres + RLS habilitado).
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma antes de importar o middleware
const mockExecuteRaw = vi.fn().mockResolvedValue(1);
const mockTransaction = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    $transaction: (fn: any) => mockTransaction(fn),
    $executeRawUnsafe: mockExecuteRaw,
  },
  Prisma: { TransactionClient: {} },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { withTenant, setTenantContext } from './rlsTenant.js';

describe('setTenantContext', () => {
  beforeEach(() => {
    mockExecuteRaw.mockClear();
  });

  it('emite SET LOCAL com o orgId formatado entre aspas simples', async () => {
    const tx = { $executeRawUnsafe: mockExecuteRaw };
    await setTenantContext(tx as any, 'cmo1ywwfe00ko1jskexiexsm4');
    expect(mockExecuteRaw).toHaveBeenCalledWith(
      "SET LOCAL app.current_organization_id = 'cmo1ywwfe00ko1jskexiexsm4'",
    );
  });

  it('rejeita orgId inválido (curto demais)', async () => {
    const tx = { $executeRawUnsafe: mockExecuteRaw };
    await expect(setTenantContext(tx as any, 'short')).rejects.toThrow(
      /invalid organizationId format/,
    );
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('rejeita orgId com SQL injection', async () => {
    const tx = { $executeRawUnsafe: mockExecuteRaw };
    await expect(
      setTenantContext(tx as any, "abc'; DROP TABLE users; --"),
    ).rejects.toThrow(/invalid organizationId format/);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('aceita cuid maiúsculo/minúsculo', async () => {
    const tx = { $executeRawUnsafe: mockExecuteRaw };
    await setTenantContext(tx as any, 'AbCdEfGhIjKlMnOpQrStUv');
    expect(mockExecuteRaw).toHaveBeenCalled();
  });
});

describe('withTenant', () => {
  beforeEach(() => {
    mockExecuteRaw.mockClear();
    mockTransaction.mockReset();
  });

  it('lança erro se req.organizationId ausente', async () => {
    await expect(withTenant({}, async () => 'never reached')).rejects.toThrow(
      /req.organizationId ausente/,
    );
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('chama prisma.$transaction com callback', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = { $executeRawUnsafe: mockExecuteRaw, contact: { findMany: vi.fn() } };
      return fn(tx);
    });

    await withTenant(
      { organizationId: 'cmo1ywwfe00ko1jskexiexsm4' },
      async (tx) => {
        return 'result-from-callback';
      },
    );
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it('chama setTenantContext ANTES de invocar a callback do usuário', async () => {
    const callOrder: string[] = [];
    mockExecuteRaw.mockImplementation(async () => {
      callOrder.push('SET LOCAL');
      return 1;
    });
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        $executeRawUnsafe: mockExecuteRaw,
        contact: { findMany: vi.fn().mockImplementation(() => { callOrder.push('findMany'); return []; }) },
      };
      return fn(tx);
    });

    await withTenant(
      { organizationId: 'cmo1ywwfe00ko1jskexiexsm4' },
      async (tx: any) => tx.contact.findMany(),
    );
    expect(callOrder).toEqual(['SET LOCAL', 'findMany']);
  });

  it('propaga resultado da callback', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = { $executeRawUnsafe: mockExecuteRaw };
      return fn(tx);
    });
    const result = await withTenant(
      { organizationId: 'cmo1ywwfe00ko1jskexiexsm4' },
      async () => ({ found: 42 }),
    );
    expect(result).toEqual({ found: 42 });
  });

  it('propaga erros da callback (rollback automático)', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = { $executeRawUnsafe: mockExecuteRaw };
      return fn(tx);
    });
    await expect(
      withTenant({ organizationId: 'cmo1ywwfe00ko1jskexiexsm4' }, async () => {
        throw new Error('domain error');
      }),
    ).rejects.toThrow(/domain error/);
  });
});
