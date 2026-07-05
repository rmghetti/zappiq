/**
 * CRM · Conversão por estágio (funil) — W3.7
 *
 * BUG histórico: deals perdidos ('lost') não estavam em STAGE_ORDER, então
 * `STAGE_ORDER.indexOf('lost')` retornava -1 e o deal era EXCLUÍDO de todo
 * o numerador do funil, mas continuava contando no denominador
 * (totalCriados). Resultado: taxa de conversão inflada/enganosa — perdas
 * simplesmente sumiam do funil.
 *
 * Correção: uma perda é um deal que ENTROU no funil e depois SAIU. O schema
 * não guarda o estágio ONDE a perda ocorreu (só o stage atual = 'lost' e o
 * lossReason), então usamos o que há: um lost conta como tendo alcançado o
 * estágio de ENTRADA do funil (o primeiro de STAGE_ORDER). Assim a perda é
 * uma saída do funil, não um deal ignorado. Wons continuam contando em todos
 * os estágios (chegaram até o fim).
 */

export type FunnelDeal = {
  stage: string;
  createdAt: Date;
};

export type FunnelStageRow = {
  stage: string;
  passou: number;
  total: number;
  percentual: number; // 0..1
};

/**
 * Índice efetivo do deal na ordem do funil, pra fins de "passou por".
 * - won: passou por todos → índice >= último (usamos STAGE_ORDER.length - 1).
 * - lost: entrou no funil mas não sabemos até onde foi → índice do estágio de
 *   entrada (0). Conta como saída do funil, não como ignorado.
 * - stage conhecido: seu próprio índice.
 * - stage legado/desconhecido: -1 (não conta em nenhum estágio).
 */
export function effectiveStageIndex(stage: string, stageOrder: string[]): number {
  if (stage === 'won') return stageOrder.length - 1;
  if (stage === 'lost') return 0;
  return stageOrder.indexOf(stage);
}

/**
 * Conversão acumulada por estágio: pra cada estágio, % dos deals criados na
 * janela que alcançaram (ou ultrapassaram) aquele estágio.
 *
 * @param deals   deals criados na janela (já filtrados por cutoff pelo caller)
 * @param stageOrder ordem canônica dos estágios (sem 'lost'; won é o último)
 */
export function computeConversaoPorEstagio(
  deals: FunnelDeal[],
  stageOrder: string[],
): FunnelStageRow[] {
  const total = deals.length;
  return stageOrder.map((stageKey, idx) => {
    const passou = deals.filter((d) => {
      const dealIdx = effectiveStageIndex(d.stage, stageOrder);
      if (dealIdx === -1) return false; // stage legado/desconhecido
      return dealIdx >= idx;
    }).length;
    return {
      stage: stageKey,
      passou,
      total,
      percentual: total > 0 ? passou / total : 0,
    };
  });
}
