/**
 * Fonte única da conexão Redis (Upstash) usada por TODAS as filas BullMQ.
 *
 * Antes deste módulo o mesmo bloco `const connection = {...}` estava copiado
 * em 13 services, em 4 variantes que já haviam divergido:
 *   - queueService/flowScheduler tinham retryStrategy, keepAlive e
 *     reconnectOnError (e o comentário "MANTER EM SINCONIA manual");
 *   - 5 services tinham só maxRetriesPerRequest + enableReadyCheck;
 *   - 5 crons não tinham nada, ou seja, rodavam sem nenhum tratamento de
 *     reconexão contra um Redis que derruba conexão ociosa.
 *
 * Consolidar aqui faz todas as filas herdarem o tratamento mais completo,
 * que é o que já rodava nas duas filas mais críticas em produção.
 */
import { env } from './env.js';

const redisUrl = new URL(env.REDIS_URL);
const isTLS = env.REDIS_URL.startsWith('rediss://');

/**
 * Opções de conexão para Queue e Worker do BullMQ.
 *
 * NOTA sobre `rejectUnauthorized: false`: mantido exatamente como estava nas
 * 13 cópias. O `utils/redis.ts` (conexão do app, fora do BullMQ) já valida
 * certificado. Igualar os dois é mudança de comportamento em produção e sai
 * em troca própria, não escondida num commit de consolidação.
 */
export const queueConnection = {
  host: redisUrl.hostname || 'localhost',
  port: Number(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
  username: redisUrl.username || undefined,
  ...(isTLS ? { tls: { rejectUnauthorized: false } } : {}),
  maxRetriesPerRequest: null,              // BullMQ requirement for workers
  enableReadyCheck: false,                 // avoid LOADING errors on reconnect
  keepAlive: 10_000,                       // ping every 10s — prevents Upstash idle disconnect
  retryStrategy(times: number) {
    if (times > 30) return null;           // give up after 30 retries
    return Math.min(times * 300, 15_000);  // 300ms, 600ms, ... max 15s
  },
  reconnectOnError(err: Error) {
    const retryable = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'READONLY'];
    return retryable.some((e) => err.message.includes(e));
  },
};

/**
 * Tempo do BZPOPMIN bloqueante quando a fila está COMPLETAMENTE vazia.
 * O default do BullMQ é 5s, o que faz cada worker ocioso gastar ~8 comandos
 * a cada 5 segundos, 24/7 (o Upstash fatura cada comando interno do script
 * Lua separadamente).
 *
 * Subir isto NÃO atrasa job nenhum: `Queue.add` escreve na chave `:marker` e
 * destrava o BZPOPMIN na hora (bullmq 5.71.1, worker.js `waitForJob`).
 *
 * IMPORTANTE, e o motivo de isto NÃO ser aplicado nas filas de cron: quando
 * existe job atrasado pendente, o BullMQ ignora o drainDelay e limita o
 * bloqueio a `maximumBlockTimeout = 10` segundos (worker.js `getBlockTimeout`).
 * Fila de cron usa job repetível, então sempre tem atrasado pendente e o
 * drainDelay não teria efeito ali. O caminho para as filas de cron é reduzir
 * a QUANTIDADE de filas e de máquinas, não o intervalo.
 */
export const IDLE_DRAIN_DELAY_SECONDS = 60;
