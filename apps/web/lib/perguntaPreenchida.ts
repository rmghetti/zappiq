/**
 * O caminho da Qualidade para o Treinar IA com a pergunta já escrita.
 * ============================================================================
 * Tarefa C2 (Passo 5, P21). Quando o agente reprova num caso de CONHECIMENTO
 * porque a informação não estava na base, o cartão da Qualidade oferece
 * "Cadastrar esta informação": abre /ai-training na aba Perguntas e Respostas
 * com a pergunta do cliente já no campo. O dono só escreve a resposta.
 *
 * Funções puras, testadas fora do componente. A pergunta vai na query string
 * (não é dado pessoal: é a frase do caso de teste) e a aba vai no hash, que é
 * como a página já abre direto numa aba (#qa).
 * ============================================================================
 */

/** Nome do parâmetro da pergunta na URL do Treinar IA. */
export const PARAMETRO_DA_PERGUNTA = 'pergunta';

/** Teto do texto pré-preenchido: pergunta de teste é curta. */
const TETO_DA_PERGUNTA = 300;

/** /ai-training?pergunta=...#qa */
export function linkParaCadastrarPergunta(pergunta: string): string {
  const p = String(pergunta ?? '').trim().slice(0, TETO_DA_PERGUNTA);
  if (!p) return '/ai-training#qa';
  return `/ai-training?${PARAMETRO_DA_PERGUNTA}=${encodeURIComponent(p)}#qa`;
}

/** A pergunta pré-preenchida, lida do `location.search`. Vazia quando não há. */
export function lerPerguntaPreenchida(search: string | null | undefined): string {
  try {
    const v = new URLSearchParams(String(search ?? '')).get(PARAMETRO_DA_PERGUNTA);
    return String(v ?? '').trim().slice(0, TETO_DA_PERGUNTA);
  } catch {
    return '';
  }
}
