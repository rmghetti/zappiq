/**
 * Porte e faturamento: normalização e derivação do recorte de tamanho.
 *
 * A representação de porte é um caos no dado real (a Receita usa código '01'/
 * '03'/'05', a BrasilAPI devolve 'MICRO EMPRESA'/'DEMAIS', e há fixtures com
 * 'ME'/'3'/'5'/'MEDIO'). `matchPorte` só reconhecia as formas descritivas, então
 * o porte por CÓDIGO nunca casava e o score por porte estava quebrado no caminho
 * principal. `normalizarPorte` canoniza todas as formas; `portesPermitidos`
 * deriva o recorte de tamanho do Perfil (portes declarados ou piso implícito do
 * faturamento pedido) para o filtro da descoberta.
 */
import { describe, it, expect } from 'vitest';
import { normalizarPorte, parseFaturamentoFloorReais, portesPermitidos, portesDaTag } from './porte.js';

describe('normalizarPorte: canoniza todas as representações reais', () => {
  it('formas de MICRO', () => {
    for (const v of ['MICRO EMPRESA', 'micro', 'ME', 'MEI', '01', '1']) {
      expect(normalizarPorte(v)).toBe('MICRO');
    }
  });
  it('formas de PEQUENO (EPP)', () => {
    for (const v of ['EPP', 'EMPRESA DE PEQUENO PORTE', 'pequeno porte', '03', '3']) {
      expect(normalizarPorte(v)).toBe('PEQUENO');
    }
  });
  it('formas de DEMAIS (médio/grande e o balde da Receita)', () => {
    for (const v of ['DEMAIS', 'MEDIO', 'média empresa', 'GRANDE', 'grandes contas', '05', '5']) {
      expect(normalizarPorte(v)).toBe('DEMAIS');
    }
  });
  it('não informado / desconhecido vira null', () => {
    for (const v of ['00', '0', 'NAO INFORMADO', '', null, undefined, 'xyz']) {
      expect(normalizarPorte(v as any)).toBeNull();
    }
  });
  it('feminino/plural de pequena também é PEQUENO (achado da revisão: excluía as EPP pedidas)', () => {
    expect(normalizarPorte('Pequena')).toBe('PEQUENO');
    expect(normalizarPorte('PEQUENAS')).toBe('PEQUENO');
  });
});

describe('portesDaTag: uma tag do Perfil pode cobrir mais de um porte', () => {
  it('PME cobre PEQUENO e DEMAIS', () => {
    expect(new Set(portesDaTag('PME'))).toEqual(new Set(['PEQUENO', 'DEMAIS']));
  });
  it('"pequenas e médias" cobre PEQUENO e DEMAIS (antes caía só em DEMAIS)', () => {
    expect(new Set(portesDaTag('pequenas e médias'))).toEqual(new Set(['PEQUENO', 'DEMAIS']));
  });
  it('tag simples equivale ao normalizarPorte', () => {
    expect(portesDaTag('ME')).toEqual(['MICRO']);
    expect(portesDaTag('grandes contas')).toEqual(['DEMAIS']);
  });
});

describe('parseFaturamentoFloorReais: piso da faixa pedida', () => {
  it('lê valor com multiplicador', () => {
    expect(parseFaturamentoFloorReais('R$ 10M')).toBe(10_000_000);
    expect(parseFaturamentoFloorReais('10 milhões')).toBe(10_000_000);
    expect(parseFaturamentoFloorReais('R$ 500 mil')).toBe(500_000);
  });
  it('lê número por extenso com separador de milhar', () => {
    expect(parseFaturamentoFloorReais('R$ 10.000.000')).toBe(10_000_000);
  });
  it('numa faixa, pega o piso', () => {
    expect(parseFaturamentoFloorReais('R$ 10M a 50M')).toBe(10_000_000);
    expect(parseFaturamentoFloorReais('acima de R$ 5 milhões')).toBe(5_000_000);
  });
  it('teto ("até X") não vira piso', () => {
    expect(parseFaturamentoFloorReais('até 5 milhões')).toBeNull();
  });
  it('outras palavras de teto (menor/inferior/menos) também não viram piso (filtro invertido é o pior caso)', () => {
    expect(parseFaturamentoFloorReais('menor que 5 milhões')).toBeNull();
    expect(parseFaturamentoFloorReais('inferior a R$ 5 milhões')).toBeNull();
    expect(parseFaturamentoFloorReais('menos que 2M')).toBeNull();
  });
  it('ponto decimal não é milhar: 4.8M é 4,8 milhões, não 48 milhões', () => {
    expect(parseFaturamentoFloorReais('R$ 4.8M')).toBe(4_800_000);
    expect(parseFaturamentoFloorReais('2.5 milhões')).toBe(2_500_000);
    expect(parseFaturamentoFloorReais('R$ 1,5M')).toBe(1_500_000);
  });
  it('vazio vira null', () => {
    expect(parseFaturamentoFloorReais('')).toBeNull();
    expect(parseFaturamentoFloorReais(null)).toBeNull();
  });
});

describe('portesPermitidos: recorte de tamanho do Perfil', () => {
  it('portes declarados mandam', () => {
    expect(portesPermitidos({ alvoB2B: { portes: ['grandes contas'] } })).toEqual(new Set(['DEMAIS']));
    expect(portesPermitidos({ alvoB2B: { portes: ['ME', 'EPP'] } })).toEqual(new Set(['MICRO', 'PEQUENO']));
  });
  it('feminino/plural declarados filtram certo em vez de inverter o recorte', () => {
    expect(portesPermitidos({ alvoB2B: { portes: ['Pequena', 'Média'] } })).toEqual(new Set(['PEQUENO', 'DEMAIS']));
  });
  it('sem portes, o faturamento pedido implica o piso de porte', () => {
    // acima do teto do Simples (R$ 4,8M) => só DEMAIS
    expect(portesPermitidos({ alvoB2B: { faturamentoAnual: 'R$ 10M+' } })).toEqual(new Set(['DEMAIS']));
    // entre R$ 360k e R$ 4,8M => exclui micro
    expect(portesPermitidos({ alvoB2B: { faturamentoAnual: 'R$ 2 milhões' } })).toEqual(new Set(['PEQUENO', 'DEMAIS']));
  });
  it('sem recorte de tamanho, retorna null (não filtra)', () => {
    expect(portesPermitidos({ alvoB2B: {} })).toBeNull();
    expect(portesPermitidos({ alvoB2B: { faturamentoAnual: 'R$ 200 mil' } })).toBeNull();
  });
});
