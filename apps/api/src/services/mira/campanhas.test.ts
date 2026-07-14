/**
 * Campanhas de prospecção: nome automático, ciclo de vida e isolamento.
 *
 * O que estes testes travam:
 *  1. Toda leitura/escrita é escopada em organizationId (eixo cliente-vs-cliente).
 *  2. O nome automático é previsível e legível (busca + data).
 *  3. Gate rejeitado descarta a campanha em vez de poluir o histórico.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const create = vi.fn();
const update = vi.fn();
const del = vi.fn();
const findMany = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: {
    miraCampanha: {
      create: (...a: any[]) => create(...a),
      update: (...a: any[]) => update(...a),
      delete: (...a: any[]) => del(...a),
      findMany: (...a: any[]) => findMany(...a),
    },
  },
}));

const { nomeAutomatico, iniciarCampanha, concluirCampanha, descartarCampanha, listarCampanhas } = await import(
  './campanhas.js'
);

const DATA = new Date('2026-07-15T12:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({ id: 'camp-1', nome: 'X' });
  update.mockResolvedValue({});
  del.mockResolvedValue({});
  findMany.mockResolvedValue([]);
});

describe('nomeAutomatico', () => {
  it('descoberta: consulta + região + data', () => {
    expect(nomeAutomatico('DESCOBERTA', { consulta: 'clínicas de estética', regiao: 'Campinas' }, DATA)).toBe(
      'Descoberta: clínicas de estética em Campinas (15/jul)'
    );
  });

  it('descoberta sem região não inventa lugar', () => {
    expect(nomeAutomatico('DESCOBERTA', { consulta: 'academias' }, DATA)).toBe('Descoberta: academias (15/jul)');
  });

  it('carteira: quantidade de CNPJs, com singular honesto', () => {
    expect(nomeAutomatico('BASE_INSTALADA', { cnpjs: 12 }, DATA)).toBe('Carteira: 12 CNPJs (15/jul)');
    expect(nomeAutomatico('BASE_INSTALADA', { cnpjs: 1 }, DATA)).toBe('Carteira: 1 CNPJ (15/jul)');
  });

  it('consulta gigante é truncada no nome', () => {
    const nome = nomeAutomatico('DESCOBERTA', { consulta: 'x'.repeat(200) }, DATA);
    expect(nome.length).toBeLessThan(100);
  });
});

describe('iniciarCampanha', () => {
  it('grava com o organizationId da org e o nome dado', async () => {
    await iniciarCampanha('org-1', { nome: '  Minha busca  ', tipo: 'DESCOBERTA', parametros: { consulta: 'x' } });
    const args = create.mock.calls[0][0];
    expect(args.data.organizationId).toBe('org-1');
    expect(args.data.nome).toBe('Minha busca');
    expect(args.data.status).toBe('EM_ANDAMENTO');
  });

  it('sem nome, cai no automático', async () => {
    await iniciarCampanha('org-1', { tipo: 'DESCOBERTA', parametros: { consulta: 'academias', regiao: 'Moema' } });
    const args = create.mock.calls[0][0];
    expect(args.data.nome).toContain('Descoberta: academias em Moema');
  });
});

describe('ciclo de vida', () => {
  it('concluir grava status e resultado', async () => {
    await concluirCampanha('camp-1', { criados: 3, prontos: 2 });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'camp-1' },
      data: { status: 'CONCLUIDA', resultado: { criados: 3, prontos: 2 } },
    });
  });

  it('falha grava FALHOU', async () => {
    await concluirCampanha('camp-1', { motivo: 'erro' }, 'FALHOU');
    expect(update.mock.calls[0][0].data.status).toBe('FALHOU');
  });

  it('descartar apaga sem estourar quando já não existe', async () => {
    del.mockRejectedValue(new Error('not found'));
    await expect(descartarCampanha('camp-x')).resolves.toBeUndefined();
  });
});

describe('listarCampanhas (isolamento)', () => {
  it('só lista a org pedida', async () => {
    await listarCampanhas('org-1');
    expect(findMany.mock.calls[0][0].where).toEqual({ organizationId: 'org-1' });
  });

  it('mapeia contagens de alvos e prontos', async () => {
    findMany.mockResolvedValue([
      {
        id: 'c1',
        nome: 'Descoberta: x (15/jul)',
        tipo: 'DESCOBERTA',
        status: 'CONCLUIDA',
        parametros: { consulta: 'x' },
        resultado: { criados: 3 },
        _count: { alvos: 3 },
        alvos: [{ id: 'a1' }, { id: 'a2' }],
        createdAt: DATA,
      },
    ]);
    const [c] = await listarCampanhas('org-1');
    expect(c.alvosCount).toBe(3);
    expect(c.prontosCount).toBe(2);
    expect(c.createdAt).toBe(DATA.toISOString());
  });

  it('respeita o teto de take', async () => {
    await listarCampanhas('org-1', 500);
    expect(findMany.mock.calls[0][0].take).toBe(100);
  });
});
