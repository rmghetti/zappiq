/* ══════════════════════════════════════════════════════════════════════
 * Voz Humana Filter — camada de limpeza determinística pós-LLM
 * --------------------------------------------------------------------
 * Remove marcadores de geração automática que escapam do system prompt.
 * Aplicado sobre o replyText de TODO agente ZappIQ (Iza + agentes de
 * clientes) em parseAgentResponse(), antes de enviar ao usuário.
 *
 * Complementa CR-9 (coreAgentRules): o system prompt instrui o LLM a
 * não gerar esses padrões; este filtro é a rede de segurança.
 *
 * Referência: skill voz-humana (Layer 1 — Limpeza de marcadores de IA)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * Aplica as 4 substituições determinísticas da Camada 1 do protocolo
 * Voz Humana sobre texto que vai ser enviado ao cliente.
 *
 * Conservador por design: só remove padrões com alta taxa de falso-positivo
 * nulo (conectivos de IA, travessão em dash, aberturas de e-mail genéricas).
 * Não reescreve frases longas — isso é trabalho do LLM via CR-9.
 */
export function applyVozHumanaFilter(text: string): string {
  if (!text) return text;

  let t = text;

  // 1. Travessão em dash (—) → vírgula
  //    Humanos no WhatsApp não usam em dash. LLMs adoram.
  t = t.replace(/ — /g, ', ');
  t = t.replace(/^— /gm, '');

  // 2. Conectivos de redação escolar → equivalentes mais naturais
  t = t.replace(/\bAlém disso,?\s*/gi, '');
  t = t.replace(/\bNo entanto,?\s*/gi, 'Mas ');
  t = t.replace(/\bContudo,?\s*/gi, 'Mas ');
  t = t.replace(/\bTodavia,?\s*/gi, 'Mas ');
  t = t.replace(/\bPortanto,?\s*/gi, 'Então ');
  t = t.replace(/\bAssim sendo,?\s*/gi, 'Então ');
  t = t.replace(/\bDiante disso,?\s*/gi, 'Por isso ');
  t = t.replace(/\bNesse sentido,?\s*/gi, '');
  t = t.replace(/\bNeste contexto,?\s*/gi, '');
  t = t.replace(/\bCertamente[,.]?\s*/gi, '');
  t = t.replace(/\bIndubitavelmente[,.]?\s*/gi, '');

  // 3. Anúncios desnecessários antes do conteúdo
  t = t.replace(/\bÉ importante ressaltar que\s*/gi, '');
  t = t.replace(/\bVale destacar que\s*/gi, '');
  t = t.replace(/\bCabe mencionar que\s*/gi, '');
  t = t.replace(/\bvale ressaltar que\s*/gi, '');

  // 4. Termos vagos/corporativos comuns em geração de IA
  //    Substitui pela ausência — o conteúdo concreto deve estar na frase.
  t = t.replace(/\bde forma eficaz\b/gi, '');
  t = t.replace(/\bde maneira eficiente\b/gi, '');
  t = t.replace(/\bde modo assertivo\b/gi, '');
  t = t.replace(/\bde forma eficiente\b/gi, '');
  t = t.replace(/\balavancar\b/gi, 'usar');
  t = t.replace(/\bpotencializar\b/gi, 'ampliar');
  t = t.replace(/\brobusto\b/gi, 'sólido');

  // 5. Abertura de e-mail genérica (vaza em mensagens formais)
  t = t.replace(/Espero que (este|essa) (e-?mail|mensagem) te encontre bem[.!]?\s*/gi, '');
  t = t.replace(/Espero que esteja bem[.!]?\s*/gi, '');

  // 6. Fechamentos excessivamente formais
  t = t.replace(/^Atenciosamente,?\s*\n/gim, '');

  // 7. Limpeza de espaços duplos gerados pelas substituições acima
  t = t.replace(/  +/g, ' ');
  t = t.replace(/^ /gm, '');

  return t.trim();
}
