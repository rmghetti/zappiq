/**
 * metaCosts.util.test.ts · Conta Clara beta (Resposta Meta out/2026, PR-J).
 * ============================================================================
 * Cobre a agregação pura do extrato de custo Meta:
 *  - soma por categoria conta SÓ billable=true (null e false ficam fora);
 *  - freeBreakdown conta billable=false por pricingType;
 *  - service antes de 01/10/2026 sai a R$ 0 e a partir de 01/10 é tarifado
 *    (vigência resolvida pela DATA de cada evento, deliveredAt com fallback
 *    statusTs/createdAt);
 *  - projeção linear (mês corrente, mês fechado, mês futuro);
 *  - máscara de telefone nunca expõe o número inteiro.
 * Linhas injetadas no lugar do Prisma, mesmo padrão do billingUsage.util.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  computeMetaCosts,
  computeProjection,
  daysInMonthUtc,
  effectiveEventDate,
  maskPhoneBr,
  monthRangeUtc,
  parseMonthParam,
  TOP_CONVERSATIONS_SIZE,
  type MetaCostEventRow,
} from './metaCosts.util.js';

/** Linha do ledger com defaults de mensagem utility entregue em 10/09/2026. */
function row(overrides: Partial<MetaCostEventRow> = {}): MetaCostEventRow {
  return {
    category: 'utility',
    billable: true,
    pricingType: 'regular',
    deliveredAt: new Date('2026-09-10T12:00:00Z'),
    statusTs: new Date('2026-09-10T11:59:00Z'),
    createdAt: new Date('2026-09-10T11:58:00Z'),
    conversationId: null,
    ...overrides,
  };
}

// Tarifas BRL da vigência 01/07/2026 (metaRateCard): marketing 0.3217,
// utility/authentication 0.035, service 0. A partir de 01/10 service 0.035.

describe('computeMetaCosts: soma por categoria só billable', () => {
  it('conta e precifica apenas billable=true; false e null ficam fora do custo', () => {
    const now = new Date('2026-09-20T12:00:00Z');
    const rows: MetaCostEventRow[] = [
      row(),
      row(),
      row(),
      row({ category: 'marketing' }),
      // Janela grátis: NÃO entra em byCategory nem no total.
      row({ billable: false, pricingType: 'free_customer_service', category: 'service' }),
      // Status sem pricing (ex.: read): billable null, fora de tudo.
      row({ billable: null, pricingType: null, category: null }),
    ];

    const r = computeMetaCosts('2026-09', rows, now);

    expect(r.byCategory).toEqual([
      { category: 'marketing', count: 1, costBrl: 0.3217 },
      { category: 'utility', count: 3, costBrl: 0.105 },
    ]);
    expect(r.totalBrl).toBe(0.4267);
    // A linha grátis foi pro freeBreakdown, não pro extrato pago.
    expect(r.freeBreakdown).toEqual({ freeEntryPoint: 0, freeCustomerService: 1 });
  });

  it('categoria desconhecida conta com custo zero (não inventa tarifa)', () => {
    const r = computeMetaCosts(
      '2026-09',
      [row({ category: 'promocional_nova' })],
      new Date('2026-09-20T12:00:00Z'),
    );
    expect(r.byCategory).toEqual([{ category: 'promocional_nova', count: 1, costBrl: 0 }]);
    expect(r.totalBrl).toBe(0);
  });
});

describe('computeMetaCosts: service grátis antes de 01/10 e tarifado depois', () => {
  it('service em setembro/2026 sai com contagem real e R$ 0', () => {
    const rows = [
      row({ category: 'service', deliveredAt: new Date('2026-09-15T10:00:00Z') }),
      row({ category: 'service', deliveredAt: new Date('2026-09-16T10:00:00Z') }),
    ];
    const r = computeMetaCosts('2026-09', rows, new Date('2026-09-20T12:00:00Z'));
    expect(r.byCategory).toEqual([{ category: 'service', count: 2, costBrl: 0 }]);
    expect(r.totalBrl).toBe(0);
  });

  it('service a partir de 01/10/2026 usa a vigência nova (0.035/msg)', () => {
    const rows = [
      row({
        category: 'service',
        deliveredAt: new Date('2026-10-05T10:00:00Z'),
        statusTs: new Date('2026-10-05T10:00:00Z'),
        createdAt: new Date('2026-10-05T10:00:00Z'),
      }),
    ];
    const r = computeMetaCosts('2026-10', rows, new Date('2026-10-10T12:00:00Z'));
    expect(r.byCategory).toEqual([{ category: 'service', count: 1, costBrl: 0.035 }]);
    expect(r.totalBrl).toBe(0.035);
  });

  it('a vigência vem da data do EVENTO: statusTs decide quando não houve entrega', () => {
    // Sem deliveredAt, o statusTs de 02/10 já cai na vigência de outubro.
    const rows = [
      row({
        category: 'service',
        deliveredAt: null,
        statusTs: new Date('2026-10-02T09:00:00Z'),
        createdAt: new Date('2026-09-30T23:00:00Z'),
      }),
    ];
    const r = computeMetaCosts('2026-10', rows, new Date('2026-10-10T12:00:00Z'));
    expect(r.byDay).toEqual([{ date: '2026-10-02', count: 1, costBrl: 0.035 }]);
  });
});

describe('computeMetaCosts: freeBreakdown por pricingType', () => {
  it('separa free_entry_point de free_customer_service', () => {
    const rows = [
      row({ billable: false, pricingType: 'free_entry_point', category: 'service' }),
      row({ billable: false, pricingType: 'free_entry_point', category: 'marketing' }),
      row({ billable: false, pricingType: 'free_customer_service', category: 'service' }),
    ];
    const r = computeMetaCosts('2026-09', rows, new Date('2026-09-20T12:00:00Z'));
    expect(r.freeBreakdown).toEqual({ freeEntryPoint: 2, freeCustomerService: 1 });
    expect(r.byCategory).toEqual([]);
    expect(r.totalBrl).toBe(0);
  });
});

describe('computeMetaCosts: byDay e topConversations', () => {
  it('agrupa por dia UTC em ordem cronológica', () => {
    const rows = [
      row({ deliveredAt: new Date('2026-09-12T23:30:00Z') }),
      row({ deliveredAt: new Date('2026-09-10T08:00:00Z') }),
      row({ deliveredAt: new Date('2026-09-12T01:00:00Z'), category: 'marketing' }),
    ];
    const r = computeMetaCosts('2026-09', rows, new Date('2026-09-20T12:00:00Z'));
    expect(r.byDay).toEqual([
      { date: '2026-09-10', count: 1, costBrl: 0.035 },
      { date: '2026-09-12', count: 2, costBrl: 0.3567 },
    ]);
  });

  it('ranqueia conversas por custo, ignora grátis e corta no top 10', () => {
    const rows: MetaCostEventRow[] = [
      // conv-a: 2 marketing = 0.6434 (mais cara).
      row({ conversationId: 'conv-a', category: 'marketing' }),
      row({ conversationId: 'conv-a', category: 'marketing' }),
      // conv-b: 3 utility = 0.105.
      row({ conversationId: 'conv-b' }),
      row({ conversationId: 'conv-b' }),
      row({ conversationId: 'conv-b' }),
      // Grátis não entra no ranking pago.
      row({ conversationId: 'conv-free', billable: false, pricingType: 'free_customer_service' }),
      // 11 conversas de 1 utility cada pra estourar o corte de 10.
      ...Array.from({ length: 11 }, (_, i) => row({ conversationId: `conv-extra-${String(i).padStart(2, '0')}` })),
    ];
    const r = computeMetaCosts('2026-09', rows, new Date('2026-09-20T12:00:00Z'));

    expect(r.topConversations).toHaveLength(TOP_CONVERSATIONS_SIZE);
    expect(r.topConversations[0]).toEqual({ conversationId: 'conv-a', count: 2, costBrl: 0.6434 });
    expect(r.topConversations[1]).toEqual({ conversationId: 'conv-b', count: 3, costBrl: 0.105 });
    expect(r.topConversations.some((t) => t.conversationId === 'conv-free')).toBe(false);
  });
});

describe('computeProjection: linear', () => {
  it('mês corrente: total ÷ dias corridos × dias do mês', () => {
    const p = computeProjection('2026-08', 10, new Date('2026-08-10T15:00:00Z'));
    expect(p).toEqual({ projectedTotalBrl: 31, daysElapsed: 10, daysInMonth: 31 });
  });

  it('mês fechado projeta o próprio total; mês futuro projeta zero', () => {
    const now = new Date('2026-08-20T12:00:00Z');
    expect(computeProjection('2026-07', 12.5, now)).toEqual({
      projectedTotalBrl: 12.5,
      daysElapsed: 31,
      daysInMonth: 31,
    });
    expect(computeProjection('2026-09', 99, now)).toEqual({
      projectedTotalBrl: 0,
      daysElapsed: 0,
      daysInMonth: 30,
    });
  });

  it('computeMetaCosts injeta a projeção no resultado', () => {
    const r = computeMetaCosts('2026-09', [row(), row()], new Date('2026-09-15T12:00:00Z'));
    // 2 utility = 0.07 em 15 dias -> 0.14 no mês de 30 dias.
    expect(r.projection).toEqual({ projectedTotalBrl: 0.14, daysElapsed: 15, daysInMonth: 30 });
  });
});

describe('maskPhoneBr: telefone nunca sai inteiro', () => {
  it('celular BR vira +55 DD 9****-XXXX', () => {
    expect(maskPhoneBr('+5511987654321')).toBe('+55 11 9****-4321');
    expect(maskPhoneBr('5511987654321')).toBe('+55 11 9****-4321');
  });

  it('fixo BR (8 dígitos locais) também mascara o miolo', () => {
    expect(maskPhoneBr('551134567890')).toBe('+55 11 3***-7890');
  });

  it('formato não-BR mostra só os últimos 4 dígitos', () => {
    const masked = maskPhoneBr('12025550123');
    expect(masked).toBe('*******0123');
  });

  it('nunca contém o miolo do número original', () => {
    const original = '5511987654321';
    const masked = maskPhoneBr(original)!;
    expect(masked).not.toContain('98765');
    expect(masked.replace(/\D+/g, '')).not.toBe(original);
  });

  it('vazio ou curto demais devolve null (não tenta mascarar)', () => {
    expect(maskPhoneBr(null)).toBeNull();
    expect(maskPhoneBr('')).toBeNull();
    expect(maskPhoneBr('1234567')).toBeNull();
  });
});

describe('parseMonthParam / monthRangeUtc / effectiveEventDate', () => {
  it('sem month cai no mês corrente UTC; válido passa; inválido devolve null', () => {
    const now = new Date('2026-08-20T12:00:00Z');
    expect(parseMonthParam(undefined, now)).toBe('2026-08');
    expect(parseMonthParam('', now)).toBe('2026-08');
    expect(parseMonthParam('2026-07', now)).toBe('2026-07');
    expect(parseMonthParam('2026-13', now)).toBeNull();
    expect(parseMonthParam('2026-1', now)).toBeNull();
    expect(parseMonthParam('agora', now)).toBeNull();
    expect(parseMonthParam(123, now)).toBeNull();
  });

  it('monthRangeUtc cobre [1º dia, 1º dia do mês seguinte) em UTC', () => {
    const { start, end } = monthRangeUtc('2026-09');
    expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(daysInMonthUtc('2026-02')).toBe(28);
    expect(daysInMonthUtc('2028-02')).toBe(29);
  });

  it('data efetiva: deliveredAt, senão statusTs, senão createdAt', () => {
    const delivered = new Date('2026-09-10T12:00:00Z');
    const status = new Date('2026-09-11T12:00:00Z');
    const created = new Date('2026-09-12T12:00:00Z');
    expect(effectiveEventDate(row({ deliveredAt: delivered, statusTs: status, createdAt: created }))).toBe(delivered);
    expect(effectiveEventDate(row({ deliveredAt: null, statusTs: status, createdAt: created }))).toBe(status);
    expect(effectiveEventDate(row({ deliveredAt: null, statusTs: null, createdAt: created }))).toBe(created);
  });
});
