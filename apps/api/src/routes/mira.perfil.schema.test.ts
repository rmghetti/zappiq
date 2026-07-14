/**
 * Contrato do Perfil de Prospecção: união discriminada + a conta da prontidão.
 *
 * A prontidão não é enfeite: abaixo de 60 os motores devolvem 412 e o cliente
 * não roda nada. Então a regra que estes testes travam é uma só — quem preenche
 * exatamente o que o formulário marca como obrigatório TEM que passar do gate.
 * Se alguém rebalancear os pesos e quebrar isso, o cliente cumpre o pedido da
 * tela e mesmo assim fica travado, sem entender por quê.
 */
import { describe, it, expect } from 'vitest';
import { perfilSchema, computePerfilProntidao, alvoAtivo, modoDaDescoberta, type PerfilInput } from './mira.perfil.schema.js';

/** Perfil vazio, como o zod monta a partir de {}. */
const vazio = (): PerfilInput => perfilSchema.parse({});

/** Só o que a tela marca com asterisco no caminho B2B. */
const obrigatoriosB2B = (): PerfilInput =>
  perfilSchema.parse({
    tipoCliente: 'B2B',
    catalogo: [{ nome: 'Consultoria de infra' }],
    doresResolvidas: ['Downtime derruba a operação'],
    alvoB2B: { cnaesAlvo: ['6201-5'], decisor: ['Diretor de TI'] },
  });

/** Só o que a tela marca com asterisco no caminho B2C. */
const obrigatoriosB2C = (): PerfilInput =>
  perfilSchema.parse({
    tipoCliente: 'B2C',
    catalogo: [{ nome: 'Rodízio de massas' }],
    doresResolvidas: ['Almoço rápido perto do trabalho'],
    alvoB2C: { faixaEtaria: '25-45 anos', regiaoCidade: ['Moema'], doresDesejos: ['Comer bem sem demora'] },
  });

describe('perfilSchema', () => {
  it('assume B2B e preenche os dois alvos vazios a partir de {}', () => {
    const p = vazio();
    expect(p.tipoCliente).toBe('B2B');
    expect(p.alvoB2B.cnaesAlvo).toEqual([]);
    expect(p.alvoB2C.regiaoCidade).toEqual([]);
    expect(p.alvoB2B.cicloVenda).toBeNull();
  });

  it('guarda os dois alvos ao mesmo tempo: alternar B2B/B2C não perde o que foi digitado', () => {
    const p = perfilSchema.parse({
      tipoCliente: 'B2C',
      alvoB2B: { cnaesAlvo: ['6201-5'] },
      alvoB2C: { regiaoCidade: ['Moema'] },
    });
    // O cliente veio do B2B, trocou para B2C. O que ele digitou no B2B continua lá.
    expect(p.alvoB2B.cnaesAlvo).toEqual(['6201-5']);
    expect(p.alvoB2C.regiaoCidade).toEqual(['Moema']);
  });

  it('rejeita ciclo de venda fora da lista', () => {
    expect(() => perfilSchema.parse({ alvoB2B: { cicloVenda: 'ETERNO' } })).toThrow();
  });

  it('descarta tag vazia em vez de guardar lixo', () => {
    expect(() => perfilSchema.parse({ doresResolvidas: [''] })).toThrow();
  });

  it('ticketMedio é faixa em texto, não número', () => {
    const p = perfilSchema.parse({ ticketMedio: 'R$ 5k-15k/mês' });
    expect(p.ticketMedio).toBe('R$ 5k-15k/mês');
  });
});

describe('alvoAtivo', () => {
  it('devolve o alvo do tipoCliente, discriminado', () => {
    const b2b = alvoAtivo(perfilSchema.parse({ tipoCliente: 'B2B', alvoB2B: { cnaesAlvo: ['6201-5'] } }));
    expect(b2b.tipoCliente).toBe('B2B');
    if (b2b.tipoCliente === 'B2B') expect(b2b.alvo.cnaesAlvo).toEqual(['6201-5']);

    const b2c = alvoAtivo(perfilSchema.parse({ tipoCliente: 'B2C', alvoB2C: { faixaEtaria: '30-50' } }));
    expect(b2c.tipoCliente).toBe('B2C');
    if (b2c.tipoCliente === 'B2C') expect(b2c.alvo.faixaEtaria).toBe('30-50');
  });
});

describe('modoDaDescoberta (consumo de roteamento do tipoCliente)', () => {
  it('perfil B2C roteia a descoberta para o motor B (Places)', () => {
    expect(modoDaDescoberta(undefined, { tipoCliente: 'B2C' })).toBe('B2C');
  });

  it('perfil B2B (ou ausente) roteia para a descoberta pública de CNPJ', () => {
    expect(modoDaDescoberta(undefined, { tipoCliente: 'B2B' })).toBe('B2B');
    expect(modoDaDescoberta(undefined, null)).toBe('B2B');
  });

  it('kind explícito do request vence o tipoCliente do perfil', () => {
    expect(modoDaDescoberta('B2B', { tipoCliente: 'B2C' })).toBe('B2B');
    expect(modoDaDescoberta('B2C', { tipoCliente: 'B2B' })).toBe('B2C');
  });
});

describe('computePerfilProntidao', () => {
  const GATE = 60; // motorA.ts / motorB.ts / descobertaPublica.ts

  it('perfil vazio fica em zero', () => {
    expect(computePerfilProntidao(vazio())).toBe(0);
  });

  it('B2B: só os obrigatórios do formulário já passam do gate', () => {
    const score = computePerfilProntidao(obrigatoriosB2B());
    expect(score).toBeGreaterThanOrEqual(GATE);
  });

  it('B2C: só os obrigatórios do formulário já passam do gate', () => {
    const score = computePerfilProntidao(obrigatoriosB2C());
    expect(score).toBeGreaterThanOrEqual(GATE);
  });

  it('obrigatórios completos partem de 65: passam do gate mesmo sem nenhum opcional', () => {
    expect(computePerfilProntidao(obrigatoriosB2B())).toBe(65);
    expect(computePerfilProntidao(obrigatoriosB2C())).toBe(65);
  });

  it('cada opcional sobe o número, sem mudar o direito de rodar', () => {
    const base = obrigatoriosB2B();
    const comSegmento = { ...base, segmento: 'Infraestrutura de TI' };
    expect(computePerfilProntidao(comSegmento)).toBeGreaterThan(computePerfilProntidao(base));
  });

  it('faltar um obrigatório do caminho derruba abaixo do gate', () => {
    const semDecisor = perfilSchema.parse({
      tipoCliente: 'B2B',
      segmento: 'Infraestrutura de TI',
      catalogo: [{ nome: 'Consultoria de infra' }],
      doresResolvidas: ['Downtime'],
      alvoB2B: { cnaesAlvo: ['6201-5'] }, // sem decisor
    });
    expect(computePerfilProntidao(semDecisor)).toBeLessThan(GATE);
  });

  it('não passa de 100 nem com tudo preenchido', () => {
    const cheio = perfilSchema.parse({
      tipoCliente: 'B2B',
      segmento: 'Infraestrutura de TI',
      subsegmentos: ['Cloud', 'NOC'],
      catalogo: [{ nome: 'A' }, { nome: 'B' }, { nome: 'C' }],
      doresResolvidas: ['Downtime'],
      resultadosEsperados: ['Menos 30% de custo'],
      casosDeUso: ['Migração'],
      diferenciais: ['SLA 99,9%'],
      concorrentes: ['Empresa X'],
      ticketMedio: 'R$ 5k-15k/mês',
      alvoB2B: {
        cnaesAlvo: ['6201-5'],
        portes: ['Médio'],
        regioes: ['SP'],
        faturamentoAnual: 'R$ 10M-50M',
        numFuncionarios: '50-200',
        technographics: ['usa CRM'],
        sinaisIntencao: ['contratando TI'],
        decisor: ['Diretor de TI'],
        influenciadores: ['Gerente de TI'],
        usuarioFinal: ['Analistas'],
        objecoes: 'Já temos fornecedor',
        cicloVenda: 'MEDIO',
        redFlagsB2B: ['sem equipe de TI'],
        mustHavesB2B: ['equipe própria'],
        clientesReferencia: ['Empresa A'],
      },
    });
    expect(computePerfilProntidao(cheio)).toBe(100);
  });

  it('a conta olha só o caminho ativo: encher o B2C não ajuda um perfil B2B', () => {
    const p = perfilSchema.parse({
      tipoCliente: 'B2B',
      alvoB2C: {
        faixaEtaria: '25-45',
        regiaoCidade: ['Moema'],
        doresDesejos: ['Comer bem'],
        interesses: ['Fitness'],
        canais: ['Instagram'],
      },
    });
    expect(computePerfilProntidao(p)).toBe(0);
  });
});
