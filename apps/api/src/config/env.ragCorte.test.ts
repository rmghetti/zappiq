/**
 * env.ragCorte.test.ts (I2 da revisão do PR #365)
 * ============================================================================
 * O corte absoluto da busca é decidido AQUI e viaja no corpo do /query. Ele
 * entra em 0,30, não em 0,35, e a diferença não é detalhe.
 *
 * A assimetria: cortar de menos custa um trecho a mais no prompt, que é barato
 * e o corte RELATIVO (0,60 do melhor resultado) derruba assim que aparece um
 * resultado bom. Cortar de mais custa a resposta certa do cliente que tem pouco
 * conteúdo treinado, e isso ele sente na hora.
 *
 * A mediana medida do ruído real (conteúdo de OUTRA empresa) é 0,375, acima de
 * 0,35: quem separa relevante de irrelevante não é este número, é o corte
 * relativo. 0,35 fica como meta a confirmar pelo recall_eval.py contra CMJ e
 * MACHIA antes de subir.
 * ============================================================================
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('RAG_MIN_SIMILARITY (corte absoluto da busca)', () => {
  const original = process.env.RAG_MIN_SIMILARITY;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (original === undefined) delete process.env.RAG_MIN_SIMILARITY;
    else process.env.RAG_MIN_SIMILARITY = original;
  });

  it('entra em 0,30 quando ninguém define a variável', async () => {
    delete process.env.RAG_MIN_SIMILARITY;
    const { env } = await import('./env.js');
    expect(env.RAG_MIN_SIMILARITY).toBe(0.3);
  });

  it('a variável de ambiente manda, para apertar ou afrouxar sem deploy', async () => {
    process.env.RAG_MIN_SIMILARITY = '0.45';
    const { env } = await import('./env.js');
    expect(env.RAG_MIN_SIMILARITY).toBe(0.45);
  });
});
