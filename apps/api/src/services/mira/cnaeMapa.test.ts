/**
 * Atividade escrita → código de CNAE.
 *
 * É o que faz a base de 28M CNPJs (paga, configurada) atender quem escreve
 * "comércio varejista" em vez de "47". Sem isto, o alvo escrito passava longe
 * dela e sobrava a busca pública — que na primeira campanha do Rodrigo
 * respondeu 403 e devolveu zero.
 *
 * Determinístico de propósito: código de atividade é fato. Um palpite errado
 * aqui manda a campanha inteira procurar o setor errado, e o cliente não tem
 * como perceber.
 */
import { describe, it, expect } from 'vitest';
import { traduzirAlvo, traduzirAlvos } from './cnaeMapa.js';

describe('traduzirAlvo', () => {
  it('o mais específico vence o mais amplo', () => {
    // "comércio" sozinho é 45/46/47; "comércio varejista" tem que ser só 47.
    expect(traduzirAlvo('comércio varejista').divisoes).toEqual(['47']);
    expect(traduzirAlvo('comércio').divisoes).toEqual(['45', '46', '47']);
    expect(traduzirAlvo('comércio atacadista').divisoes).toEqual(['46']);
  });

  it('ignora acento e caixa, como o cliente escreve', () => {
    expect(traduzirAlvo('INDÚSTRIA').divisoes).toContain('10');
    expect(traduzirAlvo('industria').divisoes).toContain('10');
    expect(traduzirAlvo('Serviços').divisoes.length).toBeGreaterThan(10);
  });

  it('vocabulário de negócio vira o setor certo', () => {
    expect(traduzirAlvo('clínicas de estética').divisoes).toContain('86');
    expect(traduzirAlvo('academias').divisoes).toContain('93');
    expect(traduzirAlvo('distribuidoras de TI').divisoes).toContain('46');
    expect(traduzirAlvo('restaurantes').divisoes).toContain('56');
    expect(traduzirAlvo('escritório de advocacia').divisoes).toContain('69');
  });

  it('porte não é atividade: não traduz, segue para a busca pública', () => {
    // "empresas PME" é o PORTE da empresa, não o ramo dela. Traduzir isso
    // para algum CNAE seria inventar o setor que o cliente quer.
    expect(traduzirAlvo('empresas PME').divisoes).toEqual([]);
  });

  it('texto sem sentido de atividade não vira código', () => {
    expect(traduzirAlvo('xpto qualquer coisa').divisoes).toEqual([]);
    expect(traduzirAlvo('').divisoes).toEqual([]);
  });
});

describe('traduzirAlvos (o caso real da campanha 1 de teste)', () => {
  it('os 5 alvos da MACHIA: 4 viram CNAE, o porte segue para a web', () => {
    const r = traduzirAlvos([
      'serviços',
      'comércio varejista',
      'industria',
      'todos as verticais de serviços',
      'empresas PME',
    ]);
    expect(r.traduzidos).toEqual(['serviços', 'comércio varejista', 'industria', 'todos as verticais de serviços']);
    expect(r.naoTraduzidos).toEqual(['empresas PME']);
    // A base de CNPJs agora tem por onde filtrar: antes eram zero prefixos.
    expect(r.divisoes.length).toBeGreaterThan(20);
    expect(r.divisoes).toContain('47');
    expect(r.divisoes).toContain('62');
  });

  it('deduplica divisões repetidas entre alvos', () => {
    const r = traduzirAlvos(['varejo', 'lojas']);
    expect(r.divisoes).toEqual(['47']);
  });

  it('lista vazia não quebra', () => {
    expect(traduzirAlvos([])).toEqual({ divisoes: [], traduzidos: [], naoTraduzidos: [] });
  });
});
