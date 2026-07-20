/* ══════════════════════════════════════════════════════════════════════
 * socketAdapter — liga o Socket.io ao Redis pra emits cruzarem instâncias
 *
 * Sem isto, com >=2 máquinas no Fly, metade dos emits se perde (a barra do
 * Maestro trava, new_message/notificações ficam intermitentes). O teste trava
 * duas coisas que não podem regredir silenciosamente:
 *   1) A FIAÇÃO: pub + sub dedicados (sub é duplicata), createAdapter no io.
 *      Se alguém tirar o adapter, o produto volta a perder eventos em prod sem
 *      erro nenhum — só um teste pega isso.
 *   2) O FAIL-SOFT: Redis fora do ar não pode derrubar o boot da API.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { RedisMock, createAdapterMock, envObj } = vi.hoisted(() => {
  class RedisMock {
    url: string;
    opts: any;
    isDuplicate = false;
    handlers: Record<string, (...a: any[]) => void> = {};
    quit = vi.fn(async () => {});
    constructor(url: string, opts: any) {
      this.url = url;
      this.opts = opts;
      (RedisMock as any).instances.push(this);
    }
    duplicate() {
      const d = new RedisMock(this.url, this.opts);
      d.isDuplicate = true;
      return d;
    }
    on(ev: string, fn: (...a: any[]) => void) {
      this.handlers[ev] = fn;
      return this;
    }
  }
  (RedisMock as any).instances = [] as any[];
  return {
    RedisMock,
    createAdapterMock: vi.fn(() => 'ADAPTER_FACTORY'),
    envObj: { REDIS_URL: 'redis://localhost:6379' } as { REDIS_URL: string },
  };
});

vi.mock('ioredis', () => ({ default: RedisMock }));
vi.mock('@socket.io/redis-adapter', () => ({ createAdapter: createAdapterMock }));
vi.mock('../config/env.js', () => ({ env: envObj }));
vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { setupSocketAdapter } from './socketAdapter.js';

const instances = () => (RedisMock as any).instances as any[];
const fakeIo = () => ({ adapter: vi.fn() }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  instances().length = 0;
  envObj.REDIS_URL = 'redis://localhost:6379';
  createAdapterMock.mockReturnValue('ADAPTER_FACTORY');
});

describe('setupSocketAdapter', () => {
  it('liga o adapter no io com pub + sub DEDICADOS (sub = duplicata do pub)', () => {
    const io = fakeIo();
    const clients = setupSocketAdapter(io);

    expect(createAdapterMock).toHaveBeenCalledOnce();
    expect(io.adapter).toHaveBeenCalledWith('ADAPTER_FACTORY');
    expect(clients).not.toBeNull();
    // Duas conexões: o cliente de subscribe entra em modo assinante e não pode
    // rodar comandos normais, então NÃO dá pra reusar uma só.
    expect(instances()).toHaveLength(2);
    expect(clients!.pubClient).not.toBe(clients!.subClient);
    expect((clients!.subClient as any).isDuplicate).toBe(true);
    expect((clients!.pubClient as any).isDuplicate).toBe(false);
  });

  it('registra handler de erro em pub e sub (erro de Redis não derruba o processo)', () => {
    const clients = setupSocketAdapter(fakeIo());
    // Sem esse handler, um evento "error" sem listener viraria exceção não
    // tratada e mataria a API.
    expect(typeof (clients!.pubClient as any).handlers.error).toBe('function');
    expect(typeof (clients!.subClient as any).handlers.error).toBe('function');
  });

  it('só usa TLS em rediss:// (Upstash/Redis Cloud), nunca em redis://', () => {
    envObj.REDIS_URL = 'redis://plain:6379';
    setupSocketAdapter(fakeIo());
    expect(instances()[0].opts.tls).toBeUndefined();

    instances().length = 0;
    envObj.REDIS_URL = 'rediss://secure:6379';
    setupSocketAdapter(fakeIo());
    expect(instances()[0].opts.tls).toEqual({ rejectUnauthorized: true });
  });

  it('FAIL-SOFT: se ligar o adapter explode, retorna null e NÃO propaga (boot não cai)', () => {
    createAdapterMock.mockImplementationOnce(() => {
      throw new Error('redis unreachable');
    });
    const io = fakeIo();
    let clients: unknown;
    // A API tem que subir mesmo sem Redis — só perde o cross-instância.
    expect(() => {
      clients = setupSocketAdapter(io);
    }).not.toThrow();
    expect(clients).toBeNull();
    expect(io.adapter).not.toHaveBeenCalled();
  });
});
