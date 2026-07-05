/* ══════════════════════════════════════════════════════════════════════
 * W2.1 · socketRegistry.test.ts
 * --------------------------------------------------------------------
 * Singleton de módulo que expõe o Socket.io server pro BullMQ worker
 * (mesmo processo, fora do contexto Express). Sem ele o worker passava
 * io: undefined e new_message/notification nunca disparavam (só F5).
 *
 * Cobre:
 *   - getIo() é undefined antes de qualquer setIo (default seguro)
 *   - setIo(io) → getIo() devolve a MESMA instância
 *   - setIo pode ser chamado de novo (última instância vence)
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Server as SocketIOServer } from 'socket.io';
import { setIo, getIo } from './socketRegistry.js';

// Fake mínimo — o registry só guarda/devolve a referência, não a usa.
function fakeIo(tag: string): SocketIOServer {
  return { __tag: tag } as unknown as SocketIOServer;
}

describe('socketRegistry (W2.1)', () => {
  beforeEach(() => {
    // Reseta pro estado inicial limpando a instância entre os testes.
    setIo(undefined as unknown as SocketIOServer);
  });

  it('getIo() é undefined antes de setIo (default seguro pra emits gated)', () => {
    expect(getIo()).toBeUndefined();
  });

  it('setIo(io) → getIo() devolve a MESMA instância (identidade referencial)', () => {
    const io = fakeIo('primeira');
    setIo(io);
    expect(getIo()).toBe(io);
  });

  it('setIo de novo substitui a instância (última vence)', () => {
    const io1 = fakeIo('boot-1');
    const io2 = fakeIo('boot-2');
    setIo(io1);
    expect(getIo()).toBe(io1);
    setIo(io2);
    expect(getIo()).toBe(io2);
    expect(getIo()).not.toBe(io1);
  });
});
