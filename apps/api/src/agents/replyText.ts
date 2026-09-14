/* ══════════════════════════════════════════════════════════════════════
 * A resposta que o cliente final lê: uma função só, usada por todos.
 * --------------------------------------------------------------------
 * O promptEngine manda o modelo fechar a resposta em <reply>…</reply>, e o
 * modelo costuma escrever o texto em prosa e REPETIR dentro da tag. Quem lê
 * `resp.text` cru vê a resposta duas vezes, com tags no meio.
 *
 * O WhatsApp (agentOrchestrator) e o "Testar minha IA" já tratavam disso. O
 * avaliador da Qualidade não: julgava o texto dobrado e mostrava as tags no
 * cartão "Resposta do agente" (achado A088, 365 respostas desde 01/07).
 *
 * Este módulo é a definição ÚNICA. O orquestrador, o playground e o avaliador
 * chamam daqui. Ele não importa nada pesado de propósito: precisa ser usável
 * dentro do avaliador e da regravação sem arrastar banco, RAG nem fila.
 * ══════════════════════════════════════════════════════════════════════ */

import { applyVozHumanaFilter } from './vozHumanaFilter.js';

/**
 * V4 #159 (PR #71 HOTFIX) — Remove tags estruturadas que escaparam pra
 * dentro do replyText. Cobre: <action>, <action_data>, <buttons>, <reply>
 * (open/close, e self-closing por garantia). Case-insensitive. Multi-line.
 */
export function stripStructuredTags(text: string): string {
  if (!text) return text;
  return text
    .replace(/<action_data>[\s\S]*?<\/action_data>/gi, '')
    .replace(/<action>[\s\S]*?<\/action>/gi, '')
    .replace(/<buttons>[\s\S]*?<\/buttons>/gi, '')
    .replace(/<\/?reply>/gi, '')
    // Tags solitárias remanescentes (ex: <action> sem fechamento por bug LLM)
    .replace(/<\/?(action|action_data|buttons|reply)\b[^>]*>/gi, '')
    .trim();
}

/**
 * V4 #159 (PR #71 HOTFIX) — Remove prefixos vazados do PR #69.
 * Quando audio inbound era transcrito, salvávamos "[áudio transcrito] X"
 * no Message.content. Esse texto entrava no history e a Iza, vendo o padrão,
 * imitava em respostas (ex: "[áudio] Oi, Ana!"). TTS sintetizava
 * literalmente "abre colchete áudio fecha colchete".
 *
 * Esta função remove SOMENTE no INÍCIO do texto (não no meio — alguém pode
 * legitimamente discutir áudios em geral). Conservador.
 */
export function stripLeakedPrefixes(text: string): string {
  if (!text) return text;
  // Remove "[áudio]", "[audio]", "[áudio transcrito]", "[texto]", "[transcrito]"
  // no início, com possíveis espaços. Case-insensitive.
  return text
    .replace(/^\s*\[(áudio|audio|áudio transcrito|audio transcrito|texto|transcrito)\]\s*/i, '')
    .trim();
}

/**
 * O texto que o cliente final receberia, a partir da saída crua do modelo.
 *
 * Ordem igual à de produção (agentOrchestrator.parseAgentResponse):
 * conteúdo de <reply> quando existe, depois limpeza de tags, depois prefixos
 * vazados, depois o filtro de voz humana.
 */
export function extractProductionReplyText(rawResponse: string): string {
  const cru = rawResponse ?? '';
  const replyMatch = cru.match(/<reply>([\s\S]*?)<\/reply>/i);
  let candidate = replyMatch ? replyMatch[1].trim() : cru.trim();
  candidate = stripStructuredTags(candidate);
  candidate = stripLeakedPrefixes(candidate);
  candidate = applyVozHumanaFilter(candidate);
  return candidate;
}
