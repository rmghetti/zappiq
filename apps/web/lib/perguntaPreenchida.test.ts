/**
 * O "Cadastrar esta informação" da Qualidade abre o Treinar IA com a
 * pergunta já escrita (C2, Passo 5).
 */
import { describe, it, expect } from 'vitest';
import { linkParaCadastrarPergunta, lerPerguntaPreenchida } from './perguntaPreenchida';

describe('linkParaCadastrarPergunta', () => {
  it('abre a aba Perguntas e Respostas com a pergunta na URL', () => {
    const link = linkParaCadastrarPergunta('Vocês entregam no domingo?');
    expect(link.startsWith('/ai-training?pergunta=')).toBe(true);
    expect(link.endsWith('#qa')).toBe(true);
    expect(lerPerguntaPreenchida(link.slice(link.indexOf('?'), link.indexOf('#')))).toBe(
      'Vocês entregam no domingo?',
    );
  });

  it('sem pergunta, abre a aba sem pré-preencher', () => {
    expect(linkParaCadastrarPergunta('  ')).toBe('/ai-training#qa');
  });

  it('acento, "&" e "?" atravessam a URL sem quebrar', () => {
    const p = 'Quanto custa a revisão & o alinhamento?';
    const link = linkParaCadastrarPergunta(p);
    expect(lerPerguntaPreenchida(link.slice(link.indexOf('?'), link.indexOf('#')))).toBe(p);
  });
});

describe('lerPerguntaPreenchida', () => {
  it('sem o parâmetro, devolve vazio', () => {
    expect(lerPerguntaPreenchida('')).toBe('');
    expect(lerPerguntaPreenchida('?outra=1')).toBe('');
    expect(lerPerguntaPreenchida(undefined)).toBe('');
  });
});
