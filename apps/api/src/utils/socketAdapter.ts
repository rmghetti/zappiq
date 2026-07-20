import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Liga o Socket.io ao Redis (pub/sub) para que um emit alcance clientes
 * conectados em QUALQUER instância da API.
 * ============================================================================
 * POR QUÊ: o Fly roda a API em >=2 máquinas (min_machines_running=2). O adapter
 * PADRÃO do Socket.io é em memória — `io.to(room).emit()` só alcança os sockets
 * da MESMA máquina que executou o emit. Como o WebSocket do cliente fica preso
 * numa máquina (a conexão é sticky) mas cada requisição HTTP é balanceada, o
 * emit disparado por um POST caía com frequência numa máquina diferente da do
 * cliente e se perdia. Sintoma: a barra do Maestro travava na curva de
 * estimativa (os marcos `maestro_progress` não chegavam) e `new_message` /
 * notificações eram intermitentes.
 *
 * O adapter Redis publica cada emit num canal pub/sub; TODAS as máquinas
 * recebem e reentregam aos seus próprios sockets. Reaproveita o REDIS_URL que o
 * BullMQ já usa (ioredis), com conexões DEDICADAS (o cliente de subscribe entra
 * em modo assinante e não pode rodar comandos normais, então não dá pra
 * reutilizar o singleton do app).
 *
 * FAIL-SOFT: se o Redis não subir, loga e segue com o adapter em memória (o
 * mesmo comportamento de antes) — nunca derruba o boot. Tempo real é melhor com
 * o adapter, mas a API tem que subir mesmo sem ele.
 * ============================================================================
 */
export interface SocketAdapterClients {
  pubClient: Redis;
  subClient: Redis;
}

export function setupSocketAdapter(io: SocketIOServer): SocketAdapterClients | null {
  try {
    // TLS para Upstash/Redis Cloud (rediss://) — mesmo critério do utils/redis.ts.
    const opts = env.REDIS_URL.startsWith('rediss://')
      ? { tls: { rejectUnauthorized: true } }
      : {};

    const pubClient = new Redis(env.REDIS_URL, opts);
    const subClient = pubClient.duplicate();

    // Erro de Redis não pode derrubar o processo: loga e deixa o ioredis
    // reconectar. Sem o handler, um 'error' sem listener viraria exceção não
    // tratada e mataria a API.
    pubClient.on('error', (err) => logger.warn('[SocketAdapter:pub] Redis error:', err.message));
    subClient.on('error', (err) => logger.warn('[SocketAdapter:sub] Redis error:', err.message));

    io.adapter(createAdapter(pubClient, subClient));
    logger.info('[SocketAdapter] Redis adapter ativo — emits cruzam as instâncias');
    return { pubClient, subClient };
  } catch (err) {
    logger.error(
      '[SocketAdapter] Falha ao ligar o adapter Redis — seguindo com in-memory ' +
        '(emits NÃO cruzam instâncias):',
      err,
    );
    return null;
  }
}
