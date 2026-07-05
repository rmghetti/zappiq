// Singleton de módulo pro Socket.io server.
//
// Motivo (W2.1): o BullMQ worker roda no MESMO processo do HTTP/Socket.io,
// mas o `io` não é serializável via Redis — o job não carrega a instância.
// Antes, o aiProcessWorker passava `io: undefined` ao agentOrchestrator, então
// os emits `new_message`/`notification` (todos gated por `if (io)`) nunca
// disparavam em background. O inbox só atualizava com F5 (refetch manual).
//
// Como o worker vive no mesmo processo em que o Socket.io server é criado
// (server.ts), basta expor a instância por um singleton de módulo: server.ts
// chama setIo(io) logo após criar o SocketIOServer, e o worker/orchestrator
// recupera com getIo(). Emits continuam gated por `if (io)`, então antes do
// setIo (ou em testes sem socket) tudo é no-op seguro.

import type { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | undefined;

/** Registra a instância global do Socket.io. Chamado uma vez no boot (server.ts). */
export function setIo(io: SocketIOServer): void {
  ioInstance = io;
}

/**
 * Recupera a instância global do Socket.io, ou undefined se ainda não setada.
 * Undefined é seguro: todos os emits são gated por `if (io)`.
 */
export function getIo(): SocketIOServer | undefined {
  return ioInstance;
}
