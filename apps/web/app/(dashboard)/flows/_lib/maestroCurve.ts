/**
 * Curva da barra de progresso do Maestro.
 * ============================================================================
 * Vive separada do componente porque é a única parte do progresso que pode
 * estar ERRADA de um jeito que o cliente vê: se a curva ultrapassar o teto, a
 * barra anuncia um marco que o servidor não confirmou; se andar pra trás, o
 * número perde credibilidade. Isso é lógica, e lógica se testa (o componente em
 * volta é fiação de React e segue sem teste, como o resto da app).
 *
 * O problema que ela resolve: o servidor manda marcos reais e esparsos ("estou
 * em 6%, o próximo é 97%, costuma levar 22s"), porque no caminho de 1 objetivo
 * existe UMA chamada de LLM que come quase todo o tempo. Interpolar linear
 * bateria no teto e travaria; interpolar assintótico deixa a barra sempre viva
 * sem nunca chegar onde o servidor não disse que chegou.
 * ============================================================================
 */

export interface MaestroAnchor {
  /** Quando este marco chegou (ms, mesma base de tempo do `now`). */
  at: number;
  /** Percentual REAL do marco: o servidor garante que já passamos daqui. */
  from: number;
  /** Teto. A curva se aproxima e nunca alcança — só o próximo marco libera. */
  to: number;
  /** Duração típica da etapa, calibra a velocidade. */
  eta: number;
}

/**
 * Onde a barra deve estar em `now`.
 *
 * 1 - e^(-3t/eta): cobre 95% do trecho quando t = eta, 99,75% quando t = 2·eta,
 * e nunca chega em 1. Estourar a estimativa faz a barra desacelerar e esperar,
 * que é o comportamento honesto — o alternativo seria bater 100% e mentir.
 */
export function easeTowards(a: MaestroAnchor, now: number): number {
  // Clock pra trás (troca de aba, ajuste de relógio) não pode fazer a barra voltar.
  const elapsed = Math.max(0, now - a.at);
  // eta 0 viraria divisão por zero: o max mantém a curva finita e a barra salta
  // pro teto, que é o certo pra uma etapa instantânea.
  const progress = 1 - Math.exp((-3 * elapsed) / Math.max(a.eta, 1));
  return a.from + (a.to - a.from) * progress;
}
