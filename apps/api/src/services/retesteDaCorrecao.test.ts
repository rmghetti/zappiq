/**
 * retesteDaCorrecao.test.ts (C3, Passo 14 / A049)
 * ============================================================================
 * "Re-testar agora" rodava UMA amostra a temperatura 0,3 e não gravava nada.
 * Uma amostra só não distingue correção que pegou de sorte, e sem rastro
 * ninguém consegue dizer depois se valeu a pena.
 *
 * Agora são 3 amostras do mesmo cenário contra o mesmo prompt, gravadas. E a
 * frase "a correção não funcionou" só sai quando 2 das 3 reprovam: era o
 * pedido explícito do plano, para não chamar de fracasso o que é ruído.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  AMOSTRAS_DO_RETESTE,
  consolidarReteste,
  type AmostraDoReteste,
} from './retesteDaCorrecao.js';

const amostra = (combined: AmostraDoReteste['combined'], i = 1): AmostraDoReteste => ({
  amostra: i,
  combined,
  resposta: `resposta ${i}`,
  motivoDoJuiz: 'motivo',
});

describe('AMOSTRAS_DO_RETESTE', () => {
  it('são três, e o custo é declarado a partir desse número', () => {
    expect(AMOSTRAS_DO_RETESTE).toBe(3);
  });
});

describe('consolidarReteste', () => {
  it('3 de 3 aprovadas: funcionou', () => {
    const r = consolidarReteste([amostra('pass', 1), amostra('pass', 2), amostra('pass', 3)]);
    expect(r.veredito).toBe('funcionou');
    expect(r.aprovadas).toBe(3);
    expect(r.explicacao).toContain('3 de 3');
  });

  it('2 de 3 aprovadas: funcionou', () => {
    const r = consolidarReteste([amostra('pass', 1), amostra('pass', 2), amostra('fail', 3)]);
    expect(r.veredito).toBe('funcionou');
  });

  it('2 de 3 REPROVADAS: não funcionou (e só nesse caso)', () => {
    const r = consolidarReteste([amostra('fail', 1), amostra('fail', 2), amostra('pass', 3)]);
    expect(r.veredito).toBe('nao_funcionou');
    expect(r.reprovadas).toBe(2);
    expect(r.explicacao).toContain('2 de 3');
  });

  it('1 reprovação isolada NÃO é fracasso: fica indefinido', () => {
    // O caso que o plano pede para não chamar de fracasso: uma reprovação
    // dentro do ruído do agente. Antes, a única amostra decidia sozinha.
    const r = consolidarReteste([amostra('fail', 1), amostra('partial', 2), amostra('pass', 3)]);
    expect(r.veredito).toBe('indefinido');
  });

  it('parcial não conta como aprovação nem como reprovação', () => {
    const r = consolidarReteste([
      amostra('partial', 1),
      amostra('partial', 2),
      amostra('partial', 3),
    ]);
    expect(r.veredito).toBe('indefinido');
    expect(r.aprovadas).toBe(0);
    expect(r.reprovadas).toBe(0);
    expect(r.parciais).toBe(3);
  });

  it('falha técnica fica fora do denominador (mesma régua do arnês v3)', () => {
    const r = consolidarReteste([amostra('erro', 1), amostra('fail', 2), amostra('fail', 3)]);
    expect(r.erros).toBe(1);
    expect(r.avaliadas).toBe(2);
    expect(r.veredito).toBe('nao_funcionou');
  });

  it('com menos de 2 amostras avaliáveis, não se declara nada', () => {
    const r = consolidarReteste([amostra('erro', 1), amostra('erro', 2), amostra('fail', 3)]);
    expect(r.veredito).toBe('indefinido');
    expect(r.explicacao).toMatch(/não deu para avaliar|não foi possível/i);
  });

  it('lista vazia não quebra', () => {
    const r = consolidarReteste([]);
    expect(r.veredito).toBe('indefinido');
    expect(r.avaliadas).toBe(0);
  });
});

// C2 (Passo 1, A226): amostra servida por um modelo de reserva é
// INCONCLUSIVA. Não aprova nem reprova: sai do denominador, como a falha
// técnica.
describe('amostra inconclusiva (modelo de reserva) fica fora da conta', () => {
  it('duas aprovações e uma inconclusiva: funcionou, com 2 avaliadas', () => {
    const r = consolidarReteste([
      { amostra: 1, combined: 'pass', resposta: 'a', motivoDoJuiz: '' },
      { amostra: 2, combined: 'inconclusivo', resposta: 'b', motivoDoJuiz: '' },
      { amostra: 3, combined: 'pass', resposta: 'c', motivoDoJuiz: '' },
    ]);
    expect(r.veredito).toBe('funcionou');
    expect(r.avaliadas).toBe(2);
    expect(r.erros).toBe(1);
  });

  it('só uma avaliável: indefinido, sem declarar nada', () => {
    const r = consolidarReteste([
      { amostra: 1, combined: 'fail', resposta: 'a', motivoDoJuiz: '' },
      { amostra: 2, combined: 'inconclusivo', resposta: 'b', motivoDoJuiz: '' },
      { amostra: 3, combined: 'inconclusivo', resposta: 'c', motivoDoJuiz: '' },
    ]);
    expect(r.veredito).toBe('indefinido');
  });
});
