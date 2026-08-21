/**
 * conversationExpiryService.test.ts — expiração de conversa por 72h
 * ============================================================================
 * Resposta Meta out/2026: conversa OPEN/WAITING parada 72h fecha sozinha com
 * closeReason 'auto_72h' e dá borda temporal à unidade "atendimento de IA".
 * ASSIGNED nunca fecha aqui: humano no comando decide quando encerrar.
 *
 * Cobertura:
 *   ✓ fecha OPEN/WAITING paradas 72h+ (CLOSED + closedAt + closeReason)
 *   ✓ ASSIGNED fica de fora do SELECT e do recheck do UPDATE (corrida)
 *   ✓ conversa com mensagem recente fica de fora (NOT EXISTS na janela)
 *   ✓ processa em lotes de 500 até esgotar e soma o total
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const findManyMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    conversation: {
      findMany: (...a: any[]) => findManyMock(...a),
      updateMany: (...a: any[]) => updateManyMock(...a),
    },
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { runConversationExpiryCycle, EXPIRY_HOURS } = await import(
  './conversationExpiryService.js'
);

const AGORA = new Date('2026-08-20T12:00:00.000Z');
const CORTE = new Date(AGORA.getTime() - EXPIRY_HOURS * 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runConversationExpiryCycle', () => {
  it('fecha OPEN/WAITING paradas 72h+ com CLOSED, closedAt e closeReason auto_72h', async () => {
    findManyMock.mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }]);
    updateManyMock.mockResolvedValueOnce({ count: 2 });

    const r = await runConversationExpiryCycle();

    expect(r.conversationsClosed).toBe(2);
    expect(updateManyMock).toHaveBeenCalledTimes(1);
    const update = updateManyMock.mock.calls[0][0];
    expect(update.where.id).toEqual({ in: ['c1', 'c2'] });
    expect(update.data.status).toBe('CLOSED');
    expect(update.data.closeReason).toBe('auto_72h');
    expect(update.data.closedAt).toEqual(AGORA);
  });

  it('ASSIGNED nunca entra: SELECT e UPDATE só aceitam OPEN/WAITING', async () => {
    findManyMock.mockResolvedValueOnce([{ id: 'c1' }]);
    updateManyMock.mockResolvedValueOnce({ count: 1 });

    await runConversationExpiryCycle();

    expect(findManyMock.mock.calls[0][0].where.status).toEqual({ in: ['OPEN', 'WAITING'] });
    // Recheck no UPDATE: cobre a corrida em que um humano assume no meio.
    expect(updateManyMock.mock.calls[0][0].where.status).toEqual({ in: ['OPEN', 'WAITING'] });
  });

  it('corrida SELECT→UPDATE: humano assumiu no meio, nada fecha e o ciclo encerra', async () => {
    findManyMock.mockResolvedValueOnce([{ id: 'c1' }]);
    updateManyMock.mockResolvedValueOnce({ count: 0 }); // virou ASSIGNED entre as queries

    const r = await runConversationExpiryCycle();

    expect(r.conversationsClosed).toBe(0);
    expect(findManyMock).toHaveBeenCalledTimes(1); // não fica em loop
  });

  it('conversa com mensagem recente fica de fora: NOT EXISTS na janela de 72h', async () => {
    findManyMock.mockResolvedValueOnce([]);

    const r = await runConversationExpiryCycle();

    expect(r.conversationsClosed).toBe(0);
    expect(updateManyMock).not.toHaveBeenCalled();
    const where = findManyMock.mock.calls[0][0].where;
    // Nenhuma mensagem desde o corte — resolve pelo índice (conversationId, createdAt).
    expect(where.messages).toEqual({ none: { createdAt: { gte: CORTE } } });
    // Conversa recém-criada (ainda sem mensagem) não conta como parada.
    expect(where.createdAt).toEqual({ lt: CORTE });
    // Soft-delete LGPD fica intocado.
    expect(where.deletedAt).toBeNull();
  });

  it('processa em lotes de 500 até esgotar e soma o total fechado', async () => {
    const lote1 = Array.from({ length: 500 }, (_, i) => ({ id: `a${i}` }));
    const lote2 = Array.from({ length: 120 }, (_, i) => ({ id: `b${i}` }));
    findManyMock.mockResolvedValueOnce(lote1).mockResolvedValueOnce(lote2);
    updateManyMock
      .mockResolvedValueOnce({ count: 500 })
      .mockResolvedValueOnce({ count: 120 });

    const r = await runConversationExpiryCycle();

    expect(r.conversationsClosed).toBe(620);
    expect(r.batches).toBe(2);
    expect(findManyMock).toHaveBeenCalledTimes(2); // 2º lote < 500 encerra o loop
    expect(findManyMock.mock.calls[0][0].take).toBe(500);
  });
});
