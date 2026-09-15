/**
 * C2 (Passo 3 e 5, P21): os dois termômetros da Qualidade.
 * ============================================================================
 * A nota era um número só, e misturava duas coisas que se corrigem de jeitos
 * diferentes: o que o agente SABE do negócio (se corrige cadastrando) e como
 * ele SE COMPORTA (se corrige com ajuste). Um agente sem conteúdo nenhum
 * tirava 77% num teste que não media conhecimento.
 *
 * Agora a API grava o placar em duas partes (agent_eval_runs.placar) e a
 * tela mostra dois termômetros. Estas funções transformam cada parte no
 * texto que o dono lê. Puras, testadas fora do componente.
 * ============================================================================
 */
import type { ParteDoPlacar, PlacarDaExecucao } from '@/lib/adminApi';

export type NivelDoTermometro = 'good' | 'attention' | 'critical' | 'unknown';

export interface Termometro {
  titulo: string;
  /** O número ou o estado, em destaque. */
  valor: string;
  /** Uma frase curta embaixo do valor. */
  detalhe: string;
  nivel: NivelDoTermometro;
  percent: number | null;
}

export const TITULO_CONHECIMENTO = 'Conhecimento do negócio';
export const TITULO_COMPORTAMENTO = 'Comportamento';

/** Mesma régua da saúde da nota única: 90 bom, 70 atenção. */
function nivel(percent: number | null): NivelDoTermometro {
  if (percent == null) return 'unknown';
  if (percent >= 90) return 'good';
  if (percent >= 70) return 'attention';
  return 'critical';
}

/** A frase de "sem base cadastrada", uma só para a tela e para o nudge. */
export const TEXTO_SEM_BASE =
  'Cadastre perguntas e respostas, ou preencha preço, horário, formas de pagamento e endereço ' +
  'em Treinar IA, para o agente ser testado no que sabe do seu negócio.';

export function termometro(
  qual: 'conhecimento' | 'comportamento',
  parte: ParteDoPlacar | null | undefined,
): Termometro {
  const titulo = qual === 'conhecimento' ? TITULO_CONHECIMENTO : TITULO_COMPORTAMENTO;

  if (!parte || parte.estado === 'sem_base' || parte.estado === 'sem_cenarios') {
    return qual === 'conhecimento'
      ? { titulo, valor: 'Sem base cadastrada', detalhe: TEXTO_SEM_BASE, nivel: 'unknown', percent: null }
      : {
          titulo,
          valor: 'Sem cenários',
          detalhe: 'Esta execução não testou situações de atendimento.',
          nivel: 'unknown',
          percent: null,
        };
  }

  if (parte.estado === 'nao_testado') {
    return {
      titulo,
      valor: parte.motivo === 'base_nao_consultada' ? 'Não testado ainda' : 'Não avaliado',
      detalhe:
        parte.motivo === 'base_nao_consultada'
          ? 'O teste desta empresa ainda não consulta a base de conhecimento. As perguntas do ' +
            'seu negócio passam a contar quando isso for ligado.'
          : 'Nada desta parte pôde ser avaliado nesta execução, por falha técnica. Não é nota do seu agente.',
      nivel: 'unknown',
      percent: null,
    };
  }

  const percent = parte.percent ?? 0;
  const detalhe =
    qual === 'conhecimento'
      ? `${parte.aprovados} de ${parte.avaliados} perguntas do seu negócio respondidas certo.`
      : `${parte.aprovados} de ${parte.avaliados} situações de atendimento aprovadas.`;
  return { titulo, valor: `${percent}%`, detalhe, nivel: nivel(percent), percent };
}

/** Os dois termômetros, ou null quando a execução é antiga (sem placar). */
export function termometrosDaExecucao(
  placar: PlacarDaExecucao | null | undefined,
): { conhecimento: Termometro; comportamento: Termometro } | null {
  if (!placar || placar.versao !== 1) return null;
  return {
    conhecimento: termometro('conhecimento', placar.conhecimento),
    comportamento: termometro('comportamento', placar.comportamento),
  };
}
