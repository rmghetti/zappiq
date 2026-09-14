/* ══════════════════════════════════════════════════════════════════════
 * surveyPainel: a lógica do questionário dentro do Treinar IA.
 * --------------------------------------------------------------------
 * Fica aqui, e não no componente, por dois motivos:
 *   1. É onde mora a decisão de qual pergunta aparece e onde a resposta
 *      dela é gravada. Gravar no lugar errado apaga o que o cliente já
 *      tinha respondido no cadastro, então isto precisa de teste.
 *   2. O componente não é testado (a suíte do web é de lógica pura).
 *
 * O que mudou em 14/09/2026 (A177): o painel mostrava SÓ as 202 perguntas
 * globais. As do segmento e da especialidade, que o próprio código chama
 * de profundidade para a base de conhecimento, só existiam no cadastro.
 * Quem pulou lá nunca mais respondia, e quem respondeu não corrigia.
 * ══════════════════════════════════════════════════════════════════════ */

import {
  GLOBAL_SURVEY_BLOCKS,
  SEGMENT_SURVEYS,
  destinoDaPergunta,
  type SurveyBlock,
} from '@zappiq/shared';

/** De onde a seção veio. Muda só o rótulo mostrado na tela. */
export type OrigemDaSecao = 'global' | 'segmento' | 'especialidade';

export interface SecaoDoPainel {
  bloco: SurveyBlock;
  /**
   * Caminho dentro de settings.surveyAnswers onde as respostas moram. O
   * formato vem do cadastro e é preservado: as globais em
   * 'identidade_empresa' (o nome é herança do primeiro bloco), as do
   * segmento em 'segmento' e as da especialidade em 'subsegmentos.<chave>'.
   */
  caminho: string[];
  origem: OrigemDaSecao;
}

/** Chave onde o cadastro grava TODAS as respostas globais. */
export const CAMINHO_GLOBAL = ['identidade_empresa'];

export interface OpcoesDoPainel {
  segmento?: string | null;
  subsegmentos?: string[] | null;
}

/** As seções que o cliente vê, na ordem: globais, segmento, especialidades. */
export function secoesDoPainel({ segmento, subsegmentos }: OpcoesDoPainel): SecaoDoPainel[] {
  const secoes: SecaoDoPainel[] = GLOBAL_SURVEY_BLOCKS.map((bloco) => ({
    bloco,
    caminho: CAMINHO_GLOBAL,
    origem: 'global' as const,
  }));

  const chaveDoSegmento = (segmento || '').trim();
  if (chaveDoSegmento && SEGMENT_SURVEYS[chaveDoSegmento]) {
    for (const bloco of SEGMENT_SURVEYS[chaveDoSegmento]) {
      secoes.push({ bloco, caminho: ['segmento'], origem: 'segmento' });
    }
  }

  const vistos = new Set<string>();
  for (const sub of subsegmentos ?? []) {
    const chave = (sub || '').trim();
    if (!chave || vistos.has(chave) || !SEGMENT_SURVEYS[chave]) continue;
    vistos.add(chave);
    for (const bloco of SEGMENT_SURVEYS[chave]) {
      secoes.push({ bloco, caminho: ['subsegmentos', chave], origem: 'especialidade' });
    }
  }

  return secoes;
}

/** Lê a resposta de uma pergunta no caminho dela. */
export function lerResposta(
  respostas: Record<string, any> | null | undefined,
  caminho: string[],
  id: string,
): any {
  let no: any = respostas ?? {};
  for (const passo of caminho) {
    if (!no || typeof no !== 'object') return undefined;
    no = no[passo];
  }
  return no && typeof no === 'object' ? no[id] : undefined;
}

/**
 * Grava a resposta sem destruir o resto.
 *
 * Devolve um objeto novo, copiando só o caminho tocado. O autosave manda o
 * JSON inteiro de volta para a API, então uma cópia rasa errada aqui
 * apagaria as respostas do cadastro que a tela nem mostra.
 */
export function gravarResposta(
  respostas: Record<string, any> | null | undefined,
  caminho: string[],
  id: string,
  valor: any,
): Record<string, any> {
  const raiz: Record<string, any> = { ...(respostas ?? {}) };
  let no = raiz;
  for (const passo of caminho) {
    const atual = no[passo];
    no[passo] = atual && typeof atual === 'object' && !Array.isArray(atual) ? { ...atual } : {};
    no = no[passo];
  }
  no[id] = valor;
  return raiz;
}

/** Resposta de verdade: texto com conteúdo, lista com item, booleano. */
export function estaRespondida(valor: any): boolean {
  if (valor === undefined || valor === null) return false;
  if (Array.isArray(valor)) return valor.filter(Boolean).length > 0;
  if (typeof valor === 'boolean') return true;
  return String(valor).trim() !== '';
}

export interface ProgressoDoPainel {
  respondidas: number;
  total: number;
  pct: number;
}

/** Progresso considerando TODAS as seções mostradas, não só as globais. */
export function progressoDoPainel(
  secoes: SecaoDoPainel[],
  respostas: Record<string, any> | null | undefined,
): ProgressoDoPainel {
  let respondidas = 0;
  let total = 0;
  for (const secao of secoes) {
    for (const pergunta of secao.bloco.questions) {
      total += 1;
      if (estaRespondida(lerResposta(respostas, secao.caminho, pergunta.id))) respondidas += 1;
    }
  }
  return { respondidas, total, pct: total ? Math.round((respondidas / total) * 100) : 0 };
}

export interface AvisoDaPergunta {
  /** Texto curto da etiqueta, ao lado da pergunta. */
  rotulo: string;
  /** Frase completa, no toque ou embaixo do campo. */
  detalhe: string;
  tom: 'em_breve' | 'configuracao' | 'fora';
}

/**
 * O aviso honesto de uma pergunta.
 *
 * O questionário pede 20 configurações de funções que a plataforma não
 * executa (A211). Em vez de tirar a pergunta e perder o que o dono já
 * escreveu, a tela diz o que acontece com aquela resposta.
 */
export function avisoDaPergunta(id: string): AvisoDaPergunta | null {
  const registro = destinoDaPergunta(id);
  if (!registro) return null;

  if (registro.destino === 'funcao_do_sistema') {
    if (registro.configuracaoReal) {
      return {
        rotulo: 'fica em Configurações',
        detalhe:
          registro.motivo ??
          'O que vale de verdade é o campo correspondente na tela de Configurações.',
        tom: 'configuracao',
      };
    }
    return {
      rotulo: 'em breve',
      detalhe: registro.motivo ?? 'A plataforma ainda não executa isto. Responder aqui não muda o atendimento.',
      tom: 'em_breve',
    };
  }

  if (registro.destino === 'fato_oficial') {
    return {
      rotulo: 'fica em Configurações',
      detalhe: registro.motivo ?? 'Este dado vem da tela de Configurações, que é onde a IA lê.',
      tom: 'configuracao',
    };
  }

  if (registro.destino === 'fora_da_ia') {
    return {
      rotulo: 'não vai para a IA',
      detalhe: registro.motivo ?? 'Fica registrado para a sua equipe, e não entra no atendimento.',
      tom: 'fora',
    };
  }

  return null;
}

export interface SurveySync {
  status: 'pendente' | 'ok' | 'falhou';
  at?: string;
  motivo?: string;
  secoes?: number;
}

export interface TextoDaSincronizacao {
  tom: 'pendente' | 'ok' | 'falhou';
  texto: string;
}

function dataCurta(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * A frase sobre o que a IA já recebeu.
 *
 * Existe por causa do A008: a tela dizia "salvo automaticamente" mesmo
 * quando a ingestão falhava, e o score do treinamento subia junto. Salvar
 * a resposta e entregá-la à IA são duas coisas, e agora a tela diz as duas.
 */
export function textoDaSincronizacao(sync: SurveySync | null | undefined): TextoDaSincronizacao {
  if (!sync || sync.status === 'pendente') {
    return {
      tom: 'pendente',
      texto: 'A IA ainda não recebeu esta versão. Ela entra na base em até um minuto.',
    };
  }

  if (sync.status === 'falhou') {
    const motivo = (sync.motivo || '').trim();
    const quando = dataCurta(sync.at);
    return {
      tom: 'falhou',
      texto: [
        'A IA ainda não recebeu esta versão: a sincronização falhou',
        quando ? ` em ${quando}` : '',
        motivo ? `. Motivo: ${motivo}` : '.',
        ' Suas respostas estão salvas. Vamos tentar de novo no próximo salvamento.',
      ].join(''),
    };
  }

  const quando = dataCurta(sync.at);
  return {
    tom: 'ok',
    texto: quando
      ? `A IA está usando esta versão. Última sincronização em ${quando}.`
      : 'A IA está usando esta versão.',
  };
}
