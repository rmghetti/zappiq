/**
 * FEATURE 5b.5 — testes puros do filtro de listagem de tasks (GET /api/tasks).
 */
import { describe, it, expect } from 'vitest';
import { buildTaskListWhere, isTaskStatus, TASK_LIST_ORDER_BY, resolveCompletedAt } from './tasks.util.js';
import { updateTaskSchema } from './tasks.schema.js';

describe('isTaskStatus', () => {
  it('aceita os status válidos do enum', () => {
    expect(isTaskStatus('PENDING')).toBe(true);
    expect(isTaskStatus('DONE')).toBe(true);
    expect(isTaskStatus('CANCELLED')).toBe(true);
  });

  it('rejeita valores desconhecidos, vazios e não-string', () => {
    expect(isTaskStatus('pending')).toBe(false); // case-sensitive
    expect(isTaskStatus('OPEN')).toBe(false);
    expect(isTaskStatus('')).toBe(false);
    expect(isTaskStatus(undefined)).toBe(false);
    expect(isTaskStatus(null)).toBe(false);
    expect(isTaskStatus(3)).toBe(false);
  });
});

describe('buildTaskListWhere', () => {
  it('sempre trava por organizationId', () => {
    expect(buildTaskListWhere('org_1')).toEqual({ organizationId: 'org_1' });
  });

  it('aplica o filtro de status quando válido', () => {
    const where = buildTaskListWhere('org_1', { status: 'PENDING' });
    expect(where).toEqual({ organizationId: 'org_1', status: 'PENDING' });
  });

  it('IGNORA status inválido (não derruba e não vira filtro)', () => {
    const where = buildTaskListWhere('org_1', { status: 'lixo' });
    expect(where).toEqual({ organizationId: 'org_1' });
    expect('status' in where).toBe(false);
  });

  it('IGNORA status não-string (array/objeto vindo de query duplicada)', () => {
    const where = buildTaskListWhere('org_1', { status: ['PENDING', 'DONE'] });
    expect(where).toEqual({ organizationId: 'org_1' });
  });

  it('aplica dueBefore como dueDate.lte quando é data parseável', () => {
    const where = buildTaskListWhere('org_1', { dueBefore: '2026-07-10T00:00:00.000Z' });
    expect(where.dueDate).toBeDefined();
    expect(where.dueDate!.lte.toISOString()).toBe('2026-07-10T00:00:00.000Z');
  });

  it('IGNORA dueBefore inválido ou vazio', () => {
    expect(buildTaskListWhere('org_1', { dueBefore: 'not-a-date' })).toEqual({ organizationId: 'org_1' });
    expect(buildTaskListWhere('org_1', { dueBefore: '' })).toEqual({ organizationId: 'org_1' });
    expect(buildTaskListWhere('org_1', { dueBefore: 12345 })).toEqual({ organizationId: 'org_1' });
  });

  it('combina status + dueBefore', () => {
    const where = buildTaskListWhere('org_1', { status: 'PENDING', dueBefore: '2026-07-10' });
    expect(where.status).toBe('PENDING');
    expect(where.dueDate).toBeDefined();
  });
});

describe('TASK_LIST_ORDER_BY', () => {
  it('ordena por prazo asc (nulls last), depois criação desc', () => {
    expect(TASK_LIST_ORDER_BY[0]).toEqual({ dueDate: { sort: 'asc', nulls: 'last' } });
    expect(TASK_LIST_ORDER_BY[1]).toEqual({ createdAt: 'desc' });
  });
});

describe('resolveCompletedAt', () => {
  const now = new Date('2026-07-05T10:00:00.000Z');

  it('retorna undefined quando o status não muda (não mexe no campo)', () => {
    expect(resolveCompletedAt(undefined, null, now)).toBeUndefined();
    expect(resolveCompletedAt(undefined, new Date('2026-01-01'), now)).toBeUndefined();
  });

  it('vira DONE a partir de não-concluída → carimba agora', () => {
    expect(resolveCompletedAt('DONE', null, now)).toEqual(now);
  });

  it('vira DONE mas já estava concluída → preserva a data original', () => {
    const original = new Date('2026-06-01T08:00:00.000Z');
    expect(resolveCompletedAt('DONE', original, now)).toEqual(original);
  });

  it('sai de DONE (reabrir/cancelar) → zera completedAt', () => {
    expect(resolveCompletedAt('PENDING', new Date('2026-06-01'), now)).toBeNull();
    expect(resolveCompletedAt('CANCELLED', new Date('2026-06-01'), now)).toBeNull();
  });
});

describe('updateTaskSchema', () => {
  it('aceita concluir (status=DONE)', () => {
    expect(updateTaskSchema.safeParse({ status: 'DONE' }).success).toBe(true);
  });

  it('aceita editar título/descrição/prazo', () => {
    const r = updateTaskSchema.safeParse({
      title: 'Ligar pro cliente',
      description: 'Confirmar proposta',
      dueDate: '2026-07-10T00:00:00.000Z',
    });
    expect(r.success).toBe(true);
    // dueDate é coerced pra Date
    if (r.success) expect(r.data.dueDate).toBeInstanceOf(Date);
  });

  it('aceita description e dueDate nulos (limpar)', () => {
    expect(updateTaskSchema.safeParse({ description: null, dueDate: null }).success).toBe(true);
  });

  it('REJEITA body vazio (nada pra atualizar)', () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
  });

  it('REJEITA status inválido', () => {
    expect(updateTaskSchema.safeParse({ status: 'OPEN' }).success).toBe(false);
  });

  it('REJEITA mass assignment (campos fora da whitelist)', () => {
    for (const field of ['organizationId', 'contactId', 'dealId', 'completedAt', 'id']) {
      const r = updateTaskSchema.safeParse({ status: 'DONE', [field]: 'x' });
      expect(r.success, `${field} deveria ser rejeitado (.strict)`).toBe(false);
    }
  });
});
