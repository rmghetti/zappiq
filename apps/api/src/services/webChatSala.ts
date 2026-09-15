/* ══════════════════════════════════════════════════════════════════════
 * webChatSala: onde o visitante do chat do site escuta a equipe.
 * --------------------------------------------------------------------
 * Tarefa C1b (Passo 3, A158 e A169). Pura: só nomes e conversões, sem
 * socket nem banco. Quem emite (channelDispatcher) e quem põe o visitante
 * na sala (webChatSocket) usam as MESMAS definições daqui.
 *
 * O visitante é identificado pela sessão que o widget guarda no
 * navegador. O contato dele no CRM tem `whatsappId = web:<sessão>`
 * (buildWebChatLeadIdentity), e a sala do socket é a da organização com
 * essa sessão.
 * ══════════════════════════════════════════════════════════════════════ */

/** Namespace do socket.io dos visitantes. O painel usa o '/', com JWT. */
export const NAMESPACE_DO_CHAT_DO_SITE = '/web-chat';

/** Evento que leva ao widget a mensagem escrita por alguém da equipe. */
export const EVENTO_MENSAGEM_DA_EQUIPE = 'mensagem_da_equipe';

/** Mesmo teto de buildWebChatLeadIdentity: a sessão é cortada em 64. */
export const MAX_SESSAO = 64;

/** A sessão como o servidor a guarda (mesma limpeza do lead do CRM). */
export function sessaoNormalizada(sessionId: unknown): string | null {
  if (typeof sessionId !== 'string') return null;
  const limpa = sessionId.trim().slice(0, MAX_SESSAO);
  return limpa ? limpa : null;
}

/** A sala do visitante: uma por organização e sessão. */
export function salaDoVisitante(organizationId: string, sessionId: string): string {
  return `visitante:${organizationId}:${sessionId}`;
}

/** `web:<sessão>` do contato vira `<sessão>`. Qualquer outra coisa, null. */
export function sessaoDoContato(whatsappId: string | null | undefined): string | null {
  if (typeof whatsappId !== 'string' || !whatsappId.startsWith('web:')) return null;
  return sessaoNormalizada(whatsappId.slice('web:'.length));
}
