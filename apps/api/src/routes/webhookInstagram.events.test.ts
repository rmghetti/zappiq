/**
 * 14/08 — normalização dos dois formatos de entrega de DM do Instagram.
 * A rota Messenger entrega entry.messaging[]; a rota "API do Instagram com
 * login do Instagram" (app próprio ZappIQ-IG) entrega entry.changes[] com
 * field='messages' e o evento dentro de value. O incidente: assinatura ok e
 * DM ignorada em silêncio porque o loop só lia entry.messaging.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@zappiq/database', () => ({
  prisma: {
    contact: { update: vi.fn() },
    organization: { findFirst: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    message: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock('../services/instagramService.js', () => ({ getUserProfile: vi.fn() }));
vi.mock('../services/queueService.js', () => ({ aiProcessQueue: { add: vi.fn() } }));
vi.mock('../utils/redis.js', () => ({
  redis: { lpush: vi.fn(), ltrim: vi.fn(), lrange: vi.fn().mockResolvedValue([]) },
}));

import { extractIgMessagingEvents } from './webhookInstagram.js';

const msgEvent = (mid: string) => ({
  sender: { id: 'igsid-1' },
  recipient: { id: '178414' },
  timestamp: 1700000000,
  message: { mid, text: 'oi' },
});

describe('extractIgMessagingEvents — normalização das duas rotas', () => {
  it('rota Messenger: devolve entry.messaging como está', () => {
    const out = extractIgMessagingEvents({ id: '178414', messaging: [msgEvent('m1'), msgEvent('m2')] });
    expect(out).toHaveLength(2);
    expect(out[0].message.mid).toBe('m1');
  });

  it('rota API do Instagram: desembrulha changes[field=messages].value', () => {
    const out = extractIgMessagingEvents({
      id: '178414',
      changes: [
        { field: 'messages', value: msgEvent('m3') },
        { field: 'comments', value: { id: 'c1' } }, // outro field: ignorado
        { field: 'messages' }, // sem value: ignorado
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].message.mid).toBe('m3');
  });

  it('mistura das duas + entradas vazias', () => {
    const out = extractIgMessagingEvents({
      id: '178414',
      messaging: [msgEvent('m4')],
      changes: [{ field: 'messages', value: msgEvent('m5') }],
    });
    expect(out.map((e) => e.message.mid)).toEqual(['m4', 'm5']);
    expect(extractIgMessagingEvents({ id: 'x' })).toEqual([]);
    expect(extractIgMessagingEvents({})).toEqual([]);
  });
});
