/**
 * A188 — a regra que entra no prompt tem de estar inteira.
 * ============================================================================
 * O sugeridor é instruído a devolver "REGRA INVIOLÁVEL #N ... Exemplo
 * CORRETO: ... Exemplo INCORRETO: ..." sem limite de tamanho, recebe 600
 * tokens e depois o código corta cada patch em 600 CARACTERES com slice, sem
 * avisar ninguém. Medido: 170 de 324 sugestões de clientes com exatamente 600
 * caracteres (52%), 106 cortadas antes do exemplo INCORRETO. Cinco fragmentos
 * truncados estão hoje em agents.system_prompt (Iza e Marcia), um deles
 * terminando em "qual tecnolog".
 *
 * Esta é a trava de escrita: função pura, sem I/O, exercitada com os cortes
 * reais que estão em produção.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { regraTerminaEmFraseCompleta } from './agentPromptPatcher.js';

describe('regraTerminaEmFraseCompleta', () => {
  it('aceita regra que termina em pontuação', () => {
    expect(regraTerminaEmFraseCompleta('**REGRA #1:** nunca prometa prazo.')).toBe(true);
    expect(regraTerminaEmFraseCompleta('Pergunte o nome uma vez só!')).toBe(true);
    expect(regraTerminaEmFraseCompleta('Você entendeu?')).toBe(true);
  });

  it('aceita quando a frase fecha com aspas depois da pontuação', () => {
    expect(
      regraTerminaEmFraseCompleta('Exemplo INCORRETO: "respondo em milissegundos."'),
    ).toBe(true);
    expect(regraTerminaEmFraseCompleta('Exemplo CORRETO: "vou confirmar com o time".')).toBe(true);
  });

  it('recusa os cortes reais que estão nos prompts hoje', () => {
    for (const cortado of [
      'REGRA INVIOLÁVEL #7: nunca revele qual tecnolog',
      'Exemplo CORRETO: Acesse agora e co',
      'Fale de forma direta com o cliente e não repita o que sua equ',
      'Use o nome do cliente quando fizer sentido, sem me co',
    ]) {
      expect(regraTerminaEmFraseCompleta(cortado), `deveria recusar: ${cortado}`).toBe(false);
    }
  });

  it('recusa texto vazio', () => {
    expect(regraTerminaEmFraseCompleta('')).toBe(false);
    expect(regraTerminaEmFraseCompleta('    ')).toBe(false);
    expect(regraTerminaEmFraseCompleta(undefined as any)).toBe(false);
  });

  it('recusa regra que termina em vírgula ou em dois pontos', () => {
    expect(regraTerminaEmFraseCompleta('Nunca prometa prazo,')).toBe(false);
    expect(regraTerminaEmFraseCompleta('Exemplo CORRETO:')).toBe(false);
  });

  it('ignora espaço e quebra de linha no fim', () => {
    expect(regraTerminaEmFraseCompleta('Nunca prometa prazo.\n\n  ')).toBe(true);
  });

  it('aceita fim em número ou sigla com ponto final', () => {
    expect(regraTerminaEmFraseCompleta('O desconto máximo é 10%.')).toBe(true);
  });
});
