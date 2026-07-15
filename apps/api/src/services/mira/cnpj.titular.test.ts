/**
 * O titular do Empresário Individual é o decisor, e sempre esteve no nome.
 *
 * Diagnóstico de produção (15/07/2026): 11 dos 20 Alvos estavam SEM DECISOR e
 * parados em QUALIFYING com score 13. Oito deles eram natureza 2135. O sistema
 * esperava um quadro societário que a lei PROÍBE de existir:
 *
 *   2135 "Empresário (Individual)": "o empresário pessoa física que exerce
 *   profissionalmente atividade econômica (...) sem se constituir pessoa
 *   jurídica e SEM A PARTICIPAÇÃO DE QUALQUER SÓCIO"
 *   (diretório oficial br_bd_diretorios_brasil.natureza_juridica)
 *
 * Todos os nomes abaixo são Alvos REAIS da base da MACHIA.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@zappiq/database', () => ({ prisma: {} }));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { titularDoRegistro } = await import('./cnpj.js');

describe('Empresário Individual: o titular é a razão social', () => {
  it('lê o titular quando não há sócio (o caso da GISLAINE)', () => {
    const t = titularDoRegistro({
      naturezaJuridica: '2135',
      razaoSocial: 'GISLAINE RODRIGUES DOS SANTOS BERSAN ARARAS',
      municipio: 'Araras',
      qsa: [],
    });
    // "ARARAS" no fim é o município, praxe na EI: sai.
    expect(t).toEqual({ nome: 'GISLAINE RODRIGUES DOS SANTOS BERSAN', qualificacao: 'Empresário Individual' });
  });

  it('corta o sufixo de município com acento (Aguaí)', () => {
    const t = titularDoRegistro({
      naturezaJuridica: '2135',
      razaoSocial: 'RICARDO ALEXANDRE M. CHIRIGATTI AGUAI',
      municipio: 'Aguaí',
      qsa: [],
    });
    expect(t?.nome).toBe('RICARDO ALEXANDRE M. CHIRIGATTI');
  });

  it('não corta nada quando o fim não é o município', () => {
    const t = titularDoRegistro({
      naturezaJuridica: '2135',
      razaoSocial: 'APARECIDO ANTONIO CABELO',
      municipio: 'Adamantina',
      qsa: [],
    });
    expect(t?.nome).toBe('APARECIDO ANTONIO CABELO');
  });

  it('nome que não é de pessoa também vale: é o que o registro tem', () => {
    const t = titularDoRegistro({
      naturezaJuridica: '2135',
      razaoSocial: 'J.D.FREZE-MARCENARIA',
      municipio: 'Americana',
      qsa: [],
    });
    expect(t?.nome).toBe('J.D.FREZE-MARCENARIA');
  });

  it('cobre as outras naturezas sem sócio (EIRELI e imobiliária individual)', () => {
    for (const cod of ['2305', '2313', '4014']) {
      const t = titularDoRegistro({ naturezaJuridica: cod, razaoSocial: 'FULANO DE TAL SILVA', municipio: null, qsa: [] });
      expect(t?.nome).toBe('FULANO DE TAL SILVA');
      expect(t?.qualificacao).toContain('Titular');
    }
  });

  it('aceita o código com máscara (213-5)', () => {
    const t = titularDoRegistro({ naturezaJuridica: '213-5', razaoSocial: 'FULANO DE TAL', municipio: null, qsa: [] });
    expect(t?.nome).toBe('FULANO DE TAL');
  });
});

describe('quando NÃO deve inventar titular', () => {
  it('LTDA sem sócio não vira titular (a Receita simplesmente não tem o dado)', () => {
    // 2062 = Sociedade Empresária Limitada. Tem sócio por definição; se o QSA
    // veio vazio é lacuna da fonte, e inventar o titular seria dizer que a
    // empresa se chama "KRAMEPY INDUSTRIA..." e que essa é uma pessoa.
    expect(
      titularDoRegistro({
        naturezaJuridica: '2062',
        razaoSocial: 'KRAMEPY INDUSTRIA E COMERCIO DE LIGAS LIMITADA',
        municipio: 'Bom Jesus dos Perdões',
        qsa: [],
      })
    ).toBeNull();
  });

  it('com QSA preenchido, o QSA manda (não duplica o titular)', () => {
    expect(
      titularDoRegistro({
        naturezaJuridica: '2135',
        razaoSocial: 'FULANO DE TAL',
        municipio: null,
        qsa: [{ nome: 'FULANO DE TAL', qualificacao: 'Sócio-Administrador' }],
      })
    ).toBeNull();
  });

  it('natureza desconhecida ou ausente não vira titular', () => {
    expect(titularDoRegistro({ naturezaJuridica: null, razaoSocial: 'FULANO DE TAL', municipio: null, qsa: [] })).toBeNull();
    expect(titularDoRegistro({ naturezaJuridica: '9999', razaoSocial: 'FULANO DE TAL', municipio: null, qsa: [] })).toBeNull();
  });

  it('razão social curta demais não vira titular', () => {
    expect(titularDoRegistro({ naturezaJuridica: '2135', razaoSocial: 'ABC', municipio: null, qsa: [] })).toBeNull();
  });

  it('não corta o município se sobrar um nome vazio ou de uma palavra só', () => {
    // "ARARAS" em Araras: cortar deixaria nome vazio. Fica inteiro.
    const t = titularDoRegistro({ naturezaJuridica: '2135', razaoSocial: 'ARARAS', municipio: 'Araras', qsa: [] });
    expect(t).toBeNull(); // curto demais depois de tudo
    const t2 = titularDoRegistro({ naturezaJuridica: '2135', razaoSocial: 'SILVA ARARAS', municipio: 'Araras', qsa: [] });
    expect(t2?.nome).toBe('SILVA ARARAS'); // cortar deixaria só "SILVA": mantém
  });
});
