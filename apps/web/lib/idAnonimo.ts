/**
 * Identificador aleatório de visitante para o chat do site (P7).
 * ----------------------------------------------------------------------------
 * O chat guarda o identificador da conversa no localStorage. Quando o navegador
 * recusa o armazenamento (janela anônima, cookies de terceiro bloqueados, site
 * data desligado), o código caía em `'anon-' + Date.now()`. Dois visitantes no
 * mesmo milissegundo ficavam com o mesmo identificador, e o histórico de um
 * podia aparecer para o outro. E como o valor é o relógio, quem soubesse o
 * horário aproximado conseguia adivinhar o identificador alheio.
 *
 * Aqui o valor é aleatório de verdade. `crypto.randomUUID` existe em todo
 * navegador atual em contexto seguro; o caminho de reserva com `Math.random`
 * fica para navegador antigo e para http sem TLS, onde `crypto` pode faltar.
 */
export function idAleatorio(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Alguns navegadores lançam ao tocar em crypto fora de contexto seguro.
  }
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
}
