/**
 * Maestro v3 (Spec 1A) — normalização do conteúdo inbound do WhatsApp. PURO.
 * Ponto único usado pelo webhook: respostas de botão/lista entram como o TÍTULO
 * escolhido (para keyword/captura casarem), texto/legenda como estão, e tipos
 * sem texto viram um marcador [type].
 */
export function inboundContentFromMessage(message: any): string {
  return (
    message?.text?.body
    || message?.caption
    || message?.interactive?.button_reply?.title
    || message?.interactive?.list_reply?.title
    || `[${message?.type}]`
  );
}
