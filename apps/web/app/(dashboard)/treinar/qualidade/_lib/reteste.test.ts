/**
 * reteste.test.ts — o texto que o dono lê depois do re-teste (A049).
 * ============================================================================
 * A tela antiga dizia "✓ Re-teste passou: a correção pegou" com base numa
 * única tentativa, e completava que o resultado "não fica gravado". As duas
 * frases deixaram de ser verdade: são três tentativas e elas ficam gravadas.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { tituloDoVeredito, rotuloDaAmostra, textoDoCusto } from './reteste';

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
});
