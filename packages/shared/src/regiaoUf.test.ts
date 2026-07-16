/**
 * Região da campanha B2B → UF.
 *
 * A base espelho recorta por `sigla_uf`, então região que não vira UF não
 * recorta nada. A versão antiga pegava o primeiro par de letras e não conferia
 * se era UF, o que dava três jeitos de errar CALADO (achados em 14/07/2026):
 *
 *   "zona sul de SP" → UF "DE"    → zero resultados
 *   "Rio de Janeiro" → UF "DE"    → zero resultados
 *   "Campinas"       → sem filtro → varria o Brasil inteiro
 *
 * Os dois primeiros eram, literalmente, os exemplos que o campo sugeria.
 */
import { describe, expect, it } from 'vitest';
import { extrairUfs, regiaoViraUf } from './regiaoUf.js';

describe('extrairUfs', () => {
  it('não confunde a preposição "de" com uma UF', () => {
    expect(extrairUfs(['zona sul de SP'])).toEqual(['SP']);
    expect(extrairUfs(['interior de SP'])).toEqual(['SP']);
    expect(extrairUfs(['Rio de Janeiro'])).toEqual(['RJ']);
  });

  it('entende sigla e estado por extenso, com e sem acento', () => {
    expect(extrairUfs(['SP'])).toEqual(['SP']);
    expect(extrairUfs(['sp'])).toEqual(['SP']);
    expect(extrairUfs(['São Paulo'])).toEqual(['SP']);
    expect(extrairUfs(['sao paulo'])).toEqual(['SP']);
    expect(extrairUfs(['Minas Gerais'])).toEqual(['MG']);
    expect(extrairUfs(['Distrito Federal'])).toEqual(['DF']);
  });

  it('prefere o nome mais longo: "Mato Grosso do Sul" não é "Mato Grosso"', () => {
    expect(extrairUfs(['Mato Grosso do Sul'])).toEqual(['MS']);
    expect(extrairUfs(['Mato Grosso'])).toEqual(['MT']);
  });

  it('soma vários estados e não repete', () => {
    expect(extrairUfs(['SP', 'RJ', 'São Paulo']).sort()).toEqual(['RJ', 'SP']);
  });

  it('cidade sozinha não vira UF: a tela avisa em vez de varrer o Brasil', () => {
    expect(extrairUfs(['Campinas'])).toEqual([]);
    expect(extrairUfs(['Grande ABC'])).toEqual([]);
    expect(extrairUfs([''])).toEqual([]);
  });

  it('cidade com estado junto recorta pelo estado', () => {
    expect(extrairUfs(['Campinas, SP'])).toEqual(['SP']);
  });
});

describe('regiaoViraUf', () => {
  it('responde o que a tela precisa saber antes de disparar', () => {
    expect(regiaoViraUf('SP')).toBe(true);
    expect(regiaoViraUf('Campinas, SP')).toBe(true);
    expect(regiaoViraUf('Campinas')).toBe(false);
  });
});
