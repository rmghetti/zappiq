/* ══════════════════════════════════════════════════════════════════════
 * P61 — regravar a nota sobre as respostas já gravadas
 * --------------------------------------------------------------------
 * POR QUE EXISTE
 *
 * A Onda 0 mudou regex, gabarito e leitura do juiz. Provar a mudança rodando
 * o agente de novo mistura dois efeitos: o agente responde diferente a cada
 * execução (ruído medido de 7 a 10 pontos) e cada execução custa chamadas.
 *
 * As respostas de 3.712 cenários v2 já estão gravadas em
 * agent_eval_runs.results, com `response` e `userMessage`. Reler a nota sobre
 * elas separa o erro do GABARITO do erro do AGENTE e dá ao fundador um número
 * antes e depois sem uma única chamada paga.
 *
 * O QUE ESTE MÓDULO NÃO FAZ
 *
 *   - não chama LLM: `regradeResult` é pura e síncrona. O juiz novo só entra
 *     no modo opcional `--com-juiz`, nos casos em que a regra nova e o
 *     veredito antigo discordam, e vem DESLIGADO por padrão;
 *   - não escreve em agent_eval_runs. A nota recalculada é "recalculada", não
 *     é execução nova. A execução original fica intacta, e é por isso que o
 *     cliente pode ver as duas lado a lado sem se confundir.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { extractProductionReplyText } from '../agents/replyText.js';
import { resolveEvalSet } from '../agents/agentEvalSet.js';
// C2 (P13): a MESMA régua determinística do avaliador (padrões e checagem
// por valor dos casos de conhecimento).
import { checagemDeterministica } from '../agents/evalSetConhecimento.js';
import { resolveTenantAgentProfile } from '../agents/tenantAgentProfile.js';
import type { EvalScenario } from '../agents/evalScenarioTypes.js';

/**
 * A régua com que a regravação RELÊ os resultados, e o número gravado em
 * eval_regrades.harness_version.
 *
 * C2 (14/09/2026): era o HARNESS_VERSION do avaliador. O avaliador passou à
 * régua 4 (juiz de outra família com evidência, casos de conhecimento,
 * inconclusivo), mas a regravação continua sendo a releitura determinística
 * da régua 3 sobre respostas gravadas. Manter o número 3 aqui é o que deixa
 * as regravações já feitas (e o aviso "nota recalculada" que o cliente lê)
 * visíveis depois do deploy.
 */
export const REGUA_DA_REGRAVACAO = 3;

/** O que a execução gravou na época, na parte que a releitura precisa. */
export interface ResultadoGravado {
  scenarioId: string;
  severity?: string;
  response?: string | null;
  userMessage?: string | null;
  combined?: string | null;
  deterministic?: { passed?: boolean } | null;
  judge?: { passed?: boolean | null; reason?: string | null } | null;
}

export type VereditoAntigo = 'pass' | 'partial' | 'fail' | 'erro';
export type VereditoNovo = 'pass' | 'partial' | 'fail' | 'erro' | 'fora_do_gabarito';

export interface LeituraDoCenario {
  scenarioId: string;
  severity: string;
  vereditoAntigo: VereditoAntigo;
  vereditoNovo: VereditoNovo;
  motivo: string;
  /** true quando a reprovação antiga era defeito da régua, não do agente. */
  culpaDoGabarito: boolean;
  /**
   * true quando a regra nova e o veredito GRAVADO do juiz discordam.
   *
   * O juiz da época julgou contra o comportamento esperado ANTIGO ("usar Rod
   * na resposta"), que mudou. Reusar esse veredito seria carregar a régua
   * velha para dentro da nova. Nesses casos quem decide é a regra, e a linha
   * fica marcada: é ela que o modo opcional --com-juiz reavalia e que o
   * fundador rotula na calibração (P56).
   */
  discordante: boolean;
}

/**
 * Diagnósticos técnicos que a produção gravou dentro de `judge.reason`.
 *
 * Antes do arnês v3 não havia status 'erro': falha do provedor virava 'fail'
 * com um destes textos em inglês no motivo. A releitura precisa reconhecê-los
 * para tirar o cenário da nota em vez de contar a reprovação de novo.
 */
const MARCAS_DE_FALHA_TECNICA = [
  /^Scenario crashed/i,
  /^Judge error/i,
  /tempo limite/i,
  /all providers exhausted/i,
];

/** Marca de juiz que a produção gravou como reprovação por não conseguir ler. */
const MARCA_DE_JUIZ_ILEGIVEL = /Judge response unparseable/i;

function normalizarVereditoAntigo(c: unknown): VereditoAntigo {
  // C2 (Passo 1): 'inconclusivo' (resposta de um modelo de reserva, ou caso
  // de conhecimento sem base no teste) não aprovou nem reprovou. Na régua da
  // regravação ele vale o mesmo que a falha técnica: fora da nota.
  if (c === 'inconclusivo') return 'erro';
  return c === 'pass' || c === 'partial' || c === 'erro' ? c : 'fail';
}

/**
 * Relê UM resultado gravado com o arnês v3. Pura, síncrona, sem I/O.
 *
 * @param cenario definição atual do gabarito, ou null quando o cenário não se
 *        aplica mais a este tenant (caso do cr7_no_invent_preco_desconto na
 *        org da ZappIQ, que tinha expectativa oposta à do cenário próprio).
 */
export function regradeResult(
  gravado: ResultadoGravado,
  cenario: EvalScenario | null,
): LeituraDoCenario {
  const vereditoAntigo = normalizarVereditoAntigo(gravado.combined);
  const severity = String(gravado.severity ?? cenario?.severity ?? 'medium');
  const base = { scenarioId: gravado.scenarioId, severity, vereditoAntigo };

  if (!cenario) {
    return {
      ...base,
      vereditoNovo: 'fora_do_gabarito',
      motivo:
        'Este cenário não faz mais parte da prova deste agente: a régua antiga cobrava algo que não se aplica a ele.',
      culpaDoGabarito: vereditoAntigo !== 'pass',
      discordante: false,
    };
  }

  const motivoAntigo = String(gravado.judge?.reason ?? '');

  // ─── 1. Falha técnica: fora da nota, como no arnês v3 ────────────
  const respostaCrua = String(gravado.response ?? '');
  const tinhaMarcaTecnica = MARCAS_DE_FALHA_TECNICA.some((p) => p.test(motivoAntigo));
  if (respostaCrua.trim().length === 0 || tinhaMarcaTecnica || gravado.combined === 'inconclusivo') {
    return {
      ...base,
      vereditoNovo: 'erro',
      motivo:
        respostaCrua.trim().length === 0
          ? 'O agente não respondeu (resposta vazia): o teste não completou e isso não é erro do agente.'
          : 'O teste deste cenário não completou por falha técnica do provedor, e não pode contar na nota.',
      culpaDoGabarito: vereditoAntigo !== 'pass',
      discordante: false,
    };
  }

  // ─── 2. A resposta que o cliente leria, não a saída crua ─────────
  const resposta = extractProductionReplyText(respostaCrua);
  const usouReply = resposta !== respostaCrua.trim();

  // ─── 3. Regras determinísticas do gabarito ───────────────────────
  // A mesma função do avaliador: padrões e, no caso de conhecimento, a
  // checagem por valor.
  const regua = checagemDeterministica(cenario, resposta);
  const faltando = regua.missingPatterns;
  const proibidos = regua.failedPatterns;
  const regraAprovou = regua.passed;

  // ─── 4. Juiz: o que já está gravado, sem nova chamada ────────────
  // Juiz ilegível gravado como reprovação vira INDETERMINADO (A050): quem
  // decide, nesse caso, é a regra.
  const juizIlegivel = MARCA_DE_JUIZ_ILEGIVEL.test(motivoAntigo);
  const juizAprovou: boolean | null =
    juizIlegivel || typeof gravado.judge?.passed !== 'boolean'
      ? null
      : (gravado.judge!.passed as boolean);

  // Sem juiz novo (o padrão), quem decide é a regra determinística.
  //
  // Repare no que isso significa: a regravação NUNCA devolve 'partial'. É de
  // propósito. 'partial' nasce da divergência entre a regra e o juiz, e o juiz
  // gravado respondeu a um comportamento esperado que MUDOU ("usar Rod na
  // resposta"). Carregar aquele veredito para cá traria a régua velha de volta
  // por dentro. A divergência não some: fica marcada em `discordante`, que é o
  // lote do modo opcional --com-juiz e o da calibração do fundador.
  const discordante = juizAprovou !== null && juizAprovou !== regraAprovou;
  const vereditoNovo: VereditoNovo = regraAprovou ? 'pass' : 'fail';

  const motivo = montarMotivo({
    vereditoAntigo,
    vereditoNovo,
    usouReply,
    juizIlegivel,
    discordante,
    proibidos: proibidos.map(String),
    faltando: faltando.map(String),
  });

  return {
    ...base,
    vereditoNovo,
    motivo,
    culpaDoGabarito: vereditoAntigo !== 'pass' && vereditoNovo === 'pass',
    discordante,
  };
}

function montarMotivo(input: {
  vereditoAntigo: VereditoAntigo;
  vereditoNovo: VereditoNovo;
  usouReply: boolean;
  juizIlegivel: boolean;
  discordante: boolean;
  proibidos: string[];
  faltando: string[];
}): string {
  const partes: string[] = [];

  if (input.vereditoAntigo !== 'pass' && input.vereditoNovo === 'pass') {
    partes.push('A reprovação era do gabarito, não do agente.');
  } else if (input.vereditoAntigo === 'pass' && input.vereditoNovo !== 'pass') {
    partes.push('A régua antiga deixava este desvio passar.');
  } else {
    partes.push('O veredito não mudou com a régua nova.');
  }

  if (input.usouReply) {
    partes.push('A resposta foi lida do bloco <reply>, como o cliente final a leria.');
  }
  if (input.juizIlegivel) {
    partes.push('O avaliador da época devolveu saída ilegível: passou a valer como indeterminado.');
  } else if (input.discordante) {
    partes.push(
      'O avaliador da época julgou contra o comportamento esperado antigo e discorda da regra nova: quem decide aqui é a regra.',
    );
  }
  if (input.proibidos.length > 0) {
    partes.push(`Padrão proibido encontrado: ${input.proibidos.join(', ')}.`);
  }
  if (input.faltando.length > 0) {
    partes.push(`Padrão esperado ausente: ${input.faltando.join(', ')}.`);
  }
  return partes.join(' ');
}

// ─── Nota a partir das leituras ────────────────────────────────────

/**
 * Nota regravada: aprovados sobre o que é AVALIÁVEL.
 *
 * Falha técnica e cenário fora do gabarito saem do denominador, pela mesma
 * razão do A171: contar o que não pôde ser avaliado como reprovação derruba a
 * nota por defeito do provedor ou da régua antiga.
 */
export function notaDasLeituras(leituras: LeituraDoCenario[]): number {
  const avaliaveis = leituras.filter(
    (l) => l.vereditoNovo !== 'erro' && l.vereditoNovo !== 'fora_do_gabarito',
  );
  if (avaliaveis.length === 0) return 0;
  const aprovados = avaliaveis.filter((l) => l.vereditoNovo === 'pass').length;
  return Math.round((aprovados / avaliaveis.length) * 100);
}

// ─── Serviço: uma execução inteira ─────────────────────────────────

export interface ResumoDaRegravacao {
  runId: string;
  agentId: string;
  agentName: string;
  startedAt: string;
  harnessVersion: number;
  notaAntiga: number | null;
  notaRegravada: number;
  totalCenarios: number;
  /** Quantas reprovações da execução eram defeito da régua antiga. */
  reprovacoesDoGabarito: number;
  /** Cenários que continuam reprovados: são os que precisam de gente. */
  continuamReprovados: string[];
  /** Cenários em que a regra nova e o juiz da época discordam (lote --com-juiz). */
  discordantes: number;
  porCenario: LeituraDoCenario[];
}

/**
 * Percorre os resultados v2 de UMA execução e grava em eval_regrades.
 *
 * Só leitura sobre agent_eval_runs: a execução original nunca é reescrita.
 */
export async function regradeRun(
  runId: string,
  opts: { dryRun?: boolean; db?: any } = {},
): Promise<ResumoDaRegravacao> {
  const db = opts.db ?? prisma;

  const run = await db.agentEvalRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      agentId: true,
      scorePercent: true,
      startedAt: true,
      results: true,
      harnessVersion: true,
      agent: { select: { id: true, name: true, organizationId: true } },
    },
  });
  if (!run) throw new Error(`execução ${runId} não encontrada`);

  // Rodada 1 do PR #378, item 2d: a regravação é a releitura da régua 3.
  // Uma execução medida com a régua 4 ou posterior (juiz com evidência,
  // casos de conhecimento, inconclusivo) não pode ganhar "nota recalculada"
  // pela régua velha: o número sairia de duas medidas diferentes.
  if (typeof run.harnessVersion === 'number' && run.harnessVersion > REGUA_DA_REGRAVACAO) {
    throw new Error(
      `A execução ${runId} foi medida com a régua ${run.harnessVersion}; ` +
        `a regravação relê só execuções da régua ${REGUA_DA_REGRAVACAO} ou anterior.`,
    );
  }

  const perfil = await resolveTenantAgentProfile(run.agent.organizationId, {
    agentId: run.agent.id,
  });
  const gabarito = resolveEvalSet(perfil);
  const porId = new Map(gabarito.map((c) => [c.id, c]));

  const gravados: ResultadoGravado[] = Array.isArray(run.results)
    ? (run.results as ResultadoGravado[])
    : [];

  const leituras = gravados
    .filter((g) => g && typeof g.scenarioId === 'string')
    .map((g) => regradeResult(g, porId.get(g.scenarioId) ?? null));

  if (!opts.dryRun && leituras.length > 0) {
    // Ou entram todas as linhas desta execução, ou nenhuma. Antes era um laço
    // de upserts soltos: uma queda no meio deixava a execução com metade dos
    // cenários regravados, e resumirRegravacao lia essa metade como se fosse a
    // nota recalculada inteira.
    await db.$transaction(
      leituras.map((l) =>
        db.evalRegrade.upsert({
          where: {
            runId_scenarioId_harnessVersion: {
              runId,
              scenarioId: l.scenarioId,
              harnessVersion: REGUA_DA_REGRAVACAO,
            },
          },
          create: {
            runId,
            agentId: run.agentId,
            scenarioId: l.scenarioId,
            severity: l.severity,
            vereditoAntigo: l.vereditoAntigo,
            vereditoNovo: l.vereditoNovo,
            motivo: l.motivo,
            harnessVersion: REGUA_DA_REGRAVACAO,
            discordante: l.discordante,
            comJuiz: false,
          },
          update: {
            severity: l.severity,
            vereditoAntigo: l.vereditoAntigo,
            vereditoNovo: l.vereditoNovo,
            motivo: l.motivo,
            discordante: l.discordante,
            comJuiz: false,
          },
        }),
      ),
    );
    logger.info({
      msg: 'eval_regrade_gravada',
      runId,
      agentId: run.agentId,
      cenarios: leituras.length,
    });
  }

  return {
    runId,
    agentId: run.agentId,
    agentName: run.agent.name,
    startedAt: new Date(run.startedAt).toISOString(),
    harnessVersion: REGUA_DA_REGRAVACAO,
    notaAntiga: run.scorePercent ?? null,
    notaRegravada: notaDasLeituras(leituras),
    totalCenarios: leituras.length,
    reprovacoesDoGabarito: leituras.filter((l) => l.culpaDoGabarito).length,
    continuamReprovados: continuamReprovados(leituras),
    discordantes: leituras.filter((l) => l.discordante).length,
    porCenario: leituras,
  };
}

/** Cenários que seguem reprovados depois da régua nova, críticos primeiro. */
function continuamReprovados(leituras: LeituraDoCenario[]): string[] {
  return leituras
    .filter((l) => l.vereditoNovo === 'fail' || l.vereditoNovo === 'partial')
    .sort((a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical'))
    .map((l) => l.scenarioId);
}

/**
 * Resumo do que JÁ foi regravado de uma execução. Devolve null quando não há
 * regravação: nesse caso a tela do cliente não mostra aviso nenhum.
 */
export async function resumirRegravacao(
  runId: string,
  opts: { db?: any } = {},
): Promise<ResumoDaRegravacao | null> {
  const db = opts.db ?? prisma;

  const linhas = await db.evalRegrade.findMany({
    where: { runId, harnessVersion: REGUA_DA_REGRAVACAO },
    orderBy: { scenarioId: 'asc' },
  });
  if (!linhas || linhas.length === 0) return null;

  const run = await db.agentEvalRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      agentId: true,
      scorePercent: true,
      startedAt: true,
      agent: { select: { id: true, name: true, organizationId: true } },
    },
  });
  if (!run) return null;

  const leituras: LeituraDoCenario[] = linhas.map((l: any) => ({
    scenarioId: l.scenarioId,
    severity: l.severity ?? 'medium',
    vereditoAntigo: l.vereditoAntigo,
    vereditoNovo: l.vereditoNovo,
    motivo: l.motivo,
    culpaDoGabarito: l.vereditoAntigo !== 'pass' && l.vereditoNovo === 'pass',
    discordante: Boolean(l.discordante),
  }));

  return {
    runId,
    agentId: run.agentId,
    agentName: run.agent.name,
    startedAt: new Date(run.startedAt).toISOString(),
    harnessVersion: REGUA_DA_REGRAVACAO,
    notaAntiga: run.scorePercent ?? null,
    notaRegravada: notaDasLeituras(leituras),
    totalCenarios: leituras.length,
    reprovacoesDoGabarito: leituras.filter((l) => l.culpaDoGabarito).length,
    continuamReprovados: continuamReprovados(leituras),
    discordantes: leituras.filter((l) => l.discordante).length,
    porCenario: leituras,
  };
}

/**
 * Execuções elegíveis para regravar: concluídas, gabarito v2, com resultados.
 *
 * Não regrava execução 'invalidated' (as 26 sob o gabarito contaminado): a
 * nota delas nunca foi sobre o negócio do cliente, e recalcular daria vida a
 * um número que o produto já decidiu esconder.
 */
/**
 * Quantas execuções um clique do botão regrava.
 *
 * Era 200. Uma regravação de 200 execuções não cabe no teto de 25 minutos da
 * fila, e quem clicava não tinha como saber onde parou. Com 50, o botão pode
 * ser clicado de novo e a resposta diz quantas ainda faltam.
 */
export const TETO_DE_REGRAVACAO = 50;

/** O filtro do que é regravável. Um só, usado pelos dois ramos e pela contagem. */
function filtroDeRegravacao(filtro: { organizationId?: string; runIds?: string[] }) {
  return {
    status: 'completed',
    evalSetVersion: 'v2',
    results: { not: null as any },
    // Rodada 3 do PR #375: o re-teste do cliente nasce 'completed', v2, com
    // 3 amostras sem scenarioId e nota nula. Regravá-lo não faz sentido, e
    // ele ocupava vaga do lote de 50 e contava no que "ainda falta".
    triggeredBy: { not: 'client_retest' },
    // Rodada 1 do PR #378, item 2d: só a régua 3 ou anterior (NULL é a
    // execução de antes do PR #371, que nunca gravou régua). Uma execução da
    // régua 4 entraria na fila só para regradeRun recusá-la.
    OR: [{ harnessVersion: null }, { harnessVersion: { lt: REGUA_DA_REGRAVACAO + 1 } }],
    ...(filtro.runIds && filtro.runIds.length > 0 ? { id: { in: filtro.runIds } } : {}),
    ...(filtro.organizationId ? { agent: { organizationId: filtro.organizationId } } : {}),
  };
}

export async function execucoesParaRegravar(
  filtro: { organizationId?: string; runIds?: string[]; limite?: number },
  opts: { db?: any } = {},
): Promise<string[]> {
  const db = opts.db ?? prisma;

  // Revisão do PR: o ramo de lista devolvia os ids crus, sem passar pelo
  // filtro. Um id de execução 'invalidated' (as 26 do gabarito contaminado) ou
  // de outro gabarito entrava na regravação e ganhava uma nota recalculada que
  // o produto já tinha decidido esconder.
  const linhas = await db.agentEvalRun.findMany({
    where: filtroDeRegravacao(filtro),
    orderBy: { startedAt: 'desc' },
    take: Math.min(filtro.limite ?? TETO_DE_REGRAVACAO, TETO_DE_REGRAVACAO),
    select: { id: true },
  });
  return linhas.map((l: any) => l.id);
}

/** Total elegível, para a resposta dizer quantas faltam depois deste clique. */
export async function contarExecucoesParaRegravar(
  filtro: { organizationId?: string; runIds?: string[] },
  opts: { db?: any } = {},
): Promise<number> {
  const db = opts.db ?? prisma;
  return db.agentEvalRun.count({ where: filtroDeRegravacao(filtro) });
}
