import { describe, it, expect, vi } from 'vitest';
import {
  seedDefaultPipelineStages,
  DEFAULT_PIPELINE_STAGES,
  type PipelineStageProvisioningDb,
} from './pipelineStageProvisioningService.js';

/**
 * db fake: um array em memória simulando a tabela pipeline_stages.
 * findFirst casa por where.organizationId; createMany insere em lote.
 */
function makeFakeDb() {
  const rows: Array<{ id: string; organizationId: string; name: string; order: number; color: string; isWon: boolean; isLost: boolean }> = [];
  let seq = 0;
  const db: PipelineStageProvisioningDb & { rows: typeof rows } = {
    rows,
    pipelineStage: {
      findFirst: vi.fn(async (args: any) => {
        const { organizationId } = args.where;
        const found = rows.find((r) => r.organizationId === organizationId);
        return found ? { id: found.id } : null;
      }),
      createMany: vi.fn(async (args: any) => {
        const data = args.data as any[];
        for (const d of data) rows.push({ id: `ps-${++seq}`, ...d });
        return { count: data.length };
      }),
    },
  };
  return db;
}

describe('DEFAULT_PIPELINE_STAGES', () => {
  it('tem exatamente os 7 estágios canônicos, na ordem e com os flags certos', () => {
    expect(DEFAULT_PIPELINE_STAGES.map((s) => s.name)).toEqual([
      'Novo lead',
      'Contatado',
      'Qualificado',
      'Proposta',
      'Negociacao',
      'Ganho',
      'Perdido',
    ]);
    // order sequencial 0..6
    expect(DEFAULT_PIPELINE_STAGES.map((s) => s.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    // exatamente um isWon (Ganho) e um isLost (Perdido)
    expect(DEFAULT_PIPELINE_STAGES.filter((s) => s.isWon)).toHaveLength(1);
    expect(DEFAULT_PIPELINE_STAGES.find((s) => s.isWon)?.name).toBe('Ganho');
    expect(DEFAULT_PIPELINE_STAGES.filter((s) => s.isLost)).toHaveLength(1);
    expect(DEFAULT_PIPELINE_STAGES.find((s) => s.isLost)?.name).toBe('Perdido');
  });
});

describe('seedDefaultPipelineStages', () => {
  it('semeia os 7 estágios quando a org não tem nenhum', async () => {
    const db = makeFakeDb();
    const r = await seedDefaultPipelineStages('org-1', db);

    expect(r.created).toBe(true);
    expect(r.count).toBe(7);
    expect(db.pipelineStage.createMany).toHaveBeenCalledOnce();
    expect(db.rows).toHaveLength(7);
    expect(db.rows.every((row) => row.organizationId === 'org-1')).toBe(true);
    expect(db.rows.map((row) => row.name)).toEqual([
      'Novo lead', 'Contatado', 'Qualificado', 'Proposta', 'Negociacao', 'Ganho', 'Perdido',
    ]);
  });

  it('é idempotente: 2a chamada NÃO cria nem duplica (no-op)', async () => {
    const db = makeFakeDb();
    const first = await seedDefaultPipelineStages('org-1', db);
    const second = await seedDefaultPipelineStages('org-1', db);

    expect(first.created).toBe(true);
    expect(first.count).toBe(7);
    expect(second.created).toBe(false);
    expect(second.count).toBe(0);
    expect(db.pipelineStage.createMany).toHaveBeenCalledOnce(); // só na 1a
    expect(db.rows).toHaveLength(7);
  });

  it('NÃO recria quando a org já tem estágios (mesmo customizados pelo cliente)', async () => {
    const db = makeFakeDb();
    // simula org com pipeline customizado (ex.: só 1 estágio renomeado)
    db.rows.push({ id: 'custom-1', organizationId: 'org-9', name: 'Meu funil', order: 0, color: '#000', isWon: false, isLost: false });

    const r = await seedDefaultPipelineStages('org-9', db);

    expect(r.created).toBe(false);
    expect(r.count).toBe(0);
    expect(db.pipelineStage.createMany).not.toHaveBeenCalled();
    expect(db.rows).toHaveLength(1); // intacto
    expect(db.rows[0].name).toBe('Meu funil');
  });

  it('isola por org: semear org-2 não afeta org-1 já semeada', async () => {
    const db = makeFakeDb();
    await seedDefaultPipelineStages('org-1', db);
    const r2 = await seedDefaultPipelineStages('org-2', db);

    expect(r2.created).toBe(true);
    expect(r2.count).toBe(7);
    expect(db.rows.filter((row) => row.organizationId === 'org-1')).toHaveLength(7);
    expect(db.rows.filter((row) => row.organizationId === 'org-2')).toHaveLength(7);
  });
});
