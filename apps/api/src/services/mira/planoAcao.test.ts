/**
 * Plano de ação → Tarefa pendente → conclusão volta ao CRM.
 *
 * Pedido do fundador (15/07/2026): "oportunidades que geram roteiro para os
 * sponsors devem gerar automaticamente uma tarefa PENDENTE em /tasks (que a
 * partir de agora recebe tarefas não só das Conversas, mas do Mira). Crie um
 * campo plano de ação onde a IA sugere o passo imediato, e conforme a pessoa
 * executa, a tarefa vira Concluída e alimenta a oportunidade no CRM."
 *
 * O buraco que isto fecha: o dossiê terminava num roteiro lindo e ZERO chamada
 * para ação. O vendedor lia, fechava a aba, e a conta morria ali.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirstTask = vi.fn();
const createTask = vi.fn();
const updateTask = vi.fn();
const updateManyTask = vi.fn();
const updateAlvo = vi.fn();
const findFirstAlvo = vi.fn();
const createActivity = vi.fn();

vi.mock('@zappiq/database', () => ({
  Prisma: {},
  prisma: {
    task: {
      findFirst: (...a: any[]) => findFirstTask(...a),
      create: (...a: any[]) => createTask(...a),
      update: (...a: any[]) => updateTask(...a),
      updateMany: (...a: any[]) => updateManyTask(...a),
    },
    miraAlvo: { findFirst: (...a: any[]) => findFirstAlvo(...a), update: (...a: any[]) => updateAlvo(...a) },
    activity: { create: (...a: any[]) => createActivity(...a) },
  },
}));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { registrarPlanoAcao, ligarTarefaAoCrm, registrarConclusaoNoCrm } = await import('./planoAcao.js');

const ALVO = { id: 'alvo-1', nome: 'ACME METALURGICA LTDA', nomeFantasia: 'ACME', contactId: null, dealId: null, planoAcaoTaskId: null };
const PLANO = 'Aborde Carlos Rondello (Sócio-administrador) sobre a Consultoria de infra. Use o roteiro pronto no dossiê.';

beforeEach(() => {
  vi.clearAllMocks();
  findFirstTask.mockResolvedValue(null);
  createTask.mockResolvedValue({ id: 'task-1' });
  updateTask.mockResolvedValue({});
  updateManyTask.mockResolvedValue({ count: 1 });
  updateAlvo.mockResolvedValue({});
  createActivity.mockResolvedValue({});
});

describe('o plano vira tarefa pendente em /tasks', () => {
  it('cria Task PENDING com origem MIRA (não Conversa) e prazo', async () => {
    const r = await registrarPlanoAcao('org-1', ALVO, PLANO);

    expect(r?.taskId).toBe('task-1');
    const data = createTask.mock.calls[0][0].data;
    expect(data.status).toBe('PENDING');
    // Até aqui TODA Task nascia das Conversas. A tela precisa distinguir os
    // dois trabalhos: responder quem chamou x prospectar quem nem te conhece.
    expect(data.origem).toBe('MIRA');
    expect(data.miraAlvoId).toBe('alvo-1');
    expect(data.title).toContain('ACME');
    expect(data.description).toBe(PLANO);
    expect(data.dueDate).toBeInstanceOf(Date);
  });

  it('grava o plano no Alvo e guarda o id da tarefa', async () => {
    await registrarPlanoAcao('org-1', ALVO, PLANO);
    const data = updateAlvo.mock.calls[0][0].data;
    expect(data.planoAcao).toBe(PLANO);
    expect(data.planoAcaoTaskId).toBe('task-1');
  });

  it('a tarefa nasce mesmo ANTES do Alvo pousar no CRM (sem deal ainda)', async () => {
    await registrarPlanoAcao('org-1', ALVO, PLANO);
    const data = createTask.mock.calls[0][0].data;
    expect(data.dealId).toBeUndefined();
    expect(data.contactId).toBeUndefined();
    // Sem deal/contact, Activity não aparece em lugar nenhum: não cria lixo.
    expect(createActivity).not.toHaveBeenCalled();
  });

  it('com o Alvo já no CRM, a tarefa nasce ligada e a timeline registra', async () => {
    await registrarPlanoAcao('org-1', { ...ALVO, contactId: 'c1', dealId: 'd1' }, PLANO);
    const data = createTask.mock.calls[0][0].data;
    expect(data.contactId).toBe('c1');
    expect(data.dealId).toBe('d1');
    expect(createActivity.mock.calls[0][0].data.title).toContain('plano de ação');
  });

  it('plano curto demais não vira tarefa (ruído não é trabalho)', async () => {
    expect(await registrarPlanoAcao('org-1', ALVO, 'ok')).toBeNull();
    expect(createTask).not.toHaveBeenCalled();
  });

  it('falha ao criar a tarefa não derruba o Aprofundar', async () => {
    createTask.mockRejectedValue(new Error('banco caiu'));
    expect(await registrarPlanoAcao('org-1', ALVO, PLANO)).toBeNull();
  });
});

describe('não entulha a tela do vendedor', () => {
  it('reaprofundar com tarefa PENDENTE atualiza, não duplica', async () => {
    findFirstTask.mockResolvedValue({ id: 'task-antiga' });

    const r = await registrarPlanoAcao('org-1', { ...ALVO, planoAcaoTaskId: 'task-antiga' }, 'Novo passo: ligar para o Carlos hoje.');

    expect(r?.reused).toBe(true);
    expect(r?.taskId).toBe('task-antiga');
    expect(createTask).not.toHaveBeenCalled();
    expect(updateTask.mock.calls[0][0].data.description).toContain('Novo passo');
    // Reaprofundou: o passo é outro, o relógio recomeça.
    expect(updateTask.mock.calls[0][0].data.dueDate).toBeInstanceOf(Date);
  });

  it('se a tarefa anterior JÁ foi concluída, o plano novo gera tarefa nova', async () => {
    // findFirst filtra por status PENDING: tarefa concluída não volta.
    findFirstTask.mockResolvedValue(null);

    const r = await registrarPlanoAcao('org-1', { ...ALVO, planoAcaoTaskId: 'task-concluida' }, PLANO);

    expect(r?.reused).toBe(false);
    expect(createTask).toHaveBeenCalled();
  });
});

describe('ligarTarefaAoCrm: a costura do pouso', () => {
  it('amarra a tarefa órfã ao contact/deal recém-criados', async () => {
    findFirstAlvo.mockResolvedValue({ planoAcaoTaskId: 'task-1' });

    await ligarTarefaAoCrm('org-1', 'alvo-1', 'c1', 'd1');

    expect(updateManyTask).toHaveBeenCalledWith({
      where: { id: 'task-1', organizationId: 'org-1' },
      data: { contactId: 'c1', dealId: 'd1' },
    });
  });

  it('Alvo sem plano de ação: não faz nada', async () => {
    findFirstAlvo.mockResolvedValue({ planoAcaoTaskId: null });
    await ligarTarefaAoCrm('org-1', 'alvo-1', 'c1', 'd1');
    expect(updateManyTask).not.toHaveBeenCalled();
  });
});

describe('conclusão da tarefa alimenta a oportunidade no CRM', () => {
  const TASK_MIRA = {
    id: 'task-1',
    title: 'Mira: ACME',
    description: PLANO,
    origem: 'MIRA',
    miraAlvoId: 'alvo-1',
    contactId: 'c1',
    dealId: 'd1',
  };

  it('tarefa da Mira concluída vira TASK_COMPLETED na timeline do deal', async () => {
    await registrarConclusaoNoCrm('org-1', TASK_MIRA);

    const data = createActivity.mock.calls[0][0].data;
    expect(data.type).toBe('TASK_COMPLETED');
    expect(data.dealId).toBe('d1');
    expect(data.title).toContain('Plano de ação da Mira concluído');
    expect(data.metadata.miraAlvoId).toBe('alvo-1');
  });

  it('tarefa das Conversas NÃO gera entrada da Mira (cada origem cuida da sua)', async () => {
    await registrarConclusaoNoCrm('org-1', { ...TASK_MIRA, origem: 'CONVERSA' });
    expect(createActivity).not.toHaveBeenCalled();
  });

  it('tarefa da Mira sem deal nem contact: não há onde escrever', async () => {
    await registrarConclusaoNoCrm('org-1', { ...TASK_MIRA, contactId: null, dealId: null });
    expect(createActivity).not.toHaveBeenCalled();
  });

  it('falha na timeline não derruba a conclusão (concluir é do usuário)', async () => {
    createActivity.mockRejectedValue(new Error('boom'));
    await expect(registrarConclusaoNoCrm('org-1', TASK_MIRA)).resolves.toBeUndefined();
  });
});
