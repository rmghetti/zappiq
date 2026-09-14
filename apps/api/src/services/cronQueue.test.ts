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
import { describe, expect, it, vi } from 'vitest';

import {
  CRON_JOBS,
  LEGACY_CRON_QUEUES,
  removeObsoleteCronSchedulers,
  type RegistroDeAgendamentos,
} from './cronQueue.js';

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
  'agent-eval-iza': '30 4 * * 0',           // semanal (domingo) — era diária, A045/A067
  'agent-eval-clients': '30 4 * * 1',       // era job weekly-agent-eval
  'agent-eval-on-change': '50 4 * * *',     // nova (A045): só quem mexeu na base
  'agent-eval-sweep': '35 * * * *',         // nova (A048): execução presa vira failed
  'mira-releases': '0 6 * * 1',             // era fila mira-releases-cron
  'mira-cnpj-mirror': '0 6 1 * *',          // era fila mira-cnpj-mirror-cron
  'superadmin-trial-digest': '0 13 * * *',  // era fila superadmin-trial-digest
  'trial-followup-scheduler': '0 14 * * *', // era o tique da fila trial-followup
  'conversation-expiry': '50 * * * *',      // nova (Resposta Meta out/2026), de hora em hora
  'waba-health': '5 */6 * * *',             // nova (Resposta Meta out/2026), a cada 6 horas
  'cost-guard': '20 * * * *',               // nova (PR-H Resposta Meta out/2026), de hora em hora
  'signup-orfaos-vigia': '10 13 * * *',     // nova (A242), logo depois do digest de trial
};

describe('fila cron — registro consolidado', () => {
  it('mantém as 17 rotinas, nenhuma a mais e nenhuma a menos', () => {
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

/**
 * A chave do agendamento no BullMQ 5.71.1 é o md5 de
 * `nome:jobId:endDate:tz:padrão` (repeat.js, getRepeatConcatOptions). Mudar só
 * o padrão de uma rotina muda a chave, então `cronQueue.add` NÃO substitui o
 * agendamento antigo: cria um SEGUNDO ao lado dele.
 *
 * Foi exatamente o que este PR fez com a auditoria da Iza, que passou de
 * `30 4 * * *` (diária) para `30 4 * * 0` (domingo). Sem esta limpeza a Iza
 * continuaria rodando todo dia, e duas vezes no domingo, com o custo de LLM
 * que a mudança existe para cortar.
 */
describe('fila cron: agendamento obsoleto sai do Redis', () => {
  /** Fila falsa: só o par de métodos que a limpeza usa. */
  function filaCom(
    agendamentos: Array<{ key: string; name?: string; pattern?: string } | undefined>,
  ): RegistroDeAgendamentos & { removeJobScheduler: ReturnType<typeof vi.fn> } {
    return {
      getJobSchedulers: vi.fn().mockResolvedValue(agendamentos),
      removeJobScheduler: vi.fn().mockResolvedValue(true),
    };
  }

  it('remove o repetível antigo quando o padrão da rotina muda', async () => {
    const fila = filaCom([
      { key: 'md5-antigo', name: 'agent-eval-iza', pattern: '30 4 * * *' }, // era diária
      { key: 'md5-novo', name: 'agent-eval-iza', pattern: '30 4 * * 0' }, // virou semanal
    ]);

    const removidos = await removeObsoleteCronSchedulers(fila);

    expect(removidos).toBe(1);
    expect(fila.removeJobScheduler).toHaveBeenCalledTimes(1);
    expect(fila.removeJobScheduler).toHaveBeenCalledWith('md5-antigo');
  });

  it('preserva todo agendamento que ainda corresponde ao registro', async () => {
    const fila = filaCom(
      CRON_JOBS.map((job, i) => ({ key: `md5-${i}`, name: job.name, pattern: job.pattern })),
    );

    const removidos = await removeObsoleteCronSchedulers(fila);

    expect(removidos).toBe(0);
    expect(fila.removeJobScheduler).not.toHaveBeenCalled();
  });

  it('remove agendamento de rotina que saiu do registro', async () => {
    const fila = filaCom([{ key: 'md5-orfa', name: 'rotina-que-nao-existe-mais', pattern: '0 5 * * *' }]);

    expect(await removeObsoleteCronSchedulers(fila)).toBe(1);
    expect(fila.removeJobScheduler).toHaveBeenCalledWith('md5-orfa');
  });

  it('é idempotente: rodar de novo, sem obsoleto, não remove nada', async () => {
    // As duas máquinas do Fly rodam isto no boot, uma depois da outra.
    const fila = filaCom([{ key: 'md5-novo', name: 'agent-eval-iza', pattern: '30 4 * * 0' }]);

    expect(await removeObsoleteCronSchedulers(fila)).toBe(0);
    expect(await removeObsoleteCronSchedulers(fila)).toBe(0);
  });

  it('falha no Redis não derruba a subida do cron', async () => {
    const fila: RegistroDeAgendamentos = {
      getJobSchedulers: vi.fn().mockRejectedValue(new Error('Redis fora do ar')),
      removeJobScheduler: vi.fn(),
    };

    await expect(removeObsoleteCronSchedulers(fila)).resolves.toBe(0);
  });

  it('tolera entrada sem dados (hash do agendamento sumiu do Redis)', async () => {
    const fila = filaCom([undefined, { key: 'md5-orfa', name: 'sumiu', pattern: '0 5 * * *' }]);

    expect(await removeObsoleteCronSchedulers(fila)).toBe(1);
  });
});

// A242 — a vigia da porta de entrada entrou na fila única, não numa fila nova.
describe('cron: vigia dos cadastros órfãos', () => {
  const vigia = CRON_JOBS.find((j) => j.name === 'signup-orfaos-vigia');

  it('está registrada na fila `cron`', () => {
    expect(vigia).toBeDefined();
  });

  it('roda uma vez por dia', () => {
    expect(vigia!.pattern).toMatch(/^\d+ \d+ \* \* \*$/);
  });

  it('não colide de minuto com nenhuma outra rotina diária', () => {
    const mesmoMinuto = CRON_JOBS.filter(
      (j) => j.name !== 'signup-orfaos-vigia' && j.pattern === vigia!.pattern,
    );
    expect(mesmoMinuto).toEqual([]);
  });
});
