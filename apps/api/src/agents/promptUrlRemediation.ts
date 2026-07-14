/* ══════════════════════════════════════════════════════════════════════
 * Remediação: tira o bloco de URLs da ZappIQ de um prompt já gravado.
 * --------------------------------------------------------------------
 * O promptEngine ganhou o bloco "### URLs canônicas ZappIQ" em 12/05/2026.
 * O buildSeedSystemPrompt (05/07/2026, W1.5) passou a congelar a saída do
 * promptEngine no Agent.systemPrompt de cada org. Todo Agent seedado desde
 * então carrega os NOSSOS links dentro do prompt do cliente:
 *
 *   ### URLs canônicas ZappIQ (use EXATAMENTE essas, sem inventar variações)
 *   - Signup / trial: https://zappiq.com.br/cadastro
 *
 * Corrigir o promptEngine (o que este PR faz) só vale pra seed novo: o que já
 * está gravado no banco continua mandando o lead do cliente pro nosso cadastro.
 * Daí esta remediação.
 *
 * Cirúrgica de propósito, nunca regenerar:
 *   O prompt gravado acumula customização (o da Iza tem ~27k chars de patches
 *   à mão contra ~4k do seed). Regenerar apagaria esse trabalho. Aqui trocamos
 *   só a seção de URLs pela versão sem marca — a mesma que o promptEngine gera
 *   hoje —, preservando todo o resto, byte a byte.
 * ══════════════════════════════════════════════════════════════════════ */

/** Cabeçalho da seção contaminada. O `###` é o que delimita seção no prompt. */
const HEADING_ANTIGO = '### URLs canônicas ZappIQ';

/**
 * Substituto sem marca. É o texto que o promptEngine gera hoje, copiado
 * literalmente: depois da remediação, prompt velho e prompt novo dizem a mesma
 * coisa sobre URL.
 */
const SECAO_NOVA = `### URLs (regra geral)
Sempre que mencionar URL, escreva a URL completa com https://. Não mande caminho solto
(tipo "/pagina") nem "acesse o site": o cliente está no WhatsApp do celular e precisa do
link tocável. NUNCA invente uma URL nem invente variação de uma URL que você conhece.
Se você não tiver o link na sua base de conhecimento, diga que vai verificar e mandar o
endereço certo.`;

export interface RemediacaoResultado {
  /** Prompt já sem a seção da ZappIQ. */
  prompt: string;
  /** Texto exato que saiu, pra auditoria e pro revert conferir. */
  removido: string;
}

/**
 * Troca a seção "### URLs canônicas ZappIQ" pela versão sem marca.
 *
 * Delimita pelo cabeçalho `###` seguinte (ou pelo fim do texto), então tolera
 * variação de conteúdo dentro da seção — prompts de seeds diferentes não são
 * byte-idênticos.
 *
 * @returns null quando não há o que remediar (prompt já limpo). null é o caso
 *          normal e NÃO é erro: quem chama simplesmente não grava nada.
 */
export function removerBlocoUrlsZappIQ(systemPrompt: string): RemediacaoResultado | null {
  if (!systemPrompt) return null;

  const inicio = systemPrompt.indexOf(HEADING_ANTIGO);
  if (inicio === -1) return null;

  // Fim = próximo cabeçalho de seção depois do nosso, ou fim do prompt.
  const depoisDoHeading = inicio + HEADING_ANTIGO.length;
  const proximaSecao = systemPrompt.indexOf('\n### ', depoisDoHeading);
  const fim = proximaSecao === -1 ? systemPrompt.length : proximaSecao;

  const removido = systemPrompt.slice(inicio, fim);
  const prompt = systemPrompt.slice(0, inicio) + SECAO_NOVA + systemPrompt.slice(fim);

  return { prompt, removido };
}
