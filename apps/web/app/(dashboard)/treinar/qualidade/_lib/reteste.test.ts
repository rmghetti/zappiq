/**
 * reteste.test.ts: o texto que o dono lê depois do re-teste (A049).
 * ============================================================================
 * A tela antiga dizia "✓ Re-teste passou: a correção pegou" com base numa
 * única tentativa, e completava que o resultado "não fica gravado". As duas
 * frases deixaram de ser verdade: são três tentativas e elas ficam gravadas.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  tituloDoVeredito,
  rotuloDaAmostra,
  textoDoCusto,
  avisoDeCustoNaTela,
} from './reteste';

describe('tituloDoVeredito', () => {
  it('não promete nem condena no resultado misto', () => {
    expect(tituloDoVeredito('funcionou')).toContain('pegou');
    expect(tituloDoVeredito('nao_funcionou')).toContain('não pegou');
    expect(tituloDoVeredito('indefinido')).toContain('misto');
  });
});

describe('rotuloDaAmostra', () => {
  it('traduz cada tentativa para uma palavra, em português', () => {
    expect(rotuloDaAmostra('pass')).toBe('passou');
    expect(rotuloDaAmostra('partial')).toBe('parcial');
    expect(rotuloDaAmostra('fail')).toBe('reprovou');
    // Falha do provedor não é culpa do agente, e a palavra precisa dizer isso.
    expect(rotuloDaAmostra('erro')).toBe('falha técnica');
  });
});

describe('textoDoCusto', () => {
  it('diz quantas conversas de teste o clique vai gastar', () => {
    const t = textoDoCusto(3);
    expect(t).toContain('3 vezes');
    expect(t).toContain('3 conversas de teste');
    expect(t).toContain('grava o resultado');
  });

  it('não usa travessão', () => {
    expect(textoDoCusto(3)).not.toContain('—');
  });

  it('conta as avaliações também: cada tentativa é uma conversa mais um juiz', () => {
    expect(textoDoCusto(3)).toContain('3 avaliações da IA');
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * PC-2 da revisão: o preço fica NA TELA, não escondido no tooltip.
 * --------------------------------------------------------------------
 * O custo estava só no atributo `title` do botão. Em toque não existe
 * tooltip, então quem clica no celular nunca via o preço. E a cota diária
 * de 7 cliques por empresa precisa estar escrita, senão o 429 chega sem
 * explicação nenhuma.
 * ══════════════════════════════════════════════════════════════════════ */
describe('avisoDeCustoNaTela', () => {
  it('diz o preço do clique e o limite do dia, curto', () => {
    const t = avisoDeCustoNaTela(3, 7);
    expect(t).toContain('3 conversas de teste');
    expect(t).toContain('3 avaliações da IA');
    expect(t).toContain('7 por dia');
  });

  it('não usa travessão', () => {
    expect(avisoDeCustoNaTela(3, 7)).not.toContain('—');
  });
});
