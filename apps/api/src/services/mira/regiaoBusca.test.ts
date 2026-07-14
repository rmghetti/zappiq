/**
 * Região efetiva da descoberta: o usuário vence; sem digitação, a primeira
 * região do Perfil guia a query. É a fiação que faz regiaoCidade (B2C) e
 * regioes (B2B) influenciarem o MAPEAMENTO, não só o score.
 */
import { describe, it, expect } from 'vitest';
import { resolverRegiaoBusca } from './regiaoBusca.js';

describe('resolverRegiaoBusca', () => {
  it('o que o usuário digitou vence o Perfil', () => {
    expect(resolverRegiaoBusca('Campinas', ['Moema'])).toEqual({ regiao: 'Campinas', origem: 'usuario' });
  });

  it('sem digitação, usa a primeira região declarada no Perfil', () => {
    expect(resolverRegiaoBusca(null, ['Moema', 'Vila Mariana'])).toEqual({ regiao: 'Moema', origem: 'perfil' });
    expect(resolverRegiaoBusca('   ', ['SP capital'])).toEqual({ regiao: 'SP capital', origem: 'perfil' });
  });

  it('ignora entradas vazias da lista do Perfil', () => {
    expect(resolverRegiaoBusca(undefined, ['', '  ', 'Grande ABC'])).toEqual({ regiao: 'Grande ABC', origem: 'perfil' });
  });

  it('sem usuário e sem Perfil, busca sem região (comportamento antigo)', () => {
    expect(resolverRegiaoBusca(null, [])).toEqual({ regiao: null, origem: null });
    expect(resolverRegiaoBusca(null, undefined)).toEqual({ regiao: null, origem: null });
  });
});
