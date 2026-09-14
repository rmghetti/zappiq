/**
 * agentRulesService.test.ts (C3, Passo 14)
 * ============================================================================
 * As três provas que o plano pede do lado do banco, sem banco:
 *
 *   1. O mesmo cenário aprovado DUAS vezes não gera duas regras: a primeira
 *      vira 'substituida' e só a nova fica ativa (A081).
 *   2. Reverter uma regra não encosta nas outras (A083). Era o oposto: o
 *      revert regravava o prompt inteiro de antes e apagava tudo que veio
 *      depois.
 *   3. Sem o interruptor `regrasComoRegistros`, o bloco do prompt é string
 *      vazia e nem chega a consultar o banco.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock: any = {
  agentRule: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(async (fn: any) => fn(prismaMock)),
};

vi.mock('@zappiq/database', () => ({ prisma: prismaMock, Prisma: {} }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
const flagsMock = { isFlagOn: vi.fn(async () => false) };
vi.mock('./featureFlags.js', () => flagsMock);

const {
  carregarRegrasAtivas,
  blocoDeRegrasDaOrganizacao,
  aplicarRegraDoCenario,
  reverterRegra,
  regraDaDecisao,
  TETO_DE_REGRAS_ATIVAS,
} = await import('./agentRulesService.js');

const linha = (over: Record<string, unknown> = {}) => ({
  id: 'regra-1',
  organizationId: 'org-1',
  agentId: 'agent-1',
  scenarioId: 'cr5_nome_disponivel_usar',
  texto: 'Chame o cliente pelo nome quando souber.',
  origem: 'sugestao_ia',
  status: 'ativa',
  motivo: null,
  decisionId: 'dec-1',
  createdAt: new Date('2026-09-14T10:00:00Z'),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  flagsMock.isFlagOn.mockResolvedValue(false);
  prismaMock.agentRule.findMany.mockResolvedValue([]);
  prismaMock.agentRule.count.mockResolvedValue(0);
  prismaMock.agentRule.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.agentRule.create.mockImplementation(async ({ data }: any) => ({
    ...linha(),
    ...data,
    id: 'regra-nova',
  }));
});

// ════════════════════════════════════════════════════════════════════
describe('carregarRegrasAtivas', () => {
  it('lê só as ativas da organização, na ordem em que entraram', async () => {
    prismaMock.agentRule.findMany.mockResolvedValue([linha()]);
    const regras = await carregarRegrasAtivas({ organizationId: 'org-1' });

    const args = prismaMock.agentRule.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ organizationId: 'org-1', status: 'ativa' });
    expect(args.orderBy).toEqual({ createdAt: 'asc' });
    expect(regras).toHaveLength(1);
    expect(regras[0].texto).toContain('nome');
  });

  it('erro de banco devolve lista vazia: regra some, resposta não trava', async () => {
    prismaMock.agentRule.findMany.mockRejectedValue(new Error('banco fora'));
    await expect(carregarRegrasAtivas({ organizationId: 'org-1' })).resolves.toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('blocoDeRegrasDaOrganizacao: o interruptor manda', () => {
  it('desligado: string vazia e NENHUMA consulta ao banco', async () => {
    flagsMock.isFlagOn.mockResolvedValue(false);
    const bloco = await blocoDeRegrasDaOrganizacao('org-1');
    expect(bloco).toBe('');
    expect(prismaMock.agentRule.findMany).not.toHaveBeenCalled();
  });

  it('ligado: monta o bloco com as regras ativas', async () => {
    flagsMock.isFlagOn.mockResolvedValue(true);
    prismaMock.agentRule.findMany.mockResolvedValue([linha()]);
    const bloco = await blocoDeRegrasDaOrganizacao('org-1');
    expect(bloco).toContain('# Regras aprovadas pelo dono');
    expect(bloco).toContain('1. Chame o cliente pelo nome quando souber.');
  });

  it('ligado e sem regra nenhuma: continua string vazia', async () => {
    flagsMock.isFlagOn.mockResolvedValue(true);
    prismaMock.agentRule.findMany.mockResolvedValue([]);
    expect(await blocoDeRegrasDaOrganizacao('org-1')).toBe('');
  });

  it('falha ao ler o interruptor não liga comportamento novo', async () => {
    flagsMock.isFlagOn.mockRejectedValue(new Error('redis fora'));
    expect(await blocoDeRegrasDaOrganizacao('org-1')).toBe('');
  });
});

// ════════════════════════════════════════════════════════════════════
describe('aplicarRegraDoCenario: o mesmo cenário SUBSTITUI (A081)', () => {
  it('desativa a regra anterior do cenário antes de criar a nova', async () => {
    prismaMock.agentRule.updateMany.mockResolvedValue({ count: 1 });

    const out = await aplicarRegraDoCenario({
      organizationId: 'org-1',
      agentId: 'agent-1',
      scenarioId: 'cr5_nome_disponivel_usar',
      texto: 'Chame o cliente pelo nome na saudação.',
      origem: 'editada',
      decisionId: 'dec-2',
      createdBy: 'dono@empresa.com.br',
    });

    const where = prismaMock.agentRule.updateMany.mock.calls[0][0].where;
    expect(where).toEqual({
      agentId: 'agent-1',
      scenarioId: 'cr5_nome_disponivel_usar',
      status: 'ativa',
    });
    const data = prismaMock.agentRule.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe('substituida');
    expect(data.motivo).toBe('substituida_por_nova');

    expect(prismaMock.agentRule.create).toHaveBeenCalledTimes(1);
    expect(out.substituiu).toBe(1);
    expect(out.regra.status).toBe('ativa');
  });

  it('aplicar duas vezes deixa UMA ativa (a segunda), não duas', async () => {
    // Banco em memória: é o índice único parcial do Postgres, de mentira.
    const tabela: any[] = [];
    prismaMock.agentRule.updateMany.mockImplementation(async ({ where, data }: any) => {
      let n = 0;
      for (const r of tabela) {
        if (r.agentId === where.agentId && r.scenarioId === where.scenarioId && r.status === 'ativa') {
          Object.assign(r, data);
          n++;
        }
      }
      return { count: n };
    });
    prismaMock.agentRule.create.mockImplementation(async ({ data }: any) => {
      const nova = { id: `r${tabela.length + 1}`, ...data };
      tabela.push(nova);
      return nova;
    });

    const base = {
      organizationId: 'org-1',
      agentId: 'agent-1',
      scenarioId: 'cr5_nome_disponivel_usar',
      origem: 'sugestao_ia' as const,
    };
    await aplicarRegraDoCenario({ ...base, texto: 'Use o nome na saudação.' });
    await aplicarRegraDoCenario({ ...base, texto: 'Use o nome na saudação, sem repetir depois.' });

    const ativas = tabela.filter((r) => r.status === 'ativa');
    expect(tabela).toHaveLength(2);
    expect(ativas).toHaveLength(1);
    expect(ativas[0].texto).toContain('sem repetir depois');
    expect(tabela.filter((r) => r.status === 'substituida')).toHaveLength(1);
  });

  it('regra sem cenário (escrita à mão) não substitui ninguém', async () => {
    await aplicarRegraDoCenario({
      organizationId: 'org-1',
      agentId: 'agent-1',
      scenarioId: null,
      texto: 'Nunca prometa prazo sem falar com a equipe.',
      origem: 'manual',
    });
    expect(prismaMock.agentRule.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.agentRule.create).toHaveBeenCalledTimes(1);
  });

  it('recusa passar do teto de regras ativas', async () => {
    prismaMock.agentRule.count.mockResolvedValue(TETO_DE_REGRAS_ATIVAS);
    await expect(
      aplicarRegraDoCenario({
        organizationId: 'org-1',
        agentId: 'agent-1',
        scenarioId: 'cenario_novo',
        texto: 'Mais uma regra.',
        origem: 'manual',
      }),
    ).rejects.toThrow(/teto/i);
    expect(prismaMock.agentRule.create).not.toHaveBeenCalled();
  });

  it('substituir um cenário que JÁ tem regra passa mesmo no teto', async () => {
    // Não aumenta o número de ativas: uma sai, uma entra.
    prismaMock.agentRule.count.mockResolvedValue(TETO_DE_REGRAS_ATIVAS);
    prismaMock.agentRule.findFirst.mockResolvedValue(linha());
    await expect(
      aplicarRegraDoCenario({
        organizationId: 'org-1',
        agentId: 'agent-1',
        scenarioId: 'cr5_nome_disponivel_usar',
        texto: 'Versão nova da mesma regra.',
        origem: 'editada',
      }),
    ).resolves.toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════
describe('reverterRegra: cirúrgico (A083)', () => {
  it('desativa SÓ aquela regra, pelo id', async () => {
    prismaMock.agentRule.findFirst.mockResolvedValue(linha({ id: 'regra-7' }));
    prismaMock.agentRule.update.mockImplementation(async ({ data, where }: any) => ({
      ...linha({ id: where.id }),
      ...data,
    }));

    const out = await reverterRegra({ ruleId: 'regra-7', organizationId: 'org-1' });

    expect(prismaMock.agentRule.update).toHaveBeenCalledTimes(1);
    const chamada = prismaMock.agentRule.update.mock.calls[0][0];
    expect(chamada.where).toEqual({ id: 'regra-7' });
    expect(chamada.data.status).toBe('revertida');
    expect(chamada.data.motivo).toBe('revertida_pelo_dono');
    expect(out?.status).toBe('revertida');
    // Nenhum updateMany: reverter não encosta em nenhuma outra linha.
    expect(prismaMock.agentRule.updateMany).not.toHaveBeenCalled();
  });

  it('desfazer UMA regra deixa as outras exatamente como estavam (A083)', async () => {
    // O defeito original: reverter regravava o prompt inteiro de antes, e
    // tudo que tinha entrado depois sumia junto. Aqui, três regras ativas e
    // só a do meio sai.
    const tabela: any[] = [
      linha({ id: 'r1', scenarioId: 'cr1' }),
      linha({ id: 'r2', scenarioId: 'cr2' }),
      linha({ id: 'r3', scenarioId: 'cr3' }),
    ];
    prismaMock.agentRule.findFirst.mockImplementation(async ({ where }: any) =>
      tabela.find(
        (r) =>
          r.id === where.id &&
          r.organizationId === where.organizationId &&
          r.status === where.status,
      ) ?? null,
    );
    prismaMock.agentRule.update.mockImplementation(async ({ where, data }: any) => {
      const alvo = tabela.find((r) => r.id === where.id);
      Object.assign(alvo, data);
      return alvo;
    });

    await reverterRegra({ ruleId: 'r2', organizationId: 'org-1' });

    expect(tabela.map((r) => `${r.id}:${r.status}`)).toEqual([
      'r1:ativa',
      'r2:revertida',
      'r3:ativa',
    ]);
    // E os textos das outras duas continuam intactos.
    expect(tabela[0].texto).toBe('Chame o cliente pelo nome quando souber.');
    expect(tabela[2].texto).toBe('Chame o cliente pelo nome quando souber.');
  });

  it('regra de outra organização não é encontrada (404, não 403)', async () => {
    prismaMock.agentRule.findFirst.mockResolvedValue(null);
    const out = await reverterRegra({ ruleId: 'regra-de-outro', organizationId: 'org-1' });
    expect(out).toBeNull();
    expect(prismaMock.agentRule.update).not.toHaveBeenCalled();
  });

  it('regra já revertida não é revertida de novo', async () => {
    prismaMock.agentRule.findFirst.mockResolvedValue(null);
    await reverterRegra({ ruleId: 'regra-7', organizationId: 'org-1' });
    const where = prismaMock.agentRule.findFirst.mock.calls[0][0].where;
    expect(where.status).toBe('ativa');
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * PI-2 da revisão: a regra da decisão é procurada em QUALQUER status.
 * --------------------------------------------------------------------
 * A busca filtrava por status = 'ativa'. Uma correção já substituída por
 * outra do mesmo cenário devolvia null, e a rota de desfazer caía no
 * caminho do prompt, onde nada tinha mudado: 200, sem desativar nada. Quem
 * chama precisa do fato ("existe, e está assim") para dar a resposta certa.
 * ══════════════════════════════════════════════════════════════════════ */
describe('regraDaDecisao: acha a regra mesmo fora de ativa (PI-2)', () => {
  it('não filtra por status na consulta', async () => {
    prismaMock.agentRule.findFirst.mockResolvedValue(linha({ status: 'substituida' }));
    const out = await regraDaDecisao('dec-1');

    const where = prismaMock.agentRule.findFirst.mock.calls[0][0].where;
    expect(where.decisionId).toBe('dec-1');
    expect(where.status).toBeUndefined();
    expect(out?.status).toBe('substituida');
  });

  it('decisão sem regra nenhuma continua devolvendo null', async () => {
    prismaMock.agentRule.findFirst.mockResolvedValue(null);
    expect(await regraDaDecisao('dec-9')).toBeNull();
  });

  it('id vazio não vai ao banco', async () => {
    expect(await regraDaDecisao('')).toBeNull();
    expect(prismaMock.agentRule.findFirst).not.toHaveBeenCalled();
  });
});
