/**
 * A188 — a regra que vai para o prompt está inteira?
 * ============================================================================
 * Cópia deliberada da régua que roda na API (agentPromptPatcher.ts). O web não
 * importa do apps/api, e duplicar sete linhas puras custa menos do que um
 * pacote compartilhado só para isto. As duas têm teste próprio com os mesmos
 * cortes reais medidos em produção.
 *
 * Por que existe na tela: a API recusa aplicar a regra cortada com 422, mas
 * o cliente só descobria depois de clicar. Aqui o botão Aplicar some antes,
 * e no lugar dele aparece o que fazer.
 * ============================================================================
 */

export function regraTerminaEmFraseCompleta(texto: string): boolean {
  const t = String(texto ?? '').trim();
  if (t.length === 0) return false;
  // Fechamentos de citação, parêntese e ênfase de markdown não contam como
  // fim de frase: o que importa é o caractere logo antes deles.
  const semFechamento = t.replace(/[”"'’»)\]*`]+$/u, '').trimEnd();
  if (semFechamento.length === 0) return false;
  return /[.!?…]$/u.test(semFechamento);
}

/** Frase única, para não haver duas versões do mesmo aviso na tela. */
export const AVISO_SUGESTAO_INCOMPLETA =
  'Esta sugestão saiu incompleta. Edite antes de aplicar.';
