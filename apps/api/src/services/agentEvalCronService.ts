/**
 * Agent Eval Cron Service — auditoria automática da Qualidade do Agente.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * O que faz
 * ═══════════════════════════════════════════════════════════════════════════
 * Para cada agente 'live' de organização ELEGÍVEL (ver isEvalEligible) que
 * ainda cabe no teto do dia (ver podeAgendarAvaliacao):
 *
 *   1. Cria a linha em AgentEvalRun (triggeredBy='cron')
 *   2. ENFILEIRA na fila `agent-eval` (enqueueEvalRun), a mesma fila que o
 *      botão do cliente e o do superadmin usam
 *   3. O worker daquela fila roda o corpo único (executeRunJob), persiste o
 *      resultado, grava slackAlertStatus e alerta quando há crítico reprovado
 *      ou reprovação repetida
 *
 * O ciclo NÃO executa em linha. Executar aqui dentro colocava um teste de
 * minutos dentro do worker da fila `cron`, agente por agente, e o ciclo por
 * mudança das 04:50 começava no meio do semanal das 04:30: quem o semanal
 * ainda não tinha alcançado ganhava duas execuções na mesma madrugada.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Custo: por que semanal e por que com dono (A045 / A067)
 * ═══════════════════════════════════════════════════════════════════════════
 * O cabeçalho antigo dizia "1 agente ativo, USD 7,50 por mês". A medição de
 * 90 dias em llm_call_logs mostrou outra coisa: cerca de USD 60 por mês de
 * eval contra cerca de USD 10 de TODO o tráfego real de clientes. Quase todo
 * esse gasto não tinha dono: 9 das 15 organizações com agente 'live' eram
 * '-STAGING' e duas estavam com trial vencido sem assinatura. Toda segunda
 * saíam 13 alertas no Slack por organizações que ninguém ia olhar.
 *
 * O que mudou:
 *   - a auditoria da Iza passou de DIÁRIA para semanal (domingo). O ganho de
 *     rodar todo dia era detectar deriva, e deriva não aparece em 24 h num
 *     prompt que muda algumas vezes por mês;
 *   - o ciclo de clientes (segunda) só roda para organização elegível;
 *   - um ciclo DIÁRIO por mudança (agent-eval-on-change) cobre o que o cron
 *     semanal perderia: se o cliente mexeu na base, avalia no dia seguinte,
 *     no máximo uma vez por organização por dia.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Alerta (configurável por variável de ambiente)
 * ═══════════════════════════════════════════════════════════════════════════
 *   AGENT_EVAL_ALERT_CRITICAL   (padrão: 1)  — alerta com 1 crítico reprovado
 *   SLACK_WEBHOOK_AGENT_QUALITY (sem padrão) — para onde mandar
 *     Reserva: SLACK_WEBHOOK_QUOTA_ALERTS (canal único de operação serve)
 *
 * A nota deixou de disparar alerta: ver shouldAlertQuality.
 */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { sendSlackAlert, buildSectionBlock } from './slackNotifier.js';
import { CORE_RULES_VERSION } from '../agents/coreAgentRules.js';
import { resolveEvalSet, EVAL_SET_VERSION } from '../agents/agentEvalSet.js';
import { resolveTenantAgentProfile } from '../agents/tenantAgentProfile.js';
// Fonte única da regra de acesso (a mesma do requireActivePlan e do /auth/me).
import { computeAccessState, type AccessInput } from './accountAccess.js';
// Mesma contagem de trechos indexados que o termômetro do Treinar IA usa:
// linha em kb_documents não prova que a IA enxerga o conteúdo, chunk prova.
// A variante `OrNull` distingue "não tem base" de "não deu para saber": é a
// diferença entre pular quem não treinou e pular quem o banco não respondeu.
import { countRagChunksByNamespaceOrNull } from './aiReadinessService.js';
// Fila única da execução, compartilhada com as duas rotas /run-async.
import { enqueueEvalRun } from './agentEvalQueue.js';

// ─── Org da Iza (agente do SUPERADMIN / Cliente Zero) ──────────
// Fonte única do id (config/zappiqOrg.ts). Antes esta constante vivia copiada
// aqui, que é exatamente o que aquele módulo existe para impedir.
//
// As duas auditorias automáticas são SEMANAIS: a da Iza no domingo, a dos
// clientes na segunda. A da Iza era diária e custava sozinha cerca de USD
// 1,25 por dia sem detectar nada que o ciclo semanal não detecte.
import { ZAPPIQ_ORG_ID, isZappIQOrg } from '../config/zappiqOrg.js';

// Escopo do ciclo semanal: 'iza' = só a organização da Iza (domingo);
// 'clients' = todas as demais com agente 'live' (segunda).
// O escopo 'all' saiu: nenhum caminho chamava (A053).
export type CronScope = 'iza' | 'clients';

// ─── Elegibilidade: quem o cron pode avaliar (A045 / A067) ──────
//
// O ciclo pegava todo agente 'live'. Em produção isso era 9 organizações
// '-STAGING', 2 contas com trial vencido sem assinatura e organizações sem
// nenhuma base cadastrada: 13 alertas no Slack toda segunda e cerca de USD 60
// por mês de LLM sem dono. A porta é esta função, pura e testável.

/** Por que a organização ficou de fora do ciclo. Vai para o log do ciclo. */
export type MotivoInelegivel = 'staging' | 'paywall' | 'sem_base';

export interface EvalEligibilityInput extends AccessInput {
  /**
   * Id da organização avaliada. Serve ao carve-out da conta da casa
   * (ver passaNoPaywall). Obrigatório de propósito: se fosse opcional, um
   * chamador que esquecesse de passar jogaria a Iza no paywall em silêncio.
   */
  organizationId: string;
  /** Nome da organização. */
  name: string;
  /** Slug da organização. */
  slug: string;
  /**
   * true quando a organização tem pelo menos um trecho indexado no RAG OU
   * pelo menos um Q&A ativo. Sem isso o agente responde só com as regras
   * base e o teste mede o gabarito, não o treino do cliente.
   */
  temBase: boolean;
}

export interface EvalEligibility {
  elegivel: boolean;
  motivo?: MotivoInelegivel;
}

/** Texto do motivo, para o log do ciclo. */
export const MOTIVO_INELEGIVEL_TEXTO: Record<MotivoInelegivel, string> = {
  staging: 'organização de teste (STAGING)',
  paywall: 'trial vencido sem assinatura ou conta cancelada',
  sem_base: 'sem base cadastrada (nenhum trecho no RAG e nenhum Q&A ativo)',
};

/** Marca de organização de teste no nome ou no slug, sem diferenciar caixa. */
const MARCA_STAGING = 'staging';

/**
 * A organização passa no portão do paywall, para efeito do ciclo pago?
 *
 * Regra geral: o critério é o MESMO das rotas de paywall. Delega a
 * computeAccessState e corta só o bloqueio duro. Quem está em carência
 * (soft) ou inadimplente (past_due) continua com acesso ao produto, então
 * continua sendo avaliado.
 *
 * `role` nunca é passado: aqui avaliamos a conta de TERCEIRO, e um
 * superadmin olhando não pode transformar conta vencida em elegível.
 *
 * CARVE-OUT DA CASA. A organização da própria ZappIQ (a que hospeda a Iza)
 * nunca cai no paywall. Ela não é cliente self-serve: a casa não assina o
 * próprio produto, então vive no banco com trial vencido, paidAt nulo e
 * nenhuma assinatura Stripe. Medido em produção em 14/09/2026: trialEndsAt
 * em 05/09/2026, sem carência, estágio TRIAL_EXPIRED. Sem esta linha o
 * paywall sai 'hard' e o ciclo de domingo (agent-eval-iza) pularia a própria
 * Iza, em silêncio, até alguém reparar na falta do relatório.
 *
 * É a MESMA razão do carve-out de `role === 'SUPERADMIN'` em
 * accountAccess.ts, com uma diferença: lá existe um usuário autenticado e
 * dá para olhar o papel dele. O cron não tem usuário e não tem papel, então
 * o carve-out precisa ser pelo dono da conta. O id nunca é comparado na mão:
 * vem de isZappIQOrg (config/zappiqOrg.ts), a fonte única.
 *
 * O carve-out vale SÓ para o paywall. As outras regras continuam valendo
 * para a casa: marca STAGING no nome e ausência de base continuam excluindo.
 */
function passaNoPaywall(org: EvalEligibilityInput): boolean {
  if (isZappIQOrg(org.organizationId)) {
    return true;
  }

  const { paywall } = computeAccessState({
    ...org,
    role: null,
  });
  return paywall !== 'hard';
}

/**
 * Decide se o cron pode avaliar esta organização. Pura e determinística
 * (injete `now` para congelar o relógio).
 *
 * Ordem dos cortes: marca de teste, paywall, base cadastrada. O motivo
 * devolvido é o do primeiro corte, e vai inteiro para o log do ciclo.
 */
export function isEvalEligible(org: EvalEligibilityInput): EvalEligibility {
  const marcaTeste = `${org.name ?? ''} ${org.slug ?? ''}`.toLowerCase();
  if (marcaTeste.includes(MARCA_STAGING)) {
    return { elegivel: false, motivo: 'staging' };
  }

  if (!passaNoPaywall(org)) {
    return { elegivel: false, motivo: 'paywall' };
  }

  if (!org.temBase) {
    return { elegivel: false, motivo: 'sem_base' };
  }

  return { elegivel: true };
}

// ─── Limiar ─────────────────────────────────────────────────────
// AGENT_EVAL_ALERT_SCORE_MIN saiu junto com o critério por nota (A047).
const CRITICAL_MIN = Number(process.env.AGENT_EVAL_ALERT_CRITICAL ?? 1);

/**
 * A047 — o alerta parou de ser por NOTA e passou a ser por FATO NOVO.
 *
 * O critério antigo era absoluto (nota < 90 ou 1 crítico). Como toda
 * organização de teste ficava abaixo de 90, a mesma falha estrutural alertava
 * todo dia: 13 mensagens numa única segunda, e o time parou de ler o canal.
 *
 * Agora alerta só quando há ação a tomar:
 *   (a) um cenário CRÍTICO reprovou; ou
 *   (b) o MESMO cenário reprovou nas duas últimas execuções concluídas
 *       (defeito que sobreviveu a um ciclo inteiro, então não é ruído).
 *
 * A nota continua no painel, que é o lugar dela.
 *
 * FASE 2.1 (2026-05-13): exportado pra ser reusado em /run-async manual.
 */
export function shouldAlertQuality(
  summary: { scorePercent: number; criticalFailed: number },
  contexto: { repetidos?: string[] } = {},
): boolean {
  if (summary.criticalFailed >= CRITICAL_MIN) return true;
  return (contexto.repetidos?.length ?? 0) > 0;
}

/** Um item do results JSONB, na parte que o alerta precisa ler. */
interface ResultadoDeCenario {
  scenarioId?: unknown;
  combined?: unknown;
}

/** Ids de cenário reprovados num results JSONB. Tolera formato inesperado. */
function reprovadosEm(results: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(results)) return ids;
  for (const r of results as ResultadoDeCenario[]) {
    if (r && typeof r.scenarioId === 'string' && r.combined === 'fail') {
      ids.add(r.scenarioId);
    }
  }
  return ids;
}

/**
 * Cenários que reprovaram NAS DUAS execuções: a atual e a concluída
 * imediatamente anterior do mesmo agente. Pura (recebe os results JSON).
 *
 * 'partial' não conta: o alerta é para o que falhou de verdade duas vezes.
 * Sem execução anterior (primeira do agente) o resultado é vazio, porque
 * ainda não há repetição a provar.
 */
export function scenariosFailingTwice(resultsAtual: unknown, resultsAnterior: unknown): string[] {
  const anterior = reprovadosEm(resultsAnterior);
  if (anterior.size === 0) return [];
  const atual = reprovadosEm(resultsAtual);
  return [...atual].filter((id) => anterior.has(id));
}

// ─── Slack notifier (exportado pra reuso em route /run-async) ──
export async function notifySlackQualityIssue(input: {
  agentId: string;
  agentName: string;
  organizationName: string;
  runId: string;
  scorePercent: number;
  passed: number;
  partial: number;
  failed: number;
  criticalFailed: number;
  totalScenarios: number;
  durationMs: number;
  topFails: Array<{ scenarioId: string; category: string; severity: string }>;
  /** A047 — cenários que reprovaram nesta E na execução anterior. */
  repetidos?: string[];
  /**
   * A047 — para onde o link leva. O painel do cliente e o do superadmin são
   * telas diferentes; mandar o dono do negócio para /admin era um beco.
   */
  dashboardPath?: string;
}): Promise<boolean> {
  const webhook =
    process.env.SLACK_WEBHOOK_AGENT_QUALITY || process.env.SLACK_WEBHOOK_QUOTA_ALERTS;

  if (!webhook) {
    logger.warn('[agentEvalCron] sem webhook Slack configurado — alerta apenas em logs');
    return false;
  }

  const severity = input.criticalFailed > 0 ? '🚨 CRITICAL' : '⚠️ WARNING';
  // FASE 2.1: APP_URL deveria apontar pra https://zappiq.com.br (não
  // app.zappiq.com.br que não existe). Mantemos fallback correto.
  const baseUrl = process.env.APP_URL || 'https://zappiq.com.br';

  const topFailsLines = input.topFails
    .slice(0, 5)
    .map((f) => `• \`${f.scenarioId}\` (${f.category}, ${f.severity})`)
    .join('\n') || '_nenhum fail listado_';

  // FASE 2.2c (#246): payload SIMPLIFICADO. /test-slack chegava mas
  // notifyQualityIssue não — 6 blocks com fields+context pareciam estar
  // falhando silenciosamente em algum filtro do Slack. Mudamos para um
  // único section block markdown (mesmo padrão do /test-slack que funciona)
  // + emoji unicode em vez de `:chart_with_downwards_trend:` (que pode
  // causar reject silencioso em alguns workspaces).
  // A047: o motivo vem no corpo. Antes a mensagem dizia sempre "abaixo do
  // limiar", inclusive quando o problema era outro, e o limiar deixou de ser
  // o critério.
  const repetidos = input.repetidos ?? [];
  let motivo: string;
  if (input.criticalFailed > 0) {
    motivo = `${input.criticalFailed} cenário(s) crítico(s) reprovado(s)`;
  } else if (repetidos.length > 0) {
    motivo = `reprovação repetida em ${repetidos.length} cenário(s): ${repetidos.slice(0, 5).join(', ')}`;
  } else {
    // Chamada direta (diagnóstico do superadmin), fora do caminho do alerta.
    motivo = 'execução sinalizada para revisão';
  }

  const messageMarkdown = [
    `*${severity} — Qualidade do Agente exige revisão*`,
    '',
    `*Agente:* ${input.agentName} (${input.organizationName})`,
    `*Motivo:* ${motivo}`,
    `*Score:* ${input.scorePercent}%`,
    `*Aprovados:* ${input.passed}/${input.totalScenarios} · *Parciais:* ${input.partial} · *Reprovados:* ${input.failed} · *Críticos:* ${input.criticalFailed}`,
    `*Duração:* ${(input.durationMs / 1000).toFixed(1)}s`,
    '',
    `*Top falhas:*`,
    topFailsLines,
    '',
    `runId \`${input.runId}\` · eval ${EVAL_SET_VERSION} · core ${CORE_RULES_VERSION}`,
    `<${baseUrl}${input.dashboardPath ?? '/admin/agent-quality'}|🔗 Abrir painel>`,
  ].join('\n');

  return sendSlackAlert({
    webhook,
    text: `${severity} Agent ${input.agentName} score ${input.scorePercent}% (criticalFailed=${input.criticalFailed})`,
    blocks: [buildSectionBlock(messageMarkdown)],
    username: 'ZappIQ QA Bot',
  });
}

// ─── Elegibilidade com ida ao banco ────────────────────────────

/** Colunas da organização que a elegibilidade precisa ler. */
const SELECT_ORG_ELEGIBILIDADE = {
  id: true,
  name: true,
  slug: true,
  churnedAt: true,
  subscriptionStatus: true,
  stripeSubscriptionId: true,
  trialEndsAt: true,
  isTrialActive: true,
  trialConverted: true,
  paidAt: true,
  paywallGraceUntil: true,
} as const;

/**
 * A organização tem base cadastrada?
 *
 * Base = pelo menos um trecho indexado no RAG OU um Q&A ativo. A pergunta é
 * sobre o que a IA CONSEGUE usar: linha em kb_documents que nunca virou chunk
 * não ajuda o agente e não deve gerar teste pago.
 *
 * Fail-soft DE VERDADE: erro de consulta responde true (desconhecido, portanto
 * elegível). O try/catch daqui não bastava, porque countRagChunksByNamespace
 * engolia o próprio erro e devolvia 0/0, indistinguível de "não tem base".
 * O cliente que treinou a IA era pulado em silêncio por uma falha de banco.
 * Por isso a contagem vem da variante que devolve null em erro.
 */
async function temBaseCadastrada(organizationId: string): Promise<boolean> {
  try {
    const [contagem, qaAtivos] = await Promise.all([
      countRagChunksByNamespaceOrNull(organizationId),
      prisma.qAPair.count({ where: { organizationId, isActive: true } }),
    ]);
    if (contagem === null) {
      logger.warn({ msg: 'agent_eval_base_indeterminada', organizationId, fonte: 'rag' });
      return true;
    }
    return contagem.docChunks + contagem.qaChunks > 0 || qaAtivos > 0;
  } catch (err: any) {
    logger.warn({
      msg: 'agent_eval_base_indeterminada',
      organizationId,
      error: String(err?.message || err),
    });
    return true;
  }
}

// ─── Teto de avaliação por ORGANIZAÇÃO ─────────────────────────

/** Início do dia UTC, régua do teto de uma avaliação por organização por dia. */
function inicioDoDiaUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * A organização ainda cabe numa avaliação automática hoje?
 *
 * Porta ÚNICA dos três ciclos (Iza, clientes e por mudança). Duas travas:
 *
 *   1. execução viva ('pending' ou 'running') na organização. É o que impede
 *      o ciclo por mudança das 04:50 de disparar por cima do semanal das
 *      04:30 que ainda está rodando. Linha presa não bloqueia para sempre: a
 *      varredura horária (sweepStuckEvalRuns) marca como falha o que passou
 *      de uma hora, e falha não conta aqui;
 *   2. execução já concluída HOJE (UTC) na organização.
 *
 * O teto é por ORGANIZAÇÃO, não por agente: o teste custa dinheiro de LLM da
 * casa, e quem tem dois agentes 'live' pagava dois testes por dia. O vínculo é
 * o `agent.organizationId` da própria linha de execução.
 */
export async function podeAgendarAvaliacao(
  organizationId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const viva = await prisma.agentEvalRun.count({
    where: { status: { in: ['pending', 'running'] }, agent: { organizationId } },
    take: 1,
  });
  if (viva > 0) return false;

  const concluidaHoje = await prisma.agentEvalRun.count({
    where: {
      status: 'completed',
      startedAt: { gte: inicioDoDiaUtc(now) },
      agent: { organizationId },
    },
    take: 1,
  });
  return concluidaHoje === 0;
}

/** Por que a organização ficou de fora do ciclo, inclusive o teto do dia. */
export type MotivoPulada = MotivoInelegivel | 'teto_diario';

/** Contagem de organizações puladas, por motivo. Vai inteira para o log. */
type PuladasPorMotivo = Partial<Record<MotivoPulada, number>>;

export interface CronCycleResult {
  agentsProcessed: number;
  agentsSkipped: number;
  skippedByReason: PuladasPorMotivo;
  agentsFailed: number;
  durationMs: number;
}

// ─── Ciclo: itera pelos agentes ativos do escopo ───────────────
export async function runAgentEvalCronCycle(
  scope: CronScope,
  now: Date = new Date(),
): Promise<CronCycleResult> {
  const startedAt = Date.now();
  logger.info(`[agentEvalCron] ciclo iniciado (escopo=${scope})`);

  // Agent.status: 'draft' | 'reviewed' | 'live'. Só avaliamos 'live'.
  //   'iza'     → só a organização da Iza (semanal, domingo)
  //   'clients' → todas menos a Iza (semanal, segunda)
  const orgFilter =
    scope === 'iza' ? { organizationId: ZAPPIQ_ORG_ID } : { organizationId: { not: ZAPPIQ_ORG_ID } };

  const agents = await prisma.agent.findMany({
    where: { status: 'live', ...orgFilter },
    include: { organization: { select: SELECT_ORG_ELEGIBILIDADE } },
  });

  let agentsProcessed = 0;
  let agentsSkipped = 0;
  let agentsFailed = 0;
  const skippedByReason: PuladasPorMotivo = {};

  for (const agent of agents) {
    try {
      const org = agent.organization;
      const elegibilidade = isEvalEligible({
        ...org,
        organizationId: agent.organizationId,
        temBase: await temBaseCadastrada(agent.organizationId),
      });

      if (!elegibilidade.elegivel) {
        const motivo = elegibilidade.motivo!;
        agentsSkipped++;
        skippedByReason[motivo] = (skippedByReason[motivo] ?? 0) + 1;
        logger.info({
          msg: 'agent_eval_cron_org_pulada',
          organizationName: org.name,
          agentId: agent.id,
          motivo,
          detalhe: MOTIVO_INELEGIVEL_TEXTO[motivo],
        });
        continue;
      }

      // Teto do dia, por ORGANIZAÇÃO. É a mesma porta do ciclo por mudança:
      // sem ela, os dois ciclos da madrugada avaliavam o mesmo agente duas
      // vezes, cada uma com o custo de LLM de um teste inteiro.
      if (!(await podeAgendarAvaliacao(agent.organizationId, now))) {
        agentsSkipped++;
        skippedByReason.teto_diario = (skippedByReason.teto_diario ?? 0) + 1;
        logger.info({
          msg: 'agent_eval_cron_org_no_teto_do_dia',
          organizationName: org.name,
          agentId: agent.id,
        });
        continue;
      }

      // O gabarito é resolvido aqui só para gravar totalScenarios na linha; a
      // execução resolve de novo, a partir do mesmo perfil.
      const profile = await resolveTenantAgentProfile(agent.organizationId, { agentId: agent.id });
      const scenarios = resolveEvalSet(profile);

      const run = await prisma.agentEvalRun.create({
        data: {
          agentId: agent.id,
          status: 'pending',
          evalSetVersion: EVAL_SET_VERSION,
          coreRulesVersion: CORE_RULES_VERSION,
          triggeredBy: 'cron',
          scenarioFilter: {
            source: scope === 'iza' ? 'cron_semanal_iza' : 'cron_semanal',
          } as any,
          totalScenarios: scenarios.length,
        },
        select: { id: true },
      });

      // Fila, não execução em linha. O teste leva minutos e roda com
      // concorrência 1 na fila `agent-eval`; rodar aqui dentro prenderia o
      // worker da fila `cron` e é o que produzia a execução em duplicidade.
      //
      // enqueueEvalRun LANÇA se a fila recusar (e marca a linha como falha na
      // hora). Então agentsProcessed conta execuções ENFILEIRADAS, e
      // agentsFailed conta falha em montar ou enfileirar a execução.
      await enqueueEvalRun(run.id);
      agentsProcessed++;
    } catch (err: any) {
      agentsFailed++;
      logger.error({
        msg: 'agent_eval_cron_run_failed',
        agentId: agent.id,
        error: String(err?.message || err),
      });
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.info({
    msg: 'agent_eval_cron_cycle_completed',
    escopo: scope,
    agentsProcessed,
    agentsSkipped,
    skippedByReason,
    agentsFailed,
    durationMs,
  });

  return { agentsProcessed, agentsSkipped, skippedByReason, agentsFailed, durationMs };
}

// ─── Ciclo diário por MUDANÇA (agent-eval-on-change) ───────────
//
// O ciclo semanal barato tem um custo: se o cliente treina a IA na terça, o
// teste dele só roda na segunda seguinte. Este ciclo cobre esse vão sem
// voltar ao teste diário de todo mundo: roda de madrugada, e só para quem
// mexeu na base depois da última execução concluída.
//
// Teto duro de 1 execução por ORGANIZAÇÃO por dia (podeAgendarAvaliacao, o
// mesmo helper do ciclo semanal). Sem isso, uma tarde de trabalho no Treinar
// IA (cada upload e cada Q&A gera evento) viraria uma execução por evento, e
// quem tem dois agentes 'live' pagaria dois testes por dia.

/** Trigger gravado nas execuções deste ciclo. */
export const TRIGGER_ON_CHANGE = 'cron_on_change';

/**
 * Eventos de treino que justificam reavaliar o agente.
 *
 * Todos os eventos do Treinar IA nascem com o prefixo 'kb.' (ver
 * routes/aiTraining.ts). O teste do playground também nasce assim e fica de
 * FORA: ele não muda a base, e cada mensagem de teste dispararia uma
 * avaliação paga no dia seguinte.
 */
const ACAO_PLAYGROUND = 'kb.playground.test';

export interface OnChangeCycleResult {
  agentsProcessed: number;
  agentsSkipped: number;
  agentsFailed: number;
  durationMs: number;
}

export async function runAgentEvalOnChangeCycle(
  now: Date = new Date(),
): Promise<OnChangeCycleResult> {
  const startedAt = Date.now();
  logger.info('[agentEvalCron] ciclo por mudança iniciado');

  const agents = await prisma.agent.findMany({
    where: { status: 'live' },
    include: { organization: { select: SELECT_ORG_ELEGIBILIDADE } },
  });

  let agentsProcessed = 0;
  let agentsSkipped = 0;
  let agentsFailed = 0;

  for (const agent of agents) {
    try {
      // 1. Teto do dia, por ORGANIZAÇÃO. Primeiro porque é a consulta mais
      // barata, e porque é ela que impede este ciclo (04:50) de disparar por
      // cima do semanal (04:30) que ainda está na fila ou rodando.
      if (!(await podeAgendarAvaliacao(agent.organizationId, now))) {
        agentsSkipped++;
        continue;
      }

      // 2. Houve mudança na base depois da última execução concluída?
      // TODO: quando agent_prompt_versions existir, versão nova de prompt
      // também deve acionar este ciclo (hoje só audit_logs).
      const ultima = await prisma.agentEvalRun.findFirst({
        where: { agentId: agent.id, status: 'completed' },
        orderBy: { startedAt: 'desc' },
        select: { completedAt: true, startedAt: true },
      });
      const desde = ultima?.completedAt ?? ultima?.startedAt ?? null;

      const mudancas = await prisma.auditLog.count({
        where: {
          organizationId: agent.organizationId,
          action: { startsWith: 'kb.' },
          NOT: { action: ACAO_PLAYGROUND },
          ...(desde ? { createdAt: { gt: desde } } : {}),
        },
        take: 1,
      });
      if (mudancas === 0) {
        agentsSkipped++;
        continue;
      }

      // 3. A organização ainda precisa ser elegível (mesma porta do semanal).
      const elegibilidade = isEvalEligible({
        ...agent.organization,
        organizationId: agent.organizationId,
        temBase: await temBaseCadastrada(agent.organizationId),
      });
      if (!elegibilidade.elegivel) {
        agentsSkipped++;
        logger.info({
          msg: 'agent_eval_on_change_org_pulada',
          organizationName: agent.organization.name,
          agentId: agent.id,
          motivo: elegibilidade.motivo,
        });
        continue;
      }

      const profile = await resolveTenantAgentProfile(agent.organizationId, { agentId: agent.id });
      const scenarios = resolveEvalSet(profile);

      const run = await prisma.agentEvalRun.create({
        data: {
          agentId: agent.id,
          status: 'pending',
          evalSetVersion: EVAL_SET_VERSION,
          coreRulesVersion: CORE_RULES_VERSION,
          triggeredBy: TRIGGER_ON_CHANGE,
          scenarioFilter: { source: TRIGGER_ON_CHANGE } as any,
          totalScenarios: scenarios.length,
        },
        select: { id: true },
      });

      // Mesma fila do semanal e das rotas: a execução nunca roda dentro do
      // worker da fila `cron`.
      await enqueueEvalRun(run.id);
      agentsProcessed++;
    } catch (err: any) {
      agentsFailed++;
      logger.error({
        msg: 'agent_eval_on_change_falhou',
        agentId: agent.id,
        error: String(err?.message || err),
      });
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.info({
    msg: 'agent_eval_on_change_cycle_completed',
    agentsProcessed,
    agentsSkipped,
    agentsFailed,
    durationMs,
  });

  return { agentsProcessed, agentsSkipped, agentsFailed, durationMs };
}
