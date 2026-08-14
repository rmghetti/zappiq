/* ══════════════════════════════════════════════════════════════════════
 * Mira Prospects — cron mensal do espelho de CNPJ (BullMQ).
 * --------------------------------------------------------------------
 * Registra o job repetível que chama syncCnpjMirror (lógica em cnpjMirror.ts)
 * dia 1 de cada mês. A materialização é o único job "caro" (varre a partição
 * inteira da base BD Pro, ~50-76 GB), roda 1x/mês e cabe no 1 TiB/mês grátis;
 * a descoberta B2B consulta a tabela espelho barata. Ver cnpjMirror.ts e doc 10.
 * Estrutura espelhada de analyticsPulseCron.ts.
 * ══════════════════════════════════════════════════════════════════════ */

import { Queue, Worker } from 'bullmq';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { bigQueryDisponivel } from './bigqueryClient.js';
import { syncCnpjMirror } from './cnpjMirror.js';
import { syncCagedSetor } from './cagedMirror.js';
import { queueConnection as connection } from '../../config/queueRedis.js';

export { syncCnpjMirror };

/** Roda os dois espelhos mensais do Mira (CNPJ ativos + sinal setorial CAGED). */
export async function runMiraMirrors(): Promise<void> {
  await syncCnpjMirror();
  await syncCagedSetor();
}

let cnpjMirrorWorker: Worker | null = null;

