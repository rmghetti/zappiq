/**
 * metaBillingLedger.test.ts — ledger de custo Meta (Resposta Meta 2026, 8.1 item 1).
 * ============================================================================
 * ANTES os campos pricing/billable/category dos status callbacks eram jogados
 * fora; sem eles não há Conta Clara nem conciliação da fatura da Meta. Estes
 * testes provam o contrato do recordMetaBillingEvent:
 *   - upsert idempotente por wamid (reenvio da Meta não duplica);
 *   - delivered grava deliveredAt em first-touch (nunca regride);
 *   - status sem pricing (ex.: read) não explode nem apaga o que já foi gravado;
 *   - payload com pricing grava campos derivados + rawPricing cru;
 *   - best-effort: banco fora do ar não derruba o chamador.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const upsert = vi.fn();
const updateMany = vi.fn();
const msgFindUnique = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    metaBillingEvent: {
      upsert: (...a: unknown[]) => upsert(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
    message: {
      findUnique: (...a: unknown[]) => msgFindUnique(...a),
    },
  },
}));

const warn = vi.fn();
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: (...a: unknown[]) => warn(...a), error: vi.fn(), debug: vi.fn() },
}));

const { recordMetaBillingEvent } = await import('./metaBillingLedger.js');

const ORG = 'org-1';
const PHONE = 'phone-123';

/** Status callback típico de delivered, com pricing completo. */
function statusDelivered(over: Record<string, unknown> = {}) {
  return {
    id: 'wamid.LEDGER1',
    status: 'delivered',
    timestamp: '1759300000',
    recipient_id: '5511999999999',
    pricing: { billable: true, pricing_model: 'PMP', category: 'service', type: 'regular' },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  msgFindUnique.mockResolvedValue(null);
  upsert.mockResolvedValue({});
  updateMany.mockResolvedValue({ count: 1 });
});

describe('recordMetaBillingEvent — payload com pricing', () => {
  it('grava campos derivados + rawPricing cru, chaveado por wamid', async () => {
    await recordMetaBillingEvent(statusDelivered(), PHONE, ORG);

    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ wamid: 'wamid.LEDGER1' });
    expect(arg.create).toMatchObject({
      organizationId: ORG,
      wamid: 'wamid.LEDGER1',
      recipientId: '5511999999999',
      status: 'delivered',
      billable: true,
      pricingModel: 'PMP',
      category: 'service',
      pricingType: 'regular',
      phoneNumberId: PHONE,
      rawPricing: { billable: true, pricing_model: 'PMP', category: 'service', type: 'regular' },
    });
    expect(arg.create.statusTs).toEqual(new Date(1759300000 * 1000));
    // Sem Message correspondente, o vínculo fica nulo mas o evento é gravado.
    expect(arg.create.messageId).toBeNull();
    expect(arg.create.conversationId).toBeNull();
  });

  it('vincula messageId/conversationId quando o wamid é de Message nossa', async () => {
    msgFindUnique.mockResolvedValue({ id: 'msg-1', conversationId: 'conv-1' });
    await recordMetaBillingEvent(statusDelivered(), PHONE, ORG);

    expect(msgFindUnique).toHaveBeenCalledWith({
      where: { whatsappMessageId: 'wamid.LEDGER1' },
      select: { id: true, conversationId: true },
    });
    const arg = upsert.mock.calls[0][0];
    expect(arg.create).toMatchObject({ messageId: 'msg-1', conversationId: 'conv-1' });
    expect(arg.update).toMatchObject({ messageId: 'msg-1', conversationId: 'conv-1' });
  });

  it('falha no vínculo com Message não impede o registro (link é opcional)', async () => {
    msgFindUnique.mockRejectedValue(new Error('db lenta'));
    await recordMetaBillingEvent(statusDelivered(), PHONE, ORG);

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });
});

describe('recordMetaBillingEvent — idempotência por wamid', () => {
  it('reenvio do MESMO status upserta pela mesma chave única (não duplica)', async () => {
    await recordMetaBillingEvent(statusDelivered(), PHONE, ORG);
    await recordMetaBillingEvent(statusDelivered(), PHONE, ORG);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0][0].where).toEqual({ wamid: 'wamid.LEDGER1' });
    expect(upsert.mock.calls[1][0].where).toEqual({ wamid: 'wamid.LEDGER1' });
    // A segunda passagem também traz o branch update — é ele que a unique
    // constraint executa em vez de criar um segundo registro.
    expect(upsert.mock.calls[1][0].update).toBeDefined();
  });

  it('status sem wamid é no-op (nada a chavear)', async () => {
    await recordMetaBillingEvent({ status: 'delivered' }, PHONE, ORG);
    expect(upsert).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe('recordMetaBillingEvent — deliveredAt first-touch', () => {
  it('delivered grava deliveredAt com filtro deliveredAt:null (nunca regride)', async () => {
    await recordMetaBillingEvent(statusDelivered({ timestamp: '1759300000' }), PHONE, ORG);

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { wamid: 'wamid.LEDGER1', deliveredAt: null },
      data: { deliveredAt: new Date(1759300000 * 1000) },
    });

    // Reenvio com timestamp POSTERIOR: o filtro null continua — quem já tem
    // deliveredAt não é tocado, a primeira entrega fica registrada.
    await recordMetaBillingEvent(statusDelivered({ timestamp: '1759399999' }), PHONE, ORG);
    expect(updateMany.mock.calls[1][0].where).toEqual({
      wamid: 'wamid.LEDGER1',
      deliveredAt: null,
    });
  });

  it('status que não é delivered não mexe em deliveredAt', async () => {
    await recordMetaBillingEvent(statusDelivered({ status: 'sent' }), PHONE, ORG);
    await recordMetaBillingEvent(statusDelivered({ status: 'read', pricing: undefined }), PHONE, ORG);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('delivered sem timestamp usa o relógio local como fallback', async () => {
    const antes = Date.now();
    await recordMetaBillingEvent(statusDelivered({ timestamp: undefined }), PHONE, ORG);
    const depois = Date.now();

    const gravado: Date = updateMany.mock.calls[0][0].data.deliveredAt;
    expect(gravado.getTime()).toBeGreaterThanOrEqual(antes);
    expect(gravado.getTime()).toBeLessThanOrEqual(depois);
  });
});

describe('recordMetaBillingEvent — pricing ausente (ex.: status read)', () => {
  it('não explode e grava o evento sem os campos de pricing', async () => {
    await recordMetaBillingEvent(
      { id: 'wamid.SEMPRICING', status: 'read', timestamp: '1759300500' },
      PHONE,
      ORG,
    );

    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0][0];
    expect(arg.create.billable).toBeUndefined();
    expect(arg.create.rawPricing).toBeUndefined();
    // O UPDATE não pode carregar chaves de pricing: um read reenviado depois
    // do delivered apagaria billable/category/rawPricing já gravados.
    expect('billable' in arg.update).toBe(false);
    expect('category' in arg.update).toBe(false);
    expect('rawPricing' in arg.update).toBe(false);
  });

  it('pricing com campos faltando vira null campo a campo (sem quebrar)', async () => {
    await recordMetaBillingEvent(
      statusDelivered({ pricing: { category: 'utility' } }),
      PHONE,
      ORG,
    );
    const arg = upsert.mock.calls[0][0];
    expect(arg.create).toMatchObject({
      billable: null,
      pricingModel: null,
      category: 'utility',
      pricingType: null,
      rawPricing: { category: 'utility' },
    });
  });
});

describe('recordMetaBillingEvent — contrato best-effort', () => {
  it('banco fora do ar: resolve sem lançar e avisa no log', async () => {
    upsert.mockRejectedValue(new Error('db down'));
    await expect(recordMetaBillingEvent(statusDelivered(), PHONE, ORG)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('payload torto (null/undefined) é no-op silencioso', async () => {
    await expect(recordMetaBillingEvent(null, PHONE, ORG)).resolves.toBeUndefined();
    await expect(recordMetaBillingEvent(undefined, PHONE, ORG)).resolves.toBeUndefined();
    expect(upsert).not.toHaveBeenCalled();
  });
});
