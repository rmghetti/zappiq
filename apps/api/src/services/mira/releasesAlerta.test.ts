/**
 * Sinalizar o cliente quando a conta dele mexeu.
 *
 * O mapeamento semanal achava a matéria de madrugada e ficava esperando o
 * cliente abrir a página de Releases por conta própria. Notícia que ninguém vê
 * não vale nada, e a janela que ela abre fecha sozinha.
 *
 * A trava mais importante testada aqui é a de SPAM: 50 Alvos não podem virar
 * 50 tarefas por semana, senão o cliente para de olhar para as tarefas e o
 * alerta que importa morre junto com o ruído.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  miraRelease: { findMany: vi.fn(), updateMany: vi.fn() },
  task: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
};

vi.mock('@zappiq/database', () => ({ prisma: prismaMock }));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { alertarReleasesDoAlvo } = await import('./releasesAlerta.js');

const ALVO = { id: 'alvo1', nome: 'Metalúrgica Exemplo LTDA', nomeFantasia: 'Metalex' };

const releaseAcionavel = {
  id: 'r1',
  titulo: 'Nova unidade em Sorocaba',
  url: 'https://exame.com/metalex-unidade',
  demandaId: 'dem1',
  anguloAbordagem: 'Fale antes da especificação.',
};
const releaseInformativo = {
  id: 'r2',
  titulo: 'Metalex completa 40 anos',
  url: 'https://exame.com/metalex-40anos',
  demandaId: null,
  anguloAbordagem: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.task.findFirst.mockResolvedValue(null);
  prismaMock.task.create.mockResolvedValue({ id: 'task1' });
  prismaMock.miraRelease.updateMany.mockResolvedValue({ count: 1 });
});

describe('release acionável vira tarefa que o cliente vê', () => {
  it('cria Task com origem MIRA, ligada ao Alvo, com o link da matéria e o gancho', async () => {
    prismaMock.miraRelease.findMany.mockResolvedValue([releaseAcionavel]);

    const r = await alertarReleasesDoAlvo('org1', ALVO);

    expect(r.taskId).toBe('task1');
    expect(r.releasesAlertados).toBe(1);

    const task = prismaMock.task.create.mock.calls[0][0].data;
    expect(task.origem).toBe('MIRA');
    expect(task.miraAlvoId).toBe('alvo1');
    expect(task.status).toBe('PENDING');
    expect(task.organizationId).toBe('org1');
    expect(task.title).toContain('Metalex');
    expect(task.description).toContain('Nova unidade em Sorocaba');
    expect(task.description).toContain('https://exame.com/metalex-unidade'); // a fonte vai junto
    expect(task.description).toContain('Fale antes da especificação.');
  });

  it('a mesma matéria nunca é alertada duas vezes (marca alertadoEm)', async () => {
    prismaMock.miraRelease.findMany.mockResolvedValue([releaseAcionavel]);
    await alertarReleasesDoAlvo('org1', ALVO);

    const upd = prismaMock.miraRelease.updateMany.mock.calls[0][0];
    expect(upd.where.id.in).toEqual(['r1']);
    expect(upd.where.organizationId).toBe('org1'); // isolamento de tenant
    expect(upd.data.alertadoEm).toBeInstanceOf(Date);
  });

  it('tarefa pendente do mesmo Alvo acumula, não empilha uma segunda', async () => {
    prismaMock.miraRelease.findMany.mockResolvedValue([releaseAcionavel]);
    prismaMock.task.findFirst.mockResolvedValue({ id: 'task-antiga' });

    const r = await alertarReleasesDoAlvo('org1', ALVO);

    expect(r.taskId).toBe('task-antiga');
    expect(prismaMock.task.create).not.toHaveBeenCalled();
    expect(prismaMock.task.update).toHaveBeenCalledTimes(1);
  });
});

describe('a trava de spam: nem toda novidade merece uma tarefa', () => {
  it('release informativo (sem demanda e sem gancho) NÃO vira tarefa', async () => {
    prismaMock.miraRelease.findMany.mockResolvedValue([releaseInformativo]);

    const r = await alertarReleasesDoAlvo('org1', ALVO);

    expect(r.taskId).toBeNull();
    expect(r.motivo).toBe('nada_acionavel');
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });

  it('mas o informativo fica marcado como alertado (não volta na fila toda semana)', async () => {
    prismaMock.miraRelease.findMany.mockResolvedValue([releaseInformativo]);
    await alertarReleasesDoAlvo('org1', ALVO);

    expect(prismaMock.miraRelease.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.miraRelease.updateMany.mock.calls[0][0].where.id.in).toEqual(['r2']);
  });

  it('acionável + informativo: UMA tarefa, só com o acionável no corpo', async () => {
    prismaMock.miraRelease.findMany.mockResolvedValue([releaseAcionavel, releaseInformativo]);

    const r = await alertarReleasesDoAlvo('org1', ALVO);

    expect(r.releasesAlertados).toBe(1);
    expect(prismaMock.task.create).toHaveBeenCalledTimes(1);
    const desc = prismaMock.task.create.mock.calls[0][0].data.description;
    expect(desc).toContain('Nova unidade em Sorocaba');
    expect(desc).not.toContain('40 anos'); // informativo não polui a tarefa
    // Os dois ficam marcados: já passaram pelo crivo
    expect(prismaMock.miraRelease.updateMany.mock.calls[0][0].where.id.in).toEqual(['r1', 'r2']);
  });

  it('sem novidade nenhuma, não cria nada nem mexe em nada', async () => {
    prismaMock.miraRelease.findMany.mockResolvedValue([]);

    const r = await alertarReleasesDoAlvo('org1', ALVO);

    expect(r).toEqual({ taskId: null, releasesAlertados: 0, motivo: 'nada_novo' });
    expect(prismaMock.task.create).not.toHaveBeenCalled();
    expect(prismaMock.miraRelease.updateMany).not.toHaveBeenCalled();
  });

  it('só busca release ainda não alertado, do tenant certo', async () => {
    prismaMock.miraRelease.findMany.mockResolvedValue([]);
    await alertarReleasesDoAlvo('org1', ALVO);

    const where = prismaMock.miraRelease.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ organizationId: 'org1', alvoId: 'alvo1', alertadoEm: null });
  });
});

describe('honestidade: falhar em avisar não derruba o ciclo', () => {
  it('erro do banco vira motivo, não exceção', async () => {
    prismaMock.miraRelease.findMany.mockRejectedValue(new Error('banco caiu'));

    const r = await alertarReleasesDoAlvo('org1', ALVO);

    expect(r.taskId).toBeNull();
    expect(r.motivo).toContain('banco caiu');
  });
});
