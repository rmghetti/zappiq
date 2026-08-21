/**
 * Trava o registro da fila `cron`.
 *
 * A consolidação juntou 11 filas BullMQ numa só. O modo de falha que importa
 * não é erro de compilação, é uma rotina sumir em silêncio ou mudar de
 * horário sem ninguém perceber: retenção LGPD, expiração de trial e os crons
 * da Mira param de rodar e nada grita.
 *
 * Os pares abaixo foram copiados das filas ANTIGAS, uma a uma, antes da
 * remoção. Se este teste falhar, ou a rotina saiu do registro ou o horário
 * mudou: as duas coisas precisam ser intencionais.
 */
import { describe, expect, it } from 'vitest';

import { CRON_JOBS, LEGACY_CRON_QUEUES } from './cronQueue.js';

/**
 * name → pattern esperado. As 11 primeiras vieram das filas ANTIGAS, com o
 * horário exatamente como era antes da consolidação; as demais nasceram já
 * na fila `cron` e entram aqui no momento em que são registradas.
 */
const HORARIOS_ESPERADOS: Record<string, string> = {
  'lgpd-retention': '0 3 * * *',            // era fila lgpd-retention
  'tenant-usage-aggregation': '10 3 * * *', // era fila tenant-usage-aggregation
  'analytics-pulse': '20 3 * * *',          // era fila analytics-pulse-cron
  'trial-expiration': '40 3 * * *',         // era fila trial-expiration-cron
  'usage-reconciliation': '0 4 * * *',      // era fila usage-reconciliation
  'agent-eval-iza': '30 4 * * *',           // era job daily-agent-eval-iza
  'agent-eval-clients': '30 4 * * 1',       // era job weekly-agent-eval
  'mira-releases': '0 6 * * 1',             // era fila mira-releases-cron
  'mira-cnpj-mirror': '0 6 1 * *',          // era fila mira-cnpj-mirror-cron
  'superadmin-trial-digest': '0 13 * * *',  // era fila superadmin-trial-digest
  'trial-followup-scheduler': '0 14 * * *', // era o tique da fila trial-followup
  'conversation-expiry': '50 * * * *',      // nova (Resposta Meta out/2026), de hora em hora
  'waba-health': '5 */6 * * *',             // nova (Resposta Meta out/2026), a cada 6 horas
};

describe('fila cron — registro consolidado', () => {
  it('mantém as 13 rotinas, nenhuma a mais e nenhuma a menos', () => {
    const nomes = CRON_JOBS.map((c) => c.name).sort();
    expect(nomes).toEqual(Object.keys(HORARIOS_ESPERADOS).sort());
  });

  it('preserva o horário de cada rotina exatamente como era antes', () => {
    const atual = Object.fromEntries(CRON_JOBS.map((c) => [c.name, c.pattern]));
    expect(atual).toEqual(HORARIOS_ESPERADOS);
  });

  it('não repete nome, senão o worker despacharia sempre a primeira', () => {
    const nomes = CRON_JOBS.map((c) => c.name);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it('toda rotina tem função executável', () => {
    for (const job of CRON_JOBS) {
      expect(typeof job.run, `rotina ${job.name} sem run()`).toBe('function');
    }
  });

  it('mantém o escalonamento da madrugada, sem duas rotinas no mesmo minuto', () => {
    // 03:00, 03:10, 03:20, 03:40, 04:00 são espaçados de propósito para não
    // empilhar carga pesada de banco no mesmo instante.
    const diarios = CRON_JOBS.filter((c) => c.pattern.endsWith('* * *')).map((c) => c.pattern);
    expect(new Set(diarios).size).toBe(diarios.length);
  });

  it('lista para limpeza toda fila de cron que deixou de existir', () => {
    // Se uma fila antiga ficar de fora, o repetível dela continua agendado no
    // Redis para sempre, sem worker para processar.
    expect(LEGACY_CRON_QUEUES).toEqual(
      expect.arrayContaining([
        'lgpd-retention',
        'tenant-usage-aggregation',
        'analytics-pulse-cron',
        'trial-expiration-cron',
        'usage-reconciliation',
        'agent-eval-cron',
        'mira-releases-cron',
        'mira-cnpj-mirror-cron',
        'superadmin-trial-digest',
      ]),
    );
  });
});
