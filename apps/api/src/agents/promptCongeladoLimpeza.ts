/* ══════════════════════════════════════════════════════════════════════
 * Limpeza dos prompts já gravados: tira o que envelheceu no texto.
 * --------------------------------------------------------------------
 * Trabalho de TEXTO, puro, no mesmo espírito de promptUrlRemediation.ts. A
 * orquestração com o banco fica no script (scripts/limparPromptsCongelados.ts).
 *
 * Três coisas saem, e só elas:
 *
 *   1. `## HORÁRIO DE FUNCIONAMENTO`: a seção inteira. Ela foi gravada com
 *      o formato que o promptEngine sabia ler e, para quem cadastrou pelo
 *      onboarding, saiu só com a linha inventada "• Domingo: Fechado". A
 *      Antonella abre domingo das 12h às 22h. O horário volta VIVO, montado
 *      no turno a partir das settings (A059).
 *
 *   2. `Data/hora atual: ...`, a linha com o momento do cadastro. Catorze
 *      agentes carregam uma data de julho e o turno ainda acrescenta o bloco
 *      "# Agora": o modelo recebia duas datas contraditórias (A060).
 *
 *   3. `### Fluxo de Agendamento`: a seção inteira. Mandava confirmar o
 *      agendamento e avisar que "um lembrete será enviado 24h e 1h antes".
 *      A ação schedule só pisca uma notificação no painel e não existe envio
 *      de lembrete no produto (A153, A164, A194).
 *
 * O que NÃO sai, de propósito: tudo o mais. Customização do cliente, patches
 * da Qualidade, seção de segmento, tom congelado. O tom fica porque a decisão
 * foi cirúrgica nestes três itens; o bloco vivo entra DEPOIS no prompt e
 * declara que vale mais que o texto anterior.
 *
 * Duas recusas, e elas existem para o dia em que o texto do banco não for o
 * que esperamos: o resultado precisa manter a linha `## IDENTIDADE` e ficar
 * com pelo menos 60% do tamanho original. Prefere-se deixar o prompt velho a
 * gravar algo que passou perto.
 * ══════════════════════════════════════════════════════════════════════ */

/** Proporção mínima do tamanho original que o resultado precisa manter. */
export const PROPORCAO_MINIMA = 0.6;

export type MotivoRecusa = 'perdeu_identidade' | 'encolheu_demais';

export interface LimpezaResultado {
  /** O prompt depois da limpeza. Igual ao original quando nada mudou. */
  prompt: string;
  /** Trechos retirados, na ordem. Serve de auditoria e de diff. */
  removidos: string[];
  mudou: boolean;
  /** Quando preenchido, NÃO grave: a limpeza não passou na trava. */
  recusa: MotivoRecusa | null;
}

/** Fim de uma seção: próximo título, o rodapé do seed, ou o fim do texto. */
function fimDaSecao(texto: string, apartirDe: number): number {
  const resto = texto.slice(apartirDe);
  const m = resto.match(/\n(?=(#{1,6} |Lembre-se:))/);
  return m && m.index !== undefined ? apartirDe + m.index : texto.length;
}

/** Engole as linhas em branco que ficariam órfãs antes do trecho removido. */
function recuarSobreVazio(texto: string, inicio: number): number {
  let i = inicio;
  while (i > 0 && texto[i - 1] === '\n') i--;
  // Deixa uma quebra de linha para o parágrafo anterior não colar no próximo.
  return i === 0 ? 0 : i + 1;
}

function removerSecao(texto: string, titulo: RegExp): { texto: string; removido: string | null } {
  const m = texto.match(titulo);
  if (!m || m.index === undefined) return { texto, removido: null };

  const fim = fimDaSecao(texto, m.index + m[0].length);
  const inicio = recuarSobreVazio(texto, m.index);
  const removido = texto.slice(inicio, fim);
  return { texto: texto.slice(0, inicio) + texto.slice(fim), removido };
}

function removerLinhaDeData(texto: string): { texto: string; removido: string | null } {
  const m = texto.match(/^Data\/hora atual:.*$/m);
  if (!m || m.index === undefined) return { texto, removido: null };
  const fimDaLinha = m.index + m[0].length;
  // Come também a quebra de linha da própria linha, para não sobrar um vão.
  const fim = texto[fimDaLinha] === '\n' ? fimDaLinha + 1 : fimDaLinha;
  return { texto: texto.slice(0, m.index) + texto.slice(fim), removido: m[0] };
}

/**
 * Limpa um prompt gravado. Idempotente: rodar de novo no resultado não muda
 * mais nada e devolve `mudou: false`.
 */
export function limparPromptCongelado(promptOriginal: string): LimpezaResultado {
  const original = typeof promptOriginal === 'string' ? promptOriginal : '';
  let texto = original;
  const removidos: string[] = [];

  for (const titulo of [
    /^#{2,3} HOR[ÁA]RIO DE FUNCIONAMENTO.*$/m,
    /^#{2,3} Fluxo de Agendamento.*$/m,
  ]) {
    const r = removerSecao(texto, titulo);
    texto = r.texto;
    if (r.removido) removidos.push(r.removido.trim());
  }

  const data = removerLinhaDeData(texto);
  texto = data.texto;
  if (data.removido) removidos.push(data.removido.trim());

  const mudou = texto !== original;
  if (!mudou) return { prompt: original, removidos: [], mudou: false, recusa: null };

  const recusa = verificarTravas(original, texto);
  if (recusa) return { prompt: original, removidos, mudou: true, recusa };

  return { prompt: texto, removidos, mudou: true, recusa: null };
}

/**
 * As duas travas de gravação, separadas para poderem ser testadas de frente.
 *
 * Elas são o cinto de segurança para o dia em que o texto do banco não for o
 * que esperamos (prompt editado à mão, seção renomeada, título fora do
 * padrão). Nesse dia, o certo é NÃO gravar.
 */
export function verificarTravas(original: string, resultado: string): MotivoRecusa | null {
  const temIdentidade = (t: string) => /^#{1,3} IDENTIDADE\b/m.test(t);
  if (temIdentidade(original) && !temIdentidade(resultado)) return 'perdeu_identidade';
  if (resultado.length < original.length * PROPORCAO_MINIMA) return 'encolheu_demais';
  return null;
}

export interface PromptDeEntrada {
  id: string;
  system_prompt: string;
}

export interface PromptDeSaida extends PromptDeEntrada {
  system_prompt_antes: string;
  removidos: string[];
  recusa: MotivoRecusa | null;
  mudou: boolean;
}

/**
 * Modo OFFLINE: a mesma função pura aplicada a uma lista exportada do banco.
 *
 * Existe para a migração de produção acontecer com revisão humana no meio:
 * exporta-se a lista, transforma-se aqui, LÊ-SE O DIFF, e só então alguém
 * grava. Nenhuma conexão de banco neste caminho.
 */
export function limparListaDePrompts(entrada: PromptDeEntrada[]): PromptDeSaida[] {
  return entrada.map((item) => {
    const r = limparPromptCongelado(item.system_prompt ?? '');
    return {
      id: item.id,
      system_prompt: r.recusa ? item.system_prompt : r.prompt,
      system_prompt_antes: item.system_prompt,
      removidos: r.removidos,
      recusa: r.recusa,
      mudou: r.mudou && !r.recusa,
    };
  });
}
