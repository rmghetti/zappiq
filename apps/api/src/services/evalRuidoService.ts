/* ══════════════════════════════════════════════════════════════════════
 * P56 item 4 — piso de ruído por agente
 * --------------------------------------------------------------------
 * POR QUE EXISTE
 *
 * A nota da Qualidade oscila por acaso mais do que os limiares que o produto
 * usava. Medido com o prompt PARADO desde 14/07: o Tauã varia em média 10,4
 * pontos entre execuções consecutivas (desvio 7,9; de 63 a 88) e os agentes
 * STAGING variam 7,7 (desvio 7,4). Com 17 cenários e uma amostra por cenário,
 * o piso de ruído é da ordem de 24 pontos.
 *
 * Quer dizer: "caiu 5 pontos" quase nunca é queda. É o mesmo agente medido
 * duas vezes. Dizer ao dono do negócio que a IA dele piorou por causa disso é
 * transformar ruído em susto.
 *
 * O QUE O CLIENTE VÊ E O QUE O ADMIN VÊ
 *
 * O cliente leigo recebe um ESTADO ("estável", "melhorou de verdade",
 * "piorou de verdade") e nunca o número da faixa. A faixa (desvio e número de
 * execuções) fica no admin, que é quem precisa dela para calibrar.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { HARNESS_VERSION } from '../agents/agentEvalSet.js';

export interface PisoDeRuido {
  /** Desvio padrão da nota, com uma casa. 0 quando não há base. */
  desvio: number;
  /** Quantas execuções entraram na conta. Abaixo de 3 não se afirma nada. */
  n: number;
}

/** Amostras mínimas para a faixa significar alguma coisa. */
export const MINIMO_DE_EXECUCOES = 3;

/**
 * Faixa de ruído a partir das notas de execuções com o prompt constante.
 *
 * Desvio populacional (e não amostral) de propósito: são todas as execuções
 * daquele período, não uma amostra de um universo maior.
 */
export function pisoDeRuido(notas: Array<number | null | undefined>): PisoDeRuido {
  const validas = notas.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  if (validas.length === 0) return { desvio: 0, n: 0 };
  const media = validas.reduce((a, b) => a + b, 0) / validas.length;
  const variancia =
    validas.reduce((acc, n) => acc + (n - media) ** 2, 0) / validas.length;
  return { desvio: Math.round(Math.sqrt(variancia) * 10) / 10, n: validas.length };
}

export type EstadoDaNota = 'estavel' | 'melhorou' | 'piorou' | 'sem_base';

/**
 * Quanto a nota precisa andar, além do ruído, para a mudança ser real.
 *
 * Dois desvios é a régua usual para "isto não foi acaso". O piso de 5 pontos
 * existe para o agente muito estável: com desvio quase zero, qualquer ponto
 * viraria "melhorou de verdade", e um cenário a mais ou a menos em 17 já
 * mexe cerca de 6 pontos.
 */
export const PISO_MINIMO_DE_MUDANCA = 5;

export function classificarMudanca(input: {
  nota: number | null;
  notaAnterior: number | null;
  ruido: PisoDeRuido;
}): { estado: EstadoDaNota; explicacao: string } {
  const { nota, notaAnterior, ruido } = input;

  if (nota == null || notaAnterior == null || ruido.n < MINIMO_DE_EXECUCOES) {
    return {
      estado: 'sem_base',
      explicacao:
        'Ainda não há execuções suficientes para dizer se a IA melhorou ou piorou de verdade.',
    };
  }

  const faixa = Math.max(ruido.desvio * 2, PISO_MINIMO_DE_MUDANCA);
  const diferenca = nota - notaAnterior;

  if (Math.abs(diferenca) <= faixa) {
    return {
      estado: 'estavel',
      explicacao:
        'A IA está estável: a diferença para a última execução está dentro da variação normal deste agente.',
    };
  }
  if (diferenca > 0) {
    return {
      estado: 'melhorou',
      explicacao: 'A IA melhorou de verdade: a subida é maior que a variação normal deste agente.',
    };
  }
  return {
    estado: 'piorou',
    explicacao: 'A IA piorou de verdade: a queda é maior que a variação normal deste agente.',
  };
}

/**
 * Piso de ruído do agente, lido do banco.
 *
 * "Prompt constante" é definido pela última linha de agent_prompt_versions: a
 * partir dali o texto do agente não mudou, então tudo o que a nota faz é
 * ruído do próprio teste. Sem versão registrada (agente que nunca passou pelo
 * gatilho), usa o que houver, e o `n` mostra o quanto confiar.
 *
 * A régua (`opts.harnessVersion`) é a da execução que está sendo lida; sem
 * ela, a régua atual do avaliador. Rodada 1 do PR #378, item 2b: o piso é
 * calculado SÓ com execuções dessa régua, sem cair para o histórico
 * misturado. Misturar nota de régua 3 com nota de régua 4 mede a troca da
 * régua, não o agente, e infla justamente o número que serve para dizer ao
 * cliente se a IA mudou de verdade. Com menos de 3 execuções na régua, o
 * estado fica 'sem_base' até a régua ter histórico.
 *
 * Fail-soft: erro no banco devolve piso vazio. Esta é uma informação de apoio
 * na tela; ela não pode derrubar a listagem de execuções.
 */
export async function carregarRuidoDoAgente(
  agentId: string,
  opts: { db?: any; limite?: number; harnessVersion?: number | null } = {},
): Promise<PisoDeRuido> {
  const db = opts.db ?? prisma;
  const regua = opts.harnessVersion === undefined ? HARNESS_VERSION : opts.harnessVersion;
  try {
    const ultimaVersao = await db.agentPromptVersion.findFirst({
      where: { agentId },
      orderBy: { version: 'desc' },
      select: { createdAt: true },
    });

    const base = {
      agentId,
      status: 'completed',
      // Rodada 3 do PR #375: o re-teste do cliente nasce 'completed' com
      // nota nula. Ocupava vaga no `take` e contava no mínimo para o piso,
      // que então "existia" com uma nota só e nunca caía para o histórico.
      // A nota nula sai pelos dois lados: pela origem e pelo próprio campo.
      triggeredBy: { not: 'client_retest' },
      scorePercent: { not: null },
      ...(ultimaVersao?.createdAt ? { startedAt: { gte: ultimaVersao.createdAt } } : {}),
    };
    // Só a régua pedida. A queda para a consulta sem filtro ("a régua nova
    // nasce sem histórico") saiu na rodada 1 do PR #378: ela devolvia um piso
    // medido com a régua velha para uma execução da régua nova.
    const runs = await db.agentEvalRun.findMany({
      where: { ...base, harnessVersion: regua },
      orderBy: { startedAt: 'desc' },
      take: opts.limite ?? 20,
      select: { scorePercent: true },
    });
    return pisoDeRuido(runs.map((r: any) => r.scorePercent));
  } catch (err: any) {
    logger.warn({
      msg: 'eval_ruido_indisponivel',
      agentId,
      error: String(err?.message || err),
    });
    return { desvio: 0, n: 0 };
  }
}
