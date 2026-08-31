/**
 * Qualificação de sócio: o espelho do BigQuery guarda o CÓDIGO da Receita
 * ('22', '49', '16'), não o texto. Achado em produção (21/07): 45 de 49
 * decisores com arquétipo nulo e papel exibido como '22' em vez de 'Sócio',
 * porque arquetipoFromQualificacao só entendia texto. Mesmo padrão do porte.
 */
import { describe, it, expect } from 'vitest';
import { descricaoQualificacao, arquetipoFromQualificacao } from './cnpj.js';

describe('descricaoQualificacao: código da Receita vira texto legível', () => {
  it('traduz os códigos que aparecem em produção', () => {
    expect(descricaoQualificacao('22')).toBe('Sócio');
    expect(descricaoQualificacao('5')).toBe('Administrador'); // 1 dígito também
    expect(descricaoQualificacao('16')).toBe('Presidente');
    expect(descricaoQualificacao('49')).toBe('Sócio-Administrador');
    expect(descricaoQualificacao('65')).toBe('Titular Pessoa Física Residente ou Domiciliado no Brasil');
  });
  it('texto passa direto (BrasilAPI e titular de EI já vêm em texto)', () => {
    expect(descricaoQualificacao('Sócio-Administrador')).toBe('Sócio-Administrador');
    expect(descricaoQualificacao('Empresário Individual')).toBe('Empresário Individual');
  });
  it('vazio e código desconhecido não quebram', () => {
    expect(descricaoQualificacao('')).toBe('');
    expect(descricaoQualificacao(null)).toBe('');
    expect(descricaoQualificacao('99')).toBe('99'); // fora da tabela: passa direto
  });
});

describe('arquetipoFromQualificacao: funciona por código E por texto', () => {
  it('sócio e titular viram EXEC_SPONSOR (o dono/topo)', () => {
    expect(arquetipoFromQualificacao('22')).toBe('EXEC_SPONSOR'); // Sócio
    expect(arquetipoFromQualificacao('65')).toBe('EXEC_SPONSOR'); // Titular PF
    expect(arquetipoFromQualificacao('50')).toBe('EXEC_SPONSOR'); // Empresário
    expect(arquetipoFromQualificacao('54')).toBe('EXEC_SPONSOR'); // Fundador
    expect(arquetipoFromQualificacao('Empresário Individual')).toBe('EXEC_SPONSOR');
  });
  it('administrador/presidente/diretor viram ECONOMIC_BUYER', () => {
    expect(arquetipoFromQualificacao('5')).toBe('ECONOMIC_BUYER'); // Administrador
    expect(arquetipoFromQualificacao('16')).toBe('ECONOMIC_BUYER'); // Presidente
    expect(arquetipoFromQualificacao('10')).toBe('ECONOMIC_BUYER'); // Diretor
    expect(arquetipoFromQualificacao('49')).toBe('ECONOMIC_BUYER'); // Sócio-Administrador (admin manda)
  });
  it('texto continua funcionando (não regride o caminho BrasilAPI)', () => {
    expect(arquetipoFromQualificacao('Sócia-Administradora')).toBe('ECONOMIC_BUYER');
    expect(arquetipoFromQualificacao('Sócio')).toBe('EXEC_SPONSOR');
  });
  it('qualificação sem papel de decisão fica null (benefício da dúvida)', () => {
    expect(arquetipoFromQualificacao('17')).toBeNull(); // Procurador
    expect(arquetipoFromQualificacao('99')).toBeNull(); // desconhecido
  });
});
