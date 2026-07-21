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
import { normalizarPorte, parseFaturamentoFloorReais, portesPermitidos } from './porte.js';

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
