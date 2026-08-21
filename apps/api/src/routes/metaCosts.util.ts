/**
 * metaCosts.util.ts · Conta Clara beta (Resposta Meta out/2026, PR-J).
 * ============================================================================
 * Agregação PURA do extrato de custo Meta por mensagem, em cima do ledger
 * meta_billing_events (gravado por metaBillingLedger a cada status callback).
 *
 * Regras centrais:
 *  - Só evento com billable === true entra na conta (contagem e custo).
 *    billable === false vira o freeBreakdown (janela grátis, por pricingType);
 *    billable === null é status sem bloco pricing (ex.: read) e fica fora.
 *  - Custo = contagem × tarifa do metaRateCard da CATEGORIA na DATA do evento.
 *    A data efetiva é deliveredAt, com fallback statusTs e por fim createdAt
 *    (a Meta cobra por mensagem entregue; o fallback cobre eventos que ainda
 *    não registraram a entrega).
 *  - Antes de 01/10/2026 a categoria service é grátis no rate card: o extrato
 *    mostra service com contagem real e R$ 0. A partir de 01/10 a vigência
 *    nova precifica automaticamente, porque a tarifa é resolvida pela data de
 *    cada evento, nunca por "hoje".
 *  - Projeção LINEAR do mês: total observado ÷ dias corridos × dias do mês.
 *    Ela herda a vigência dos DIAS consultados: um mês de setembro projeta
 *    com service a R$ 0 (vigência de setembro) e NÃO antecipa a tarifa de
 *    outubro; quem abrir outubro já vê a vigência de outubro. Mês encerrado
 *    projeta o próprio total; mês futuro projeta zero.
 *
 * Função pura + linhas injetadas (mesmo padrão do billingUsage.util): testável
 * sem Prisma real. A rota (metaCosts.ts) só busca as linhas do mês e faz o
 * join leve do nome do contato das top conversas.
 * ============================================================================
 */
import { estimateMetaCostBrl, type MetaBillingCategory } from '@zappiq/shared';

/** Projeção mínima de uma linha do ledger que a agregação precisa. */
export interface MetaCostEventRow {
  category: string | null;
  billable: boolean | null;
  pricingType: string | null;
  deliveredAt: Date | null;
  statusTs: Date | null;
  createdAt: Date;
  conversationId: string | null;
}

export interface MetaCostCategoryLine {
  category: string;
  count: number;
  costBrl: number;
}

export interface MetaCostDayLine {
  /** Dia UTC no formato YYYY-MM-DD. */
  date: string;
  count: number;
  costBrl: number;
}

export interface MetaCostProjection {
  projectedTotalBrl: number;
  daysElapsed: number;
  daysInMonth: number;
}

export interface MetaCostConversationLine {
  conversationId: string;
  count: number;
  costBrl: number;
}

export interface MetaCostsAggregation {
  month: string;
  totalBrl: number;
  byCategory: MetaCostCategoryLine[];
  byDay: MetaCostDayLine[];
  projection: MetaCostProjection;
  topConversations: MetaCostConversationLine[];
  freeBreakdown: { freeEntryPoint: number; freeCustomerService: number };
}

/** Quantas conversas entram no ranking de custo. */
export const TOP_CONVERSATIONS_SIZE = 10;

/** Ordem canônica das categorias no extrato (as demais vão ao final). */
const CATEGORY_ORDER: readonly string[] = ['marketing', 'utility', 'authentication', 'service'];

const KNOWN_CATEGORIES: ReadonlySet<string> = new Set(CATEGORY_ORDER);

function isKnownCategory(category: string | null): category is MetaBillingCategory {
  return category != null && KNOWN_CATEGORIES.has(category);
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
const round2 = (n: number) => Math.round(n * 1e2) / 1e2;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** YYYY-MM (UTC) de uma data. */
export function formatYearMonthUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Valida o query param `month`. Ausente/vazio cai no mês corrente (UTC);
 * formato inválido devolve null (a rota responde 400).
 */
export function parseMonthParam(raw: unknown, now: Date = new Date()): string | null {
  if (raw == null || raw === '') return formatYearMonthUtc(now);
  if (typeof raw !== 'string' || !MONTH_RE.test(raw)) return null;
  return raw;
}

/** Janela [1º dia do mês, 1º dia do mês seguinte) em UTC. */
export function monthRangeUtc(month: string): { start: Date; end: Date } {
  const [year, mon] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, mon - 1, 1)),
    end: new Date(Date.UTC(year, mon, 1)),
  };
}

/** Quantos dias tem o mês YYYY-MM. */
export function daysInMonthUtc(month: string): number {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon, 0)).getUTCDate();
}

/**
 * Data efetiva do evento pra tarifa e pro bucket diário: deliveredAt (a Meta
 * cobra por mensagem ENTREGUE), senão statusTs, senão createdAt.
 */
export function effectiveEventDate(row: MetaCostEventRow): Date {
  return row.deliveredAt ?? row.statusTs ?? row.createdAt;
}

/**
 * Máscara de telefone pro extrato: nunca devolve o número inteiro.
 * BR (55 + DDD + local): "+55 11 9****-4321" (1º dígito do local + últimos 4).
 * Outros formatos: só os últimos 4 dígitos visíveis. Curto demais: null.
 */
export function maskPhoneBr(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D+/g, '');
  if (digits.length < 8) return null;
  const last4 = digits.slice(-4);
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const local = digits.slice(4);
    const head = local.slice(0, 1);
    const maskedLen = Math.max(local.length - 5, 1);
    return `+55 ${ddd} ${head}${'*'.repeat(maskedLen)}-${last4}`;
  }
  return `${'*'.repeat(Math.max(digits.length - 4, 4))}${last4}`;
}

/**
 * Projeção linear do mês. `month` comparado com o mês de `now` (strings
 * YYYY-MM ordenam lexicograficamente):
 *  - mês passado: já fechou, projeção = total observado;
 *  - mês corrente: total ÷ dias corridos × dias do mês;
 *  - mês futuro: nada aconteceu, projeção 0.
 * A vigência do rate card NÃO entra aqui: ela já foi aplicada evento a evento
 * (data do evento), então a projeção reflete a vigência dos dias consultados.
 */
export function computeProjection(month: string, totalBrl: number, now: Date): MetaCostProjection {
  const daysInMonth = daysInMonthUtc(month);
  const nowMonth = formatYearMonthUtc(now);
  if (month < nowMonth) {
    return { projectedTotalBrl: round2(totalBrl), daysElapsed: daysInMonth, daysInMonth };
  }
  if (month > nowMonth) {
    return { projectedTotalBrl: 0, daysElapsed: 0, daysInMonth };
  }
  const daysElapsed = now.getUTCDate();
  const projectedTotalBrl = daysElapsed > 0 ? round2((totalBrl / daysElapsed) * daysInMonth) : 0;
  return { projectedTotalBrl, daysElapsed, daysInMonth };
}

/**
 * Agrega o extrato do mês a partir das linhas do ledger JÁ filtradas pela
 * janela do mês (a rota filtra por deliveredAt/statusTs/createdAt com a mesma
 * regra de fallback de effectiveEventDate).
 */
export function computeMetaCosts(
  month: string,
  rows: readonly MetaCostEventRow[],
  now: Date = new Date(),
): MetaCostsAggregation {
  // Célula categoria × dia: a tarifa é constante dentro do dia (vigências
  // começam à meia-noite UTC), então custo da célula = contagem × tarifa.
  const cells = new Map<string, { category: string; date: string; when: Date; count: number }>();
  const conversations = new Map<string, { count: number; costBrl: number }>();
  let freeEntryPoint = 0;
  let freeCustomerService = 0;

  for (const row of rows) {
    if (row.billable === false) {
      // Janela grátis: conta por pricingType, fora do custo.
      if (row.pricingType === 'free_entry_point') freeEntryPoint += 1;
      else if (row.pricingType === 'free_customer_service') freeCustomerService += 1;
      continue;
    }
    // billable null = status sem bloco pricing (ex.: read): fora do extrato.
    if (row.billable !== true) continue;

    const when = effectiveEventDate(row);
    const date = when.toISOString().slice(0, 10);
    // Categoria fora do rate card não inventa tarifa: conta com custo zero.
    const category = row.category ?? 'desconhecida';
    const key = `${category}|${date}`;
    const cell = cells.get(key);
    if (cell) cell.count += 1;
    else cells.set(key, { category, date, when, count: 1 });

    if (row.conversationId) {
      const unitCost = isKnownCategory(row.category)
        ? estimateMetaCostBrl(row.category, 1, when)
        : 0;
      const conv = conversations.get(row.conversationId);
      if (conv) {
        conv.count += 1;
        conv.costBrl += unitCost;
      } else {
        conversations.set(row.conversationId, { count: 1, costBrl: unitCost });
      }
    }
  }

  const byCategoryMap = new Map<string, { count: number; costBrl: number }>();
  const byDayMap = new Map<string, { count: number; costBrl: number }>();
  let totalBrl = 0;

  for (const cell of cells.values()) {
    const costBrl = isKnownCategory(cell.category)
      ? estimateMetaCostBrl(cell.category, cell.count, cell.when)
      : 0;
    totalBrl += costBrl;

    const cat = byCategoryMap.get(cell.category) ?? { count: 0, costBrl: 0 };
    cat.count += cell.count;
    cat.costBrl += costBrl;
    byCategoryMap.set(cell.category, cat);

    const day = byDayMap.get(cell.date) ?? { count: 0, costBrl: 0 };
    day.count += cell.count;
    day.costBrl += costBrl;
    byDayMap.set(cell.date, day);
  }

  const byCategory: MetaCostCategoryLine[] = [...byCategoryMap.entries()]
    .map(([category, agg]) => ({ category, count: agg.count, costBrl: round4(agg.costBrl) }))
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.category);
      const ib = CATEGORY_ORDER.indexOf(b.category);
      return (ia === -1 ? CATEGORY_ORDER.length : ia) - (ib === -1 ? CATEGORY_ORDER.length : ib)
        || a.category.localeCompare(b.category);
    });

  const byDay: MetaCostDayLine[] = [...byDayMap.entries()]
    .map(([date, agg]) => ({ date, count: agg.count, costBrl: round4(agg.costBrl) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const topConversations: MetaCostConversationLine[] = [...conversations.entries()]
    .map(([conversationId, agg]) => ({
      conversationId,
      count: agg.count,
      costBrl: round4(agg.costBrl),
    }))
    .sort((a, b) => b.costBrl - a.costBrl || b.count - a.count || a.conversationId.localeCompare(b.conversationId))
    .slice(0, TOP_CONVERSATIONS_SIZE);

  const total = round4(totalBrl);

  return {
    month,
    totalBrl: total,
    byCategory,
    byDay,
    projection: computeProjection(month, total, now),
    topConversations,
    freeBreakdown: { freeEntryPoint, freeCustomerService },
  };
}
