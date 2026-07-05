/**
 * W2.3 — paginação de mensagens (janela deslizante das MAIS RECENTES).
 *
 * Teste puro (vitest, zero I/O) sobre os helpers extraídos do route handler.
 * Bug original: `orderBy asc + take limit` mostrava as N mensagens MAIS
 * ANTIGAS. A correção consulta `desc + take limit` (as MAIS RECENTES) e
 * reverte o array no retorno (payload cronológico ascendente).
 */
import { describe, it, expect } from 'vitest';
import {
  messagesQuerySchema,
  buildMessagesFindArgs,
  buildMessagesPayload,
} from './messages.pagination.js';

// ── schema ──────────────────────────────────────────────────────────────
describe('messagesQuerySchema', () => {
  it('aplica defaults (limit=50, sem before)', () => {
    const r = messagesQuerySchema.parse({});
    expect(r.limit).toBe(50);
    expect(r.before).toBeUndefined();
  });

  it('coage limit string → number e respeita o teto de 100', () => {
    expect(messagesQuerySchema.parse({ limit: '30' }).limit).toBe(30);
    expect(messagesQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(messagesQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });

  it('aceita cursor before', () => {
    expect(messagesQuerySchema.parse({ before: 'msg_10' }).before).toBe('msg_10');
  });
});

// ── buildMessagesFindArgs ───────────────────────────────────────────────
describe('buildMessagesFindArgs', () => {
  it('ordena DESC (mais recentes primeiro) e aplica take=limit', () => {
    const args = buildMessagesFindArgs('conv_1', { limit: 50 });
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(args.take).toBe(50);
    expect(args.where).toEqual({ conversationId: 'conv_1' });
    expect(args.cursor).toBeUndefined();
    expect(args.skip).toBeUndefined();
  });

  it('NÃO usa orderBy asc (regressão do bug: pegava as mais antigas)', () => {
    const args = buildMessagesFindArgs('conv_1', { limit: 100 });
    const orderBy = args.orderBy as Array<Record<string, string>>;
    expect(orderBy[0]!.createdAt).not.toBe('asc');
  });

  it('com before: usa cursor keyset + skip:1 para excluir a msg-âncora', () => {
    const args = buildMessagesFindArgs('conv_1', { limit: 20, before: 'msg_50' });
    expect(args.cursor).toEqual({ id: 'msg_50' });
    expect(args.skip).toBe(1);
    expect(args.take).toBe(20);
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });
});

// ── buildMessagesPayload ────────────────────────────────────────────────
// Simula uma conversa com 250 msgs (m0 = mais antiga … m249 = mais recente).
function fakeRow(i: number) {
  return { id: `m${i}`, createdAt: new Date(2026, 0, 1, 0, 0, i) };
}

describe('buildMessagesPayload', () => {
  it('reverte DESC → payload em ordem cronológica ASC', () => {
    // Query desc devolveria [m249, m248, ..., m200] (50 mais recentes)
    const desc = Array.from({ length: 50 }, (_, k) => fakeRow(249 - k));
    const { data } = buildMessagesPayload(desc, { limit: 50 });

    expect(data[0]!.id).toBe('m200'); // primeiro = mais antigo da janela
    expect(data[data.length - 1]!.id).toBe('m249'); // último = mais recente
    // estritamente crescente por createdAt
    for (let i = 1; i < data.length; i++) {
      expect(data[i]!.createdAt.getTime()).toBeGreaterThan(data[i - 1]!.createdAt.getTime());
    }
  });

  it('CORE FIX: conversa com >100 msgs mostra as MAIS RECENTES, não as mais antigas', () => {
    const desc = Array.from({ length: 100 }, (_, k) => fakeRow(249 - k)); // m249..m150
    const { data } = buildMessagesPayload(desc, { limit: 100 });
    // A mensagem mais recente do sistema (m249) TEM que estar no payload.
    expect(data.some((m) => m.id === 'm249')).toBe(true);
    // E a mais antiga do sistema (m0) NÃO deve estar (bug antigo mostraria m0..m99).
    expect(data.some((m) => m.id === 'm0')).toBe(false);
  });

  it('página cheia → hasMore=true e nextBefore = msg mais antiga da janela', () => {
    const desc = Array.from({ length: 50 }, (_, k) => fakeRow(249 - k));
    const { hasMore, nextBefore } = buildMessagesPayload(desc, { limit: 50 });
    expect(hasMore).toBe(true);
    expect(nextBefore).toBe('m200'); // cursor para carregar anteriores
  });

  it('página parcial (fim do histórico) → hasMore=false', () => {
    const desc = Array.from({ length: 12 }, (_, k) => fakeRow(11 - k)); // só 12 < limit
    const { hasMore, nextBefore } = buildMessagesPayload(desc, { limit: 50 });
    expect(hasMore).toBe(false);
    expect(nextBefore).toBe('m0');
  });

  it('conversa vazia → data vazio, nextBefore null, hasMore false', () => {
    const { data, hasMore, nextBefore } = buildMessagesPayload([], { limit: 50 });
    expect(data).toEqual([]);
    expect(hasMore).toBe(false);
    expect(nextBefore).toBeNull();
  });

  it('não muta o array de entrada', () => {
    const desc = [fakeRow(2), fakeRow(1), fakeRow(0)];
    const snapshot = desc.map((r) => r.id);
    buildMessagesPayload(desc, { limit: 50 });
    expect(desc.map((r) => r.id)).toEqual(snapshot);
  });
});
