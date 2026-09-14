/**
 * Aviso da nota recalculada e estado da IA, em linguagem de dono de negócio.
 * ============================================================================
 * Duas regras de produto moram aqui, e por isso isto é módulo próprio com
 * teste, e não texto solto dentro do componente:
 *
 *   1. A nota recalculada é RECALCULADA. Ela nunca pode parecer execução
 *      nova, senão o cliente entende que a IA melhorou sozinha de um dia para
 *      o outro. O que melhorou foi o método de avaliação.
 *
 *   2. Para quem não é técnico, a comparação entre duas execuções vira um
 *      ESTADO, nunca uma faixa numérica. Com o prompt parado, o Tauã varia
 *      10,4 pontos entre execuções consecutivas: mostrar "78 mais ou menos 8"
 *      não ajuda ninguém a decidir nada. A faixa fica no admin.
 * ============================================================================
 */

/**
 * O que a tela do cliente precisa do resumo da regravação.
 *
 * É um recorte do RegradeResumo do admin (lib/adminApi): aqui só entra o que
 * o dono do negócio lê. O tipo mais completo mora no admin porque é lá que a
 * leitura por cenário e a faixa numérica fazem sentido.
 */
export interface RegravacaoResumo {
  notaAntiga: number | null;
  notaRegravada: number;
  reprovacoesDoGabarito: number;
  continuamReprovados: string[];
  porCenario?: Array<{
    scenarioId: string;
    severity: string;
    vereditoAntigo: string;
    vereditoNovo: string;
    motivo: string;
  }>;
}

export type EstadoDaNota = 'estavel' | 'melhorou' | 'piorou' | 'sem_base';

export interface EstadoResposta {
  estado: EstadoDaNota;
  explicacao: string;
}

export const ROTULOS_DE_ESTADO: Record<
  EstadoDaNota,
  { label: string; color: string; bg: string }
> = {
  estavel: {
    label: 'Estável',
    color: 'text-neutral-800',
    bg: 'bg-neutral-100 border-neutral-300',
  },
  melhorou: {
    label: 'Melhorou de verdade',
    color: 'text-green-800',
    bg: 'bg-green-100 border-green-300',
  },
  piorou: {
    label: 'Piorou de verdade',
    color: 'text-red-900',
    bg: 'bg-red-100 border-red-300',
  },
  sem_base: {
    label: 'Sem base para comparar',
    color: 'text-neutral-600',
    bg: 'bg-neutral-100 border-neutral-300',
  },
};

/** Há aviso a mostrar? Só quando a execução foi mesmo recalculada. */
export function precisaMostrarAviso(regravacao: RegravacaoResumo | null | undefined): boolean {
  return !!regravacao;
}

/**
 * A frase acordada, palavra por palavra.
 *
 * Fica num lugar só porque é ela que impede o mal-entendido: o cliente precisa
 * entender que mudou a régua, não a IA.
 */
export function textoDoAvisoDeRegravacao(regravacao: RegravacaoResumo): string {
  const de = regravacao.notaAntiga == null ? '' : `de ${regravacao.notaAntiga} `;
  return (
    'Corrigimos o método de avaliação. ' +
    `Recalculando sua última execução, a nota passaria ${de}para ${regravacao.notaRegravada}; ` +
    'os cenários que continuam reprovados são os que precisam de você.'
  );
}
