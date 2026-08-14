/**
 * Guarda a consolidação da conexão Redis das filas BullMQ.
 *
 * Contexto: a conta do Upstash bateu US$ 194 num mês porque 15 filas BullMQ
 * rodavam em 2 máquinas, cada worker ocioso gastando ~8 comandos a cada 5s.
 * Na investigação apareceu que o mesmo bloco `const connection = {...}` estava
 * copiado em 13 services, em 4 variantes já divergentes: as filas mais novas
 * tinham perdido retryStrategy e reconnectOnError pelo caminho.
 *
 * Este teste existe para a duplicação não voltar.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { IDLE_DRAIN_DELAY_SECONDS, queueConnection } from './queueRedis.js';

const SERVICES_DIR = join(import.meta.dirname, '..', 'services');

function tsFilesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsFilesIn(full);
    return entry.endsWith('.ts') && !entry.endsWith('.test.ts') ? [full] : [];
  });
}

describe('queueRedis — conexão única das filas', () => {
  it('carrega o tratamento de reconexão que só duas filas tinham antes', () => {
    expect(queueConnection.maxRetriesPerRequest).toBeNull();
    expect(queueConnection.enableReadyCheck).toBe(false);
    expect(queueConnection.keepAlive).toBe(10_000);
    expect(typeof queueConnection.retryStrategy).toBe('function');
    expect(typeof queueConnection.reconnectOnError).toBe('function');
  });

  it('desiste de reconectar depois de 30 tentativas e faz backoff crescente', () => {
    expect(queueConnection.retryStrategy(1)).toBe(300);
    expect(queueConnection.retryStrategy(10)).toBe(3_000);
    // Na 30ª tentativa o backoff é 9s, então o teto de 15s do Math.min nunca
    // chega a valer: a desistência em 30 tentativas corta antes. Documentado
    // aqui porque o teto passa a impressão de que existe espera de 15s.
    expect(queueConnection.retryStrategy(30)).toBe(9_000);
    expect(queueConnection.retryStrategy(31)).toBeNull();
  });

  it('só reconecta em erro transitório, não em erro de credencial', () => {
    expect(queueConnection.reconnectOnError(new Error('ECONNRESET'))).toBe(true);
    expect(queueConnection.reconnectOnError(new Error('READONLY'))).toBe(true);
    expect(queueConnection.reconnectOnError(new Error('WRONGPASS'))).toBe(false);
  });

  it('mantém o drainDelay acima do teto de 10s que o BullMQ aplica sozinho', () => {
    // Com job atrasado pendente o BullMQ ignora o drainDelay e limita o bloqueio
    // a maximumBlockTimeout = 10s. Abaixo disso a config não mudaria nada.
    expect(IDLE_DRAIN_DELAY_SECONDS).toBeGreaterThan(10);
  });

  it('nenhum service redeclara a conexão do BullMQ por conta própria', () => {
    const reincidentes = tsFilesIn(SERVICES_DIR).filter((file) =>
      /^const connection = \{/m.test(readFileSync(file, 'utf8')),
    );

    expect(
      reincidentes,
      'importe { queueConnection } de config/queueRedis.js em vez de recriar o bloco',
    ).toEqual([]);
  });
});
