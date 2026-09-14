/**
 * A049 — o re-teste na linguagem do dono do negócio.
 * ============================================================================
 * O re-teste rodava UMA vez, não gravava nada, e a tela dizia "a correção
 * pegou" com base nessa única tentativa. Agora são três tentativas gravadas, e
 * a tela precisa mostrar as três sem transformar uma reprovação isolada em
 * "não funcionou".
 *
 * Estas funções são puras e ficam aqui, fora do componente, porque é texto que
 * o cliente lê: merece teste, não revisão visual.
 * ============================================================================
 */

export type VereditoDoReteste = 'funcionou' | 'nao_funcionou' | 'indefinido';
export type VereditoDaAmostra = 'pass' | 'partial' | 'fail' | 'erro';

/** Título do cartão do re-teste. Curto: a explicação vem logo abaixo. */
export function tituloDoVeredito(veredito: VereditoDoReteste): string {
  if (veredito === 'funcionou') return '✓ A correção pegou';
  if (veredito === 'nao_funcionou') return '✗ A correção não pegou';
  return '⚠ Resultado misto';
}

/** Cada tentativa, em uma palavra que o dono entende sem glossário. */
export function rotuloDaAmostra(combined: VereditoDaAmostra): string {
  if (combined === 'pass') return 'passou';
  if (combined === 'partial') return 'parcial';
  if (combined === 'fail') return 'reprovou';
  return 'falha técnica';
}

/**
 * O custo, declarado ANTES do clique.
 *
 * Três tentativas custam três conversas de teste. Esconder isso era o padrão
 * antigo da tela, e o plano pede o contrário: o dono decide sabendo o preço.
 */
export function textoDoCusto(amostras: number): string {
  return (
    `Roda esse caso ${amostras} vezes contra o comportamento atual, mostra cada tentativa e ` +
    `grava o resultado no histórico do agente. São ${amostras} conversas de teste com a IA.`
  );
}
