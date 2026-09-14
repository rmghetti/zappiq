/**
 * A188 na tela do cliente: sugestão cortada não mostra o botão Aplicar.
 * ============================================================================
 * A API recusa aplicar a regra cortada (portão 422), mas o cliente só
 * descobria isso depois de clicar e levar um erro técnico na cara. A mesma
 * régua roda aqui, antes do clique, e com uma frase que diz o que fazer.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { regraTerminaEmFraseCompleta, AVISO_SUGESTAO_INCOMPLETA } from './sugestao';

describe('regraTerminaEmFraseCompleta (tela do cliente)', () => {
  it('aceita regra que fecha a frase', () => {
    expect(regraTerminaEmFraseCompleta('**REGRA #1:** nunca prometa prazo.')).toBe(true);
    expect(regraTerminaEmFraseCompleta('Exemplo CORRETO: "vou confirmar com o time".')).toBe(true);
    expect(regraTerminaEmFraseCompleta('Exemplo INCORRETO: "respondo em milissegundos."')).toBe(
      true,
    );
  });

  it('recusa os cortes reais que estão nos prompts hoje', () => {
    for (const cortado of [
      'REGRA INVIOLÁVEL #7: nunca revele qual tecnolog',
      'Exemplo CORRETO: Acesse agora e co',
      'Exemplo CORRETO:',
      'Nunca prometa prazo,',
    ]) {
      expect(regraTerminaEmFraseCompleta(cortado), `deveria recusar: ${cortado}`).toBe(false);
    }
  });

  it('recusa vazio e indefinido sem quebrar', () => {
    expect(regraTerminaEmFraseCompleta('')).toBe(false);
    expect(regraTerminaEmFraseCompleta('   ')).toBe(false);
    expect(regraTerminaEmFraseCompleta(undefined as any)).toBe(false);
  });

  it('ignora espaço e quebra de linha no fim', () => {
    expect(regraTerminaEmFraseCompleta('Nunca prometa prazo.\n\n  ')).toBe(true);
  });
});

describe('AVISO_SUGESTAO_INCOMPLETA', () => {
  it('é a frase acordada, sem travessão e sem jargão', () => {
    expect(AVISO_SUGESTAO_INCOMPLETA).toBe(
      'Esta sugestão saiu incompleta. Edite antes de aplicar.',
    );
    expect(AVISO_SUGESTAO_INCOMPLETA).not.toContain('—');
  });
});
