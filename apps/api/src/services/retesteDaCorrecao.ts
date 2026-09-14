/* ══════════════════════════════════════════════════════════════════════
 * retesteDaCorrecao: o "Re-testar agora" com 3 amostras e com rastro.
 * --------------------------------------------------------------------
 * A049. O re-teste do cliente rodava UMA amostra a temperatura 0,3 e não
 * gravava nada: nem execução, nem vínculo com a correção aplicada. Duas
 * consequências medidas:
 *
 *   • uma amostra só não separa correção que pegou de sorte do modelo;
 *   • sem linha em agent_eval_runs, ninguém consegue dizer depois se a
 *     correção funcionou. O dado existia solto (o cenário da Marcia passou
 *     31 de 31 depois da correção, o da Vera 0 de 9) e nunca chegou à tela.
 *
 * Agora o re-teste roda 3 vezes o mesmo cenário contra o mesmo prompt, grava
 * as 3 respostas e os 3 vereditos, e só declara "a correção não funcionou"
 * quando 2 das 3 reprovam. Uma reprovação isolada fica como indefinida, que
 * é a leitura honesta de um agente com ruído próprio.
 *
 * Este módulo é PURO. Quem paga as 3 chamadas e grava a execução é a rota.
 * ══════════════════════════════════════════════════════════════════════ */

/** Quantas vezes o mesmo cenário roda num re-teste. É o custo declarado. */
export const AMOSTRAS_DO_RETESTE = 3;

/** Uma passada do cenário, como ela vai para a tela e para o banco. */
export interface AmostraDoReteste {
  /** 1, 2, 3: a ordem em que rodou. */
  amostra: number;
  combined: 'pass' | 'partial' | 'fail' | 'erro';
  resposta: string;
  motivoDoJuiz: string;
}

export type VereditoDoReteste = 'funcionou' | 'nao_funcionou' | 'indefinido';

export interface ResumoDoReteste {
  veredito: VereditoDoReteste;
  aprovadas: number;
  reprovadas: number;
  parciais: number;
  /** Falha técnica (provedor fora, tempo limite): fora do denominador. */
  erros: number;
  /** Amostras que deram para avaliar. */
  avaliadas: number;
  /** Frase pronta para a tela, em português. */
  explicacao: string;
}

/**
 * Lê as amostras e devolve o veredito.
 *
 * A régua, na ordem:
 *   1. falha técnica sai do denominador (mesma decisão do arnês v3);
 *   2. menos de 2 amostras avaliáveis: não se declara nada;
 *   3. 2 ou mais reprovações: não funcionou;
 *   4. 2 ou mais aprovações: funcionou;
 *   5. o resto (parciais, ou uma de cada) é indefinido.
 *
 * "Parcial" não conta como aprovação: é a mesma conta da nota, onde parcial
 * vale zero. Contá-la aqui como meia vitória faria a tela dizer que a
 * correção pegou enquanto o placar semanal diz o contrário.
 */
export function consolidarReteste(amostras: AmostraDoReteste[]): ResumoDoReteste {
  const lista = amostras ?? [];
  const aprovadas = lista.filter((a) => a.combined === 'pass').length;
  const reprovadas = lista.filter((a) => a.combined === 'fail').length;
  const parciais = lista.filter((a) => a.combined === 'partial').length;
  const erros = lista.filter((a) => a.combined === 'erro').length;
  const avaliadas = lista.length - erros;

  const base = { aprovadas, reprovadas, parciais, erros, avaliadas };

  if (avaliadas < 2) {
    return {
      ...base,
      veredito: 'indefinido',
      explicacao:
        'Não deu para avaliar: das ' +
        `${lista.length} tentativas, ${erros} falharam por problema técnico (e não por causa ` +
        'do agente). Tente de novo daqui a pouco.',
    };
  }

  if (reprovadas >= 2) {
    return {
      ...base,
      veredito: 'nao_funcionou',
      explicacao:
        `A correção não pegou: o agente reprovou em ${reprovadas} de ${lista.length} tentativas ` +
        'no mesmo cenário. Reescreva a regra de forma mais direta, ou veja se o que falta é ' +
        'informação cadastrada, e não regra.',
    };
  }

  if (aprovadas >= 2) {
    return {
      ...base,
      veredito: 'funcionou',
      explicacao:
        `A correção pegou: o agente passou em ${aprovadas} de ${lista.length} tentativas no mesmo ` +
        'cenário. O placar da semana muda na próxima execução completa.',
    };
  }

  return {
    ...base,
    veredito: 'indefinido',
    explicacao:
      `Resultado misto: ${aprovadas} aprovação(ões), ${parciais} parcial(is) e ${reprovadas} ` +
      'reprovação(ões) em ' +
      `${lista.length} tentativas. Uma reprovação isolada costuma ser variação normal do agente, ` +
      'não prova de que a correção falhou. Rode de novo ou espere a próxima execução completa.',
  };
}
