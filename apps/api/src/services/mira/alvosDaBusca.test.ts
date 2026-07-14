/**
 * A semente do wizard e a separação código x texto.
 *
 * Estes testes travam o pedido do Rodrigo (14/07): a campanha nasce com o que
 * está no Perfil, e o que o cliente vê é o que roda. Também travam o defeito
 * que descobrimos junto: alvo em texto era descartado em silêncio pelo filtro
 * numérico das fontes de CNPJ, e o Perfil aceita texto de propósito.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: { miraPerfil: { findUnique: (...a: any[]) => findUnique(...a) } },
}));

const { sementeDaBusca, separarAlvos } = await import('./alvosDaBusca.js');

// Perfil real da MACHIA em produção (alvos todos em texto, região "Brasil").
const PERFIL_MACHIA = {
  alvoB2B: {
    cnaesAlvo: ['serviços', 'comércio varejista', 'industria', 'todos as verticais de serviços', 'empresas PME'],
    regioes: ['Brasil'],
  },
  alvoB2C: { ocupacao: [], regiaoCidade: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(PERFIL_MACHIA);
});

describe('sementeDaBusca', () => {
  it('B2B: nasce com os alvos e as regiões do Perfil', async () => {
    const s = await sementeDaBusca('org-1', 'B2B');
    expect(s.alvos).toEqual([
      'serviços',
      'comércio varejista',
      'industria',
      'todos as verticais de serviços',
      'empresas PME',
    ]);
    expect(s.regioes).toEqual(['Brasil']);
    expect(s.origem).toBe('perfil');
  });

  it('só lê a org pedida (isolamento)', async () => {
    await sementeDaBusca('org-1', 'B2B');
    expect(findUnique).toHaveBeenCalledWith({ where: { organizationId: 'org-1' } });
  });

  it('B2C: só a região é semeada; o Perfil não declara o tipo de negócio', async () => {
    findUnique.mockResolvedValue({
      alvoB2B: { cnaesAlvo: ['6201-5'], regioes: ['SP'] },
      // "ocupacao" NÃO serve de alvo: o placeholder dela é "Autônomos, CLT,
      // empreendedores" (vínculo de trabalho do consumidor). Semear a busca do
      // Places com isso geraria "Autônomos em Moema" e devolveria lixo.
      alvoB2C: { ocupacao: ['Autônomos', 'CLT'], regiaoCidade: ['Moema', 'Vila Mariana'] },
    });
    const s = await sementeDaBusca('org-1', 'B2C');
    expect(s.alvos).toEqual([]);
    expect(s.regioes).toEqual(['Moema', 'Vila Mariana']);
    expect(s.origem).toBe('perfil');
  });

  it('B2C: o caminho B2B não vaza para a semente', async () => {
    findUnique.mockResolvedValue({
      alvoB2B: { cnaesAlvo: ['6201-5'], regioes: ['SP'] },
      alvoB2C: { regiaoCidade: ['Moema'] },
    });
    const s = await sementeDaBusca('org-1', 'B2C');
    expect(s.alvos).not.toContain('6201-5');
    expect(s.regioes).not.toContain('SP');
  });

  it('sem perfil salvo, semente vazia em vez de estourar', async () => {
    findUnique.mockResolvedValue(null);
    expect(await sementeDaBusca('org-nova', 'B2B')).toEqual({ alvos: [], regioes: [], origem: 'vazio' });
  });

  it('perfil sem nada declarado marca origem vazio (a tela pede ao cliente)', async () => {
    findUnique.mockResolvedValue({ alvoB2B: { cnaesAlvo: [], regioes: [] }, alvoB2C: {} });
    const s = await sementeDaBusca('org-1', 'B2B');
    expect(s.origem).toBe('vazio');
  });

  it('descarta entrada vazia e apara espaço', async () => {
    findUnique.mockResolvedValue({ alvoB2B: { cnaesAlvo: ['', '  ', '  clínicas  '], regioes: [] }, alvoB2C: {} });
    const s = await sementeDaBusca('org-1', 'B2B');
    expect(s.alvos).toEqual(['clínicas']);
  });
});

describe('separarAlvos', () => {
  it('código de CNAE vai para os códigos, só com os dígitos', () => {
    expect(separarAlvos(['4651-6/01', '62.01-5'])).toEqual({ codigos: ['4651601', '62015'], textos: [] });
  });

  it('atividade em texto vai para os textos, em vez de sumir', () => {
    // Era exatamente o que o filtro numérico das fontes de CNPJ jogava fora.
    expect(separarAlvos(PERFIL_MACHIA.alvoB2B.cnaesAlvo)).toEqual({
      codigos: [],
      textos: ['serviços', 'comércio varejista', 'industria', 'todos as verticais de serviços', 'empresas PME'],
    });
  });

  it('os dois tipos convivem no mesmo Perfil', () => {
    const r = separarAlvos(['4651-6', 'distribuidoras de TI']);
    expect(r.codigos).toEqual(['46516']);
    expect(r.textos).toEqual(['distribuidoras de TI']);
  });

  it('texto com número solto não vira código', () => {
    const r = separarAlvos(['indústria 4.0']);
    expect(r.codigos).toEqual([]);
    expect(r.textos).toEqual(['indústria 4.0']);
  });

  it('número curto demais para prefixo de CNAE não vira código', () => {
    expect(separarAlvos(['5'])).toEqual({ codigos: [], textos: ['5'] });
  });

  it('ignora vazio', () => {
    expect(separarAlvos(['', '   '])).toEqual({ codigos: [], textos: [] });
  });
});
