/* ══════════════════════════════════════════════════════════════════════
 * Cota de execuções manuais da Qualidade pela faixa do plano.
 * --------------------------------------------------------------------
 * Tarefa C2, nota 1 da revisão de 14/09. O interruptor `evalNoTier` estava
 * no registro sem leitor: "a avaliação de qualidade passa a respeitar a
 * faixa do plano (quantas execuções e com qual modelo)". O modelo vem de
 * resolveTurnPolicy; a quantidade vem daqui.
 *
 * Decisão conservadora, registrada no PR: as faixas em que as organizações
 * estão HOJE (Lite, Starter e Growth) ficam exatamente na regra de hoje, 1
 * teste manual por 24 horas. Só as faixas de cima (Scale, Business,
 * Enterprise) ganham mais, e só com o interruptor ligado. Nenhuma
 * organização passa a gastar mais no dia do merge.
 *
 * Módulo PURO: quem lê o banco e o interruptor é a rota.
 * ══════════════════════════════════════════════════════════════════════ */

export interface CotaDeExecucoes {
  /** Quantos testes manuais concluídos cabem na janela. */
  execucoes: number;
  /** Tamanho da janela, em horas. */
  janelaHoras: number;
}

/** A regra de hoje, e a de qualquer plano desconhecido. */
export const COTA_PADRAO_DA_QUALIDADE: CotaDeExecucoes = { execucoes: 1, janelaHoras: 24 };

const COTA_POR_FAIXA: Record<string, CotaDeExecucoes> = {
  IZA_LITE: COTA_PADRAO_DA_QUALIDADE,
  STARTER: COTA_PADRAO_DA_QUALIDADE,
  GROWTH: COTA_PADRAO_DA_QUALIDADE,
  SCALE: { execucoes: 2, janelaHoras: 24 },
  BUSINESS: { execucoes: 3, janelaHoras: 24 },
  ENTERPRISE: { execucoes: 5, janelaHoras: 24 },
};

export function cotaDeExecucoesDaFaixa(plano: string | null | undefined): CotaDeExecucoes {
  return COTA_POR_FAIXA[String(plano ?? '')] ?? COTA_PADRAO_DA_QUALIDADE;
}

/**
 * A faixa que vale para a cota, pela MESMA leitura da política de modelo
 * (resolveTurnPolicy): em trial ou no estágio NOVO, a organização que não é
 * a ZappIQ fica na faixa de entrada, qualquer que seja o plano.
 */
export function faixaDaCota(input: {
  plano: string | null | undefined;
  estagioDoTrial: 'TRIAL' | 'NOVO' | 'OTHER';
  ehZappIQ: boolean;
}): string {
  if (!input.ehZappIQ && input.estagioDoTrial !== 'OTHER') return 'STARTER';
  return String(input.plano ?? '');
}

export type DecisaoDaCota =
  | { liberado: true }
  | { liberado: false; usadas: number; proximaEm: Date };

/**
 * Cabe mais um teste? `iniciosNaJanela` são os started_at das execuções
 * manuais CONCLUÍDAS do cliente (a mesma régua da trava de hoje: falha não
 * gasta direito). O próximo horário é quando a mais antiga sai da janela.
 */
export function decidirCotaDeExecucoes(input: {
  cota: CotaDeExecucoes;
  iniciosNaJanela: Date[];
  agora: Date;
}): DecisaoDaCota {
  const janelaMs = input.cota.janelaHoras * 3600_000;
  const corte = input.agora.getTime() - janelaMs;
  const dentro = (input.iniciosNaJanela ?? [])
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t) && t >= corte)
    .sort((a, b) => a - b);
  if (dentro.length < input.cota.execucoes) return { liberado: true };
  return { liberado: false, usadas: dentro.length, proximaEm: new Date(dentro[0] + janelaMs) };
}
