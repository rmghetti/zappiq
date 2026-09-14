/**
 * knowledgeBaseBuilder: o questionário virando conhecimento de verdade.
 *
 * Antes (até 14/09/2026) este arquivo montava UM documento com todas as
 * respostas em linhas '**chave_de_codigo:** resposta', achatando um nível
 * só. Três defeitos saíam daí, todos vistos em produção:
 *
 *   A006  resposta aninhada (perguntas de especialidade) virava o texto
 *         '[object Object]'. Uma organização tinha 47 respostas assim.
 *   A023  o rótulo era a chave de código, e não a pergunta que o dono
 *         respondeu. O documento único era fatiado por tamanho, então cada
 *         trecho misturava preço, CNPJ, tom de voz e escalonamento.
 *   A075  o markdown dos rótulos entrava no contexto que as regras base do
 *         agente proíbem na resposta.
 *
 * Agora: um documento por SEÇÃO do questionário, com o texto da pergunta,
 * em texto corrido, e só com as respostas cujo destino é a base
 * consultável (packages/shared/src/surveyDestino.ts). Tom, regras e
 * política de preço não moram mais aqui: elas vão para o bloco vivo do
 * prompt, onde valem em todo turno em vez de dependerem da busca.
 */

import { PERGUNTA_POR_ID, destinoDaPergunta } from '@zappiq/shared';

export interface SurveyKnowledgeInput {
  businessName: string;
  niche: string;
  surveyAnswers: Record<string, any>;
}

/** Um documento de uma seção do questionário, pronto para ingestão. */
export interface BlocoDoQuestionario {
  /** Id da seção (bloco) do questionário. */
  secaoId: string;
  /** Identificador estável no vetor. Reingerir com o mesmo source substitui. */
  source: string;
  /** Título amigável, usado no cabeçalho de contexto de cada trecho. */
  titulo: string;
  texto: string;
  /** Quantas respostas entraram. Só para log e auditoria. */
  respostas: number;
}

/** Todo source do questionário começa assim. Serve para limpeza e para prova. */
export const PREFIXO_SOURCE_DO_QUESTIONARIO = 'survey-';

/** O source estável de uma seção. */
export function sourceDaSecao(secaoId: string): string {
  return `${PREFIXO_SOURCE_DO_QUESTIONARIO}${secaoId}`;
}

/** 'cidade_do_evento' vira 'Cidade do evento'. Só para chave sem catálogo. */
function rotuloLegivel(chave: string): string {
  const texto = chave.replace(/[_-]+/g, ' ').trim();
  if (!texto) return chave;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Valor de resposta em texto de gente.
 *
 * O ponto do achado A006 mora aqui: objeto NÃO vira String(objeto). Ele
 * desce em linhas, com o rótulo de cada campo. Lista vira enumeração e
 * booleano vira Sim ou Não, porque 'true' não é resposta em português.
 *
 * Devolve null quando não sobrou nada de verdade para escrever.
 */
function valorEmTexto(valor: unknown, profundidade = 0): string | null {
  if (valor === null || valor === undefined) return null;

  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : null;

  if (typeof valor === 'string') {
    const t = valor.trim();
    return t ? t : null;
  }

  if (Array.isArray(valor)) {
    const itens = valor
      .map((item) => valorEmTexto(item, profundidade + 1))
      .filter((t): t is string => Boolean(t));
    return itens.length ? itens.join(', ') : null;
  }

  if (typeof valor === 'object') {
    // Profundidade limitada de propósito: resposta do cliente não é árvore
    // infinita, e um JSON estranho não pode virar um documento gigante.
    if (profundidade >= 3) return null;
    const linhas: string[] = [];
    for (const [chave, sub] of Object.entries(valor as Record<string, unknown>)) {
      const texto = valorEmTexto(sub, profundidade + 1);
      if (!texto) continue;
      const rotulo = PERGUNTA_POR_ID.get(chave)?.label ?? rotuloLegivel(chave);
      linhas.push(`- ${rotulo}: ${texto}`);
    }
    return linhas.length ? `\n${linhas.join('\n')}` : null;
  }

  return null;
}

/** Uma resposta já achatada: a pergunta e o que o dono escreveu. */
interface RespostaAchatada {
  id: string;
  valor: unknown;
}

/**
 * Percorre o JSON inteiro de respostas, em qualquer profundidade.
 *
 * O shape real tem três níveis: `identidade_empresa` guarda TODAS as
 * respostas globais (o nome da chave é herança do primeiro bloco),
 * `segmento` guarda as do segmento e `subsegmentos` guarda um objeto por
 * especialidade. Em vez de assumir esses nomes, a função anda na árvore: o
 * que é id de pergunta do catálogo é resposta; o que não é, e é objeto, é
 * caixa e continua descendo.
 */
export function achatarRespostas(surveyAnswers: Record<string, any> | null | undefined): RespostaAchatada[] {
  const achatadas: RespostaAchatada[] = [];
  const visitar = (no: unknown, profundidade: number) => {
    if (!no || typeof no !== 'object' || Array.isArray(no) || profundidade > 4) return;
    for (const [chave, valor] of Object.entries(no as Record<string, unknown>)) {
      if (PERGUNTA_POR_ID.has(chave)) {
        achatadas.push({ id: chave, valor });
        continue;
      }
      if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
        visitar(valor, profundidade + 1);
        continue;
      }
      // Chave solta que não é pergunta de catálogo nenhum: guarda mesmo
      // assim, para quem chama decidir (o documento ignora, a contagem não).
      achatadas.push({ id: chave, valor });
    }
  };
  visitar(surveyAnswers ?? {}, 0);
  return achatadas;
}

/**
 * Monta um documento por seção do questionário.
 *
 * Só entra resposta com destino 'base'. Instrução vai para o bloco vivo do
 * prompt, função do sistema não vai para o modelo e 'fora da IA' não sai
 * das configurações.
 */
export function buildSurveyKnowledgeBlocks({
  businessName,
  niche,
  surveyAnswers,
}: SurveyKnowledgeInput): BlocoDoQuestionario[] {
  const porSecao = new Map<string, { titulo: string; linhas: string[]; respostas: number }>();
  // A mesma pergunta pode aparecer em dois ramos do JSON (uma resposta que
  // ficou no bloco global e outra no bloco do segmento). Vale a primeira:
  // repetir a pergunta no documento só ensina o modelo a ver contradição.
  const jaEscritas = new Set<string>();

  for (const { id, valor } of achatarRespostas(surveyAnswers)) {
    const pergunta = PERGUNTA_POR_ID.get(id);
    if (!pergunta) continue;
    if (destinoDaPergunta(id)?.destino !== 'base') continue;
    if (jaEscritas.has(id)) continue;

    const texto = valorEmTexto(valor);
    if (!texto) continue;

    const secao = porSecao.get(pergunta.secaoId) ?? {
      titulo: pergunta.secaoTitulo,
      linhas: [],
      respostas: 0,
    };
    jaEscritas.add(id);
    secao.linhas.push(`Pergunta: ${pergunta.label}`, `Resposta: ${texto}`, '');
    secao.respostas += 1;
    porSecao.set(pergunta.secaoId, secao);
  }

  const nome = (businessName || '').trim() || 'a empresa';
  const segmento = (niche || '').trim() || 'geral';

  return [...porSecao.entries()].map(([secaoId, secao]) => {
    const corpo = [...secao.linhas];
    // A última linha em branco só existiria para separar do próximo par.
    while (corpo.length && corpo[corpo.length - 1] === '') corpo.pop();
    return {
      secaoId,
      source: sourceDaSecao(secaoId),
      titulo: `Questionário: ${secao.titulo}`,
      texto: [
        `Questionário de qualificação: ${secao.titulo}`,
        `Empresa: ${nome} (segmento: ${segmento})`,
        '',
        ...corpo,
      ].join('\n'),
      respostas: secao.respostas,
    };
  });
}

/**
 * Nome do documento antigo do questionário, de quando ele era um arquivo só.
 *
 * Fica para a limpeza: a primeira reingestão no formato novo precisa apagar
 * o documento velho do vetor, senão a IA continuaria lendo os trechos com
 * rótulo de código ao lado dos trechos novos.
 */
export function surveyDocFilename(niche: string): string {
  return `onboarding-survey-${niche || 'geral'}.txt`;
}

/**
 * Conta respostas preenchidas, atravessando os níveis.
 *
 * Também era achatada de um nível só: a especialidade inteira contava como
 * UMA resposta (o objeto), então o progresso da tela e o AI Readiness
 * subestimavam quem respondeu o bloco do nicho.
 */
export function countAnsweredQuestions(surveyAnswers: Record<string, any>): number {
  let n = 0;
  for (const { valor } of achatarRespostas(surveyAnswers)) {
    if (valorEmTexto(valor)) n++;
  }
  return n;
}
