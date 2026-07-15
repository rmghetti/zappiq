/**
 * Tarefas estilo Planner — testes puros dos filtros e contratos novos.
 *
 * Cobre o que a sessão 2 do loop introduziu: IN_PROGRESS, filtro por etiqueta,
 * filtro por responsável (incluindo "sem responsável", que hoje é 100% da base)
 * e os contratos zod de criação/edição.
 */
import { describe, it, expect } from 'vitest';
import {
  buildTaskListWhere,
  isTaskStatus,
  isTaskOrigem,
  resolveCompletedAt,
  TASK_STATUSES,
  TASK_BOARD_COLUMNS,
} from './tasks.util.js';
import {
  createTaskSchema,
  updateTaskSchema,
  createTaskTagSchema,
} from './tasks.schema.js';

// cuid de verdade tem 25 chars — os regex de id exigem 20..30.
const ID_TAG = 'clx9k2m4f0000qw3h5t8n1a2b';
const ID_USER = 'clx9k2m4f0001qw3h5t8n1a2c';

describe('IN_PROGRESS', () => {
  it('entra no enum sem derrubar os status que já existiam', () => {
    expect(TASK_STATUSES).toEqual(['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED']);
    expect(isTaskStatus('IN_PROGRESS')).toBe(true);
  });

  it('NÃO conclui a tarefa: completedAt continua null', () => {
    // A regra que mais importa. Se IN_PROGRESS carimbasse completedAt, "pegar
    // a tarefa pra trabalhar" contaria como trabalho entregue no CRM.
    expect(resolveCompletedAt('IN_PROGRESS', null)).toBeNull();
  });

  it('reabrir uma tarefa concluída zera a conclusão', () => {
    const antes = new Date('2026-07-10T12:00:00Z');
    expect(resolveCompletedAt('IN_PROGRESS', antes)).toBeNull();
  });

  it('o quadro não tem coluna de canceladas', () => {
    // Coluna de canceladas só cresce e empurra o trabalho real pra fora da tela.
    expect(TASK_BOARD_COLUMNS).toEqual(['PENDING', 'IN_PROGRESS', 'DONE']);
    expect(TASK_BOARD_COLUMNS).not.toContain('CANCELLED');
  });
});

describe('buildTaskListWhere — filtros novos', () => {
  it('filtra por etiqueta', () => {
    expect(buildTaskListWhere('org_1', { tagId: ID_TAG })).toEqual({
      organizationId: 'org_1',
      tags: { some: { tagId: ID_TAG } },
    });
  });

  it('filtra por responsável', () => {
    expect(buildTaskListWhere('org_1', { assignedToId: ID_USER })).toEqual({
      organizationId: 'org_1',
      assignedToId: ID_USER,
    });
  });

  it('"none" vira NULL — é o caso real: hoje toda tarefa nasce sem dono', () => {
    expect(buildTaskListWhere('org_1', { assignedToId: 'none' })).toEqual({
      organizationId: 'org_1',
      assignedToId: null,
    });
  });

  it('id com cara de lixo é IGNORADO, não vira filtro', () => {
    // Filtrar por lixo devolveria lista vazia e o cliente leria "não tenho
    // tarefa nenhuma" (mentira) em vez de "meu filtro não valeu".
    expect(buildTaskListWhere('org_1', { tagId: 'nope' })).toEqual({ organizationId: 'org_1' });
    expect(buildTaskListWhere('org_1', { assignedToId: '../../etc' })).toEqual({
      organizationId: 'org_1',
    });
    expect(buildTaskListWhere('org_1', { tagId: 42 })).toEqual({ organizationId: 'org_1' });
  });

  it('filtra por origem e ignora origem inválida', () => {
    expect(isTaskOrigem('MIRA')).toBe(true);
    expect(buildTaskListWhere('org_1', { origem: 'MIRA' })).toEqual({
      organizationId: 'org_1',
      origem: 'MIRA',
    });
    expect(buildTaskListWhere('org_1', { origem: 'INVENTADA' })).toEqual({ organizationId: 'org_1' });
  });

  it('combina os filtros mantendo a trava de org', () => {
    const w = buildTaskListWhere('org_1', {
      status: 'IN_PROGRESS',
      tagId: ID_TAG,
      assignedToId: ID_USER,
      origem: 'MIRA',
    });
    expect(w).toEqual({
      organizationId: 'org_1',
      status: 'IN_PROGRESS',
      tags: { some: { tagId: ID_TAG } },
      assignedToId: ID_USER,
      origem: 'MIRA',
    });
  });

  it('NUNCA deixa de travar por org, nem com filtro tentando sobrescrever', () => {
    // A trava de org é a ÚNICA coisa isolando os clientes em produção (a RLS
    // não filtra pra API). Este teste existe pra falhar se alguém mexer nisso.
    const w = buildTaskListWhere('org_1', { organizationId: 'org_2' } as any);
    expect(w.organizationId).toBe('org_1');
  });
});

describe('createTaskSchema', () => {
  it('aceita o mínimo: só o título', () => {
    const r = createTaskSchema.safeParse({ title: 'Ligar para o Claudio' });
    expect(r.success).toBe(true);
  });

  it('exige título não vazio', () => {
    expect(createTaskSchema.safeParse({ title: '' }).success).toBe(false);
    expect(createTaskSchema.safeParse({}).success).toBe(false);
  });

  it('BLOQUEIA o cliente forjando uma tarefa de prospecção', () => {
    // origem/miraAlvoId são de quem CRIA (a automação ou a Mira). Se o cliente
    // pudesse mandar, qualquer tarefa viraria "Prospecção" com selo da Mira.
    expect(createTaskSchema.safeParse({ title: 'x', origem: 'MIRA' }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: 'x', miraAlvoId: ID_TAG }).success).toBe(false);
  });

  it('BLOQUEIA o cliente escolhendo a org ou a data de conclusão', () => {
    expect(createTaskSchema.safeParse({ title: 'x', organizationId: 'org_2' }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: 'x', completedAt: new Date() }).success).toBe(false);
  });

  it('etiqueta entra como id do catálogo, nunca como texto livre', () => {
    expect(createTaskSchema.safeParse({ title: 'x', tagIds: [ID_TAG] }).success).toBe(true);
    expect(createTaskSchema.safeParse({ title: 'x', tagIds: ['Urgente'] }).success).toBe(false);
  });

  it('limita a 10 etiquetas por tarefa', () => {
    const muitas = Array.from({ length: 11 }, () => ID_TAG);
    expect(createTaskSchema.safeParse({ title: 'x', tagIds: muitas }).success).toBe(false);
  });

  it('aceita IN_PROGRESS na criação', () => {
    expect(createTaskSchema.safeParse({ title: 'x', status: 'IN_PROGRESS' }).success).toBe(true);
  });
});

describe('updateTaskSchema', () => {
  it('aceita os campos novos do painel "Ver tarefa"', () => {
    expect(updateTaskSchema.safeParse({ notes: 'Cliente pediu retorno na sexta' }).success).toBe(true);
    expect(updateTaskSchema.safeParse({ assignedToId: ID_USER }).success).toBe(true);
    expect(updateTaskSchema.safeParse({ assignedToId: null }).success).toBe(true); // tirar o dono
    expect(updateTaskSchema.safeParse({ tagIds: [] }).success).toBe(true); // tirar todas
  });

  it('exige ao menos um campo', () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
  });

  it('continua bloqueando completedAt e org', () => {
    expect(updateTaskSchema.safeParse({ completedAt: new Date() }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ organizationId: 'org_2' }).success).toBe(false);
  });

  it('não deixa mudar contato/negócio pela edição', () => {
    // O vínculo é definido na criação. Deixar editar aqui reabriria a porta de
    // mover a tarefa pra base de outro cliente.
    expect(updateTaskSchema.safeParse({ contactId: ID_TAG }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ dealId: ID_TAG }).success).toBe(false);
  });
});

describe('createTaskTagSchema', () => {
  it('exige cor hex de 6 dígitos', () => {
    // O valor vai direto pro style do front: regex fechado, não "string".
    expect(createTaskTagSchema.safeParse({ name: 'Urgente', color: '#ff0000' }).success).toBe(true);
    expect(createTaskTagSchema.safeParse({ name: 'Urgente', color: 'red' }).success).toBe(false);
    expect(createTaskTagSchema.safeParse({ name: 'Urgente', color: '#f00' }).success).toBe(false);
    expect(
      createTaskTagSchema.safeParse({ name: 'x', color: '#fff"><script>' }).success,
    ).toBe(false);
  });

  it('exige nome e cor', () => {
    expect(createTaskTagSchema.safeParse({ name: 'Urgente' }).success).toBe(false);
    expect(createTaskTagSchema.safeParse({ color: '#ff0000' }).success).toBe(false);
  });
});
