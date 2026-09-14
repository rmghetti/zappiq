/**
 * /api/agent-quality — versão CLIENTE da Qualidade do Agente (task #244 / FASE 2.2b)
 *
 * Mesma lógica do admin (adminAgentEval.ts) MAS:
 *   • Sem requireRole('SUPERADMIN'), mas TODA rota que escreve no prompt ou
 *     gasta modelo exige ADMIN ou SUPERADMIN (A115). Leitura segue aberta a
 *     qualquer usuário autenticado da própria organização.
 *   • RLS forçada por `req.user.organizationId` em TODAS as operações.
 *     Cliente só vê agentes da própria org, só roda eval no próprio agent,
 *     só vê runs e decisões da própria org.
 *   • Cooldown: cliente só pode rodar 1 eval/dia/agent (cron já roda os
 *     outros 6 dias da semana). Evita custo de Sonnet ($1-2/run).
 *   • Sem /test-slack, sem /scenarios listing (admin-only diagnostics).
 *
 * Endpoints expostos ao cliente:
 *   GET    /agents                                          — agentes da org
 *   POST   /run-async                                       — dispara eval (cooldown)
 *   GET    /runs?agentId=X                                  — histórico
 *   GET    /runs/:id?includeResults=true                    — detalhes
 *   POST   /runs/:runId/scenarios/:scenarioId/apply-fix     — aplica sugestão IA
 *   POST   /runs/:runId/scenarios/:scenarioId/reject-fix    — recusa sugestão
 *   POST   /fix-decisions/:decisionId/revert                — reverte aplicação
 *
 * RLS pattern:
 *   Cada handler começa carregando o agent (ou run.agent) e validando
 *   `agent.organizationId === req.user.organizationId`. Se diferente,
 *   retorna 404 (não 403 — não exponhamos a existência de recursos
 *   de outras orgs).
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
// A115: quem escreve no prompt do agente é ADMIN ou SUPERADMIN, e o que custa
// modelo tem teto por organização por dia.
import { cotaDiaria } from '../middleware/cotaDiaria.js';
import { CORE_RULES_VERSION } from '../agents/coreAgentRules.js';
import {
  resolveEvalSet,
  getSkippedScenarios,
  EVAL_SET_VERSION,
  HARNESS_VERSION,
} from '../agents/agentEvalSet.js';
import {
  resolveTenantAgentProfile,
  type TenantAgentProfile,
} from '../agents/tenantAgentProfile.js';
import { assertNoForeignBrand, ForeignBrandLeakError } from '../agents/tenantIsolationGuard.js';
import { executeAgentEvalRun } from '../services/agentEvalRunner.js';
import { enqueueEvalRun, resolveScenariosForRun } from '../services/agentEvalQueue.js';
import {
  applyPatch,
  DuplicatePatchError,
  regraTerminaEmFraseCompleta,
} from '../services/agentPromptPatcher.js';
// A083: quem grava o prompt declara a origem da mudança e o histórico vira
// versão no banco. Reverter passa a exigir que o prompt ainda seja o que a
// correção deixou. Se mudou, apagaria tudo o que veio depois.
import {
  publishPrompt,
  hashPrompt,
  PromptChangedError,
  type PromptVersionDb,
} from '../services/promptVersionService.js';
// FASE 2.2d (#252): on-demand suggestion pra cenários partial.
// AGENT_EVAL_SET já importado mais acima (FASE 2.2b) — só adicionamos suggestFix.
import { suggestFix } from '../services/agentEvalRunner.js';
// P56 — a nota oscila sozinha. O cliente leigo recebe um ESTADO, não a faixa.
import { carregarRuidoDoAgente, classificarMudanca } from '../services/evalRuidoService.js';
// P61 — "Corrigimos o método de avaliação": o aviso da nota recalculada.
import { resumirRegravacao } from '../services/evalRegradeService.js';
// C3 (Passo 14) — a correção aprovada vira REGISTRO: uma regra ativa por
// cenário, substituição no lugar de acúmulo, e desfazer cirúrgico.
import { isFlagOn } from '../services/featureFlags.js';
import {
  carregarRegrasAtivas,
  aplicarRegraDoCenario,
  reverterRegra,
  regraDaDecisao,
  TetoDeRegrasError,
  TETO_DE_REGRAS_ATIVAS,
} from '../services/agentRulesService.js';
import { detectarConflitos, limparTextoDaRegra } from '../agents/regrasDoAgente.js';
// A049 — o re-teste roda 3 amostras e vira execução gravada.
import {
  AMOSTRAS_DO_RETESTE,
  consolidarReteste,
  type AmostraDoReteste,
} from '../services/retesteDaCorrecao.js';

const router = Router();
router.use(authMiddleware as any);

// ─── Cooldown: cliente roda no máximo 1 eval / 24h por agent ────────
const RUN_COOLDOWN_HOURS = 24;

/**
 * A151 — o horário que o cliente lê é o do Brasil.
 *
 * `toLocaleString('pt-BR')` sem timeZone usa o fuso do PROCESSO, e o Fly roda
 * em UTC: "Próximo disponível em 14/09/2026, 09:00" saía 3 h adiantado para
 * quem está em Brasília. O orquestrador já monta o bloco "# Agora" com
 * America/Sao_Paulo; esta é a mesma régua, na porta do cliente.
 *
 * Pura e exportada para o teste poder fixar a saída sem depender do fuso da
 * máquina que roda o CI.
 */
export const FUSO_DO_CLIENTE = 'America/Sao_Paulo';

export function formatarHorarioDeBrasilia(quando: Date): string {
  return quando.toLocaleString('pt-BR', { timeZone: FUSO_DO_CLIENTE });
}

// ─── Filtro de cenários: um só, em services/agentEvalQueue.ts ───────
// A cópia que vivia aqui fazia o RECORTE na rota, e a EXECUÇÃO reconstruía o
// recorte a partir do scenarioFilter gravado na linha, com outra função. Duas
// leituras do mesmo filtro é uma a mais: se elas divergirem, o cliente vê um
// total de cenários e recebe outro. resolveScenariosForRun é a leitura única.

// ─── Helper: extrai snapshot do actor (mesma assinatura do admin) ───
async function getActorSnapshot(userId: string | undefined) {
  if (!userId) return { id: null, email: '—', name: null, role: null };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
  return {
    id: user?.id || null,
    email: user?.email || '—',
    name: user?.name || null,
    role: user?.role || null,
  };
}

// ─── Helper: garante que agent pertence à org do user ────────────────
async function loadAgentScoped(agentId: string, orgId: string) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, organizationId: orgId },
    select: { id: true, name: true, systemPrompt: true, organizationId: true },
  });
  return agent;
}

// ─── Helper: carrega run só se agent dela pertence à org ────────────
async function loadRunScoped(runId: string, orgId: string) {
  const run = await prisma.agentEvalRun.findFirst({
    where: { id: runId, agent: { organizationId: orgId } },
    include: {
      agent: { select: { id: true, name: true, systemPrompt: true, organizationId: true } },
    },
  });
  return run;
}

function findSuggestionInResults(
  results: any,
  scenarioId: string,
): { suggestion: any; severity: string; combined: string } | null {
  if (!Array.isArray(results)) return null;
  const scenario = results.find((r: any) => r.scenarioId === scenarioId);
  if (!scenario) return null;
  return {
    suggestion: scenario.suggestedFix || null,
    severity: scenario.severity || 'medium',
    combined: scenario.combined || 'fail',
  };
}

// ════════════════════════════════════════════════════════════════════
// GET /agents — lista agentes da org do cliente
// ════════════════════════════════════════════════════════════════════
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const agents = await prisma.agent.findMany({
      // Agent.status: 'draft' | 'reviewed' | 'live' — só expõe agentes em uso real.
      where: { organizationId: orgId, status: 'live' },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });

    // O cliente precisa saber contra o que o agente DELE vai ser testado, e o
    // que não roda por falta de treino. Isso troca "você tirou 48%" por
    // "complete o Treinar IA pra ser avaliado nisso".
    const profile = await resolveTenantAgentProfile(orgId);
    res.json({
      total: agents.length,
      agents,
      testScope: {
        agentName: profile.agentName,
        businessName: profile.businessName,
        totalScenarios: resolveEvalSet(profile).length,
        skipped: getSkippedScenarios(profile),
      },
    });
  } catch (err: any) {
    logger.error('[agentQuality] /agents erro:', err);
    res.status(500).json({ error: 'erro ao listar agentes', message: err?.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// GET /agents/:agentId/versions: histórico do prompt (sem o texto)
// ─────────────────────────────────────────────────────────────────
// A lista serve para o cliente enxergar o que mudou, quando e por quem.
// O texto fica fora de propósito: prompt de cliente tem milhares de chars
// e a listagem carregaria dezenas deles por requisição sem necessidade.
// ════════════════════════════════════════════════════════════════════
const VERSOES_POR_PAGINA = 100;

router.get('/agents/:agentId/versions', async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { agentId } = req.params;

  try {
    const agent = await loadAgentScoped(agentId, orgId);
    if (!agent) {
      res.status(404).json({ error: 'agente não encontrado' });
      return;
    }

    // Quem conta os caracteres é o banco. Com findMany + select do
    // systemPrompt, cem versões de um prompt como o da Iza (26.886 chars)
    // viajavam do Postgres até aqui só para virar um `.length` e serem
    // jogadas fora. O escopo por organização já foi feito no loadAgentScoped
    // acima; aqui o agentId entra como parâmetro, nunca concatenado.
    const linhas = await prisma.$queryRaw<
      Array<{
        version: number;
        source: string;
        hash: string;
        created_by: string | null;
        created_at: Date;
        chars: number;
      }>
    >`SELECT version, source, hash, created_by, created_at, length(system_prompt) AS chars
        FROM agent_prompt_versions
       WHERE agent_id = ${agent.id}
       ORDER BY version DESC
       LIMIT ${VERSOES_POR_PAGINA}`;

    res.json({
      agentId: agent.id,
      agentName: agent.name,
      total: linhas.length,
      versions: linhas.map((v) => ({
        version: v.version,
        source: v.source,
        hash: v.hash,
        created_by: v.created_by,
        created_at: new Date(v.created_at).toISOString(),
        chars: Number(v.chars ?? 0),
      })),
    });
  } catch (err: any) {
    logger.error('[agentQuality] versions erro:', err);
    res.status(500).json({ error: 'erro ao listar versões', message: err?.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// GET /agents/:agentId/versions/:version: uma versão, com o texto
// ════════════════════════════════════════════════════════════════════
router.get('/agents/:agentId/versions/:version', async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { agentId } = req.params;
  const version = Number(req.params.version);

  if (!Number.isInteger(version) || version < 1) {
    res.status(400).json({ error: 'versão inválida' });
    return;
  }

  try {
    const agent = await loadAgentScoped(agentId, orgId);
    if (!agent) {
      res.status(404).json({ error: 'agente não encontrado' });
      return;
    }

    const linha = await prisma.agentPromptVersion.findFirst({
      where: { agentId: agent.id, version },
      select: {
        version: true,
        source: true,
        hash: true,
        createdBy: true,
        createdAt: true,
        systemPrompt: true,
        decisionId: true,
      },
    });
    if (!linha) {
      res.status(404).json({ error: 'versão não encontrada' });
      return;
    }

    res.json({
      agentId: agent.id,
      version: {
        version: linha.version,
        source: linha.source,
        hash: linha.hash,
        created_by: linha.createdBy,
        created_at: linha.createdAt.toISOString(),
        decision_id: linha.decisionId,
        chars: (linha.systemPrompt || '').length,
        systemPrompt: linha.systemPrompt,
      },
    });
  } catch (err: any) {
    logger.error('[agentQuality] version erro:', err);
    res.status(500).json({ error: 'erro ao carregar versão', message: err?.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// POST /run-async: dispara eval (uma execução viva por agente + 24 h)
// ════════════════════════════════════════════════════════════════════
router.post('/run-async', requireRole('ADMIN', 'SUPERADMIN'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const agentId = String(req.body?.agentId || '');
  if (!agentId) {
    res.status(400).json({ error: 'agentId obrigatório' });
    return;
  }

  try {
    const agent = await loadAgentScoped(agentId, orgId);
    if (!agent) {
      res.status(404).json({ error: 'agente não encontrado' });
      return;
    }

    // Trava 1, execução VIVA: um teste por agente de cada vez, sem janela de
    // tempo. Com a fila, a linha fica 'pending' enquanto a trava global não
    // libera, o que em dia cheio são dezenas de minutos. Se só o cooldown de
    // 24 h contasse (e ele conta apenas 'completed'), cada clique impaciente
    // criaria OUTRA execução paga, todas na fila, todas cobradas.
    const viva = await prisma.agentEvalRun.findFirst({
      where: {
        agentId,
        triggeredBy: 'client_manual',
        status: { in: ['pending', 'running'] },
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true, status: true },
    });
    if (viva) {
      // O código continua 'cooldown' porque é o que a tela do cliente já sabe
      // ler para mostrar a mensagem no lugar certo; `reason` distingue os dois
      // motivos para quem consome a API.
      res.status(429).json({
        error: 'cooldown',
        reason: 'execucao_em_andamento',
        message: 'Já existe um teste em andamento para este agente. Aguarde ele terminar.',
        lastRunId: viva.id,
      });
      return;
    }

    // Trava 2, cooldown: bloqueia se o CLIENTE já CONCLUIU um teste nas
    // últimas 24 h.
    //
    // A048: antes contava qualquer execução 'manual' ou 'client_manual' com
    // status diferente de 'failed'. Duas consequências medidas: execução presa
    // em 'running' por reinício de máquina travava o botão por um dia, e teste
    // disparado pelo superadmin gastava o direito do cliente. Agora conta só o
    // que ele mesmo rodou e concluiu. Execução 'failed' não gasta nada: o
    // cliente pode tentar de novo na hora.
    const cutoff = new Date(Date.now() - RUN_COOLDOWN_HOURS * 3600 * 1000);
    const recent = await prisma.agentEvalRun.findFirst({
      where: {
        agentId,
        triggeredBy: 'client_manual',
        status: 'completed',
        startedAt: { gte: cutoff },
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true, startedAt: true, status: true },
    });
    if (recent) {
      const nextAvailable = new Date(recent.startedAt.getTime() + RUN_COOLDOWN_HOURS * 3600 * 1000);
      res.status(429).json({
        error: 'cooldown',
        reason: 'aguardando_24h',
        message: `Você já executou um teste nas últimas ${RUN_COOLDOWN_HOURS}h. Próximo disponível em ${formatarHorarioDeBrasilia(nextAvailable)}.`,
        nextAvailableAt: nextAvailable.toISOString(),
        lastRunId: recent.id,
      });
      return;
    }

    const scenarioIds = Array.isArray(req.body?.scenarios) ? req.body.scenarios : undefined;
    const category = req.body?.category;
    const criticalOnly = req.body?.criticalOnly === true;

    const profile = await resolveTenantAgentProfile(orgId, { agentId });
    const scenarios = resolveScenariosForRun(profile, { scenarioIds, category, criticalOnly });
    if (scenarios.length === 0) {
      res.status(400).json({ error: 'nenhum cenário corresponde ao filtro' });
      return;
    }

    const run = await prisma.agentEvalRun.create({
      data: {
        agentId,
        status: 'pending',
        evalSetVersion: EVAL_SET_VERSION,
        coreRulesVersion: CORE_RULES_VERSION,
        triggeredBy: 'client_manual', // marca explícito pra distinguir de admin/cron
        scenarioFilter: { scenarioIds, category, criticalOnly } as any,
        totalScenarios: scenarios.length,
      },
      select: { id: true, startedAt: true },
    });

    // A048: a execução deixou de rodar dentro do processo da API. Sai daqui
    // como job da fila `agent-eval` (concorrência 1, jobId = runId) e o worker
    // roda executeRunJob, o MESMO corpo do cron e da rota do superadmin.
    // Antes era um setImmediate: reinício de máquina no meio deixava a linha
    // em 'running' para sempre, e era essa linha presa que travava o botão do
    // cliente pelo cooldown de 24 h.
    await enqueueEvalRun(run.id);

    res.status(202).json({
      runId: run.id,
      status: 'pending',
      agentId,
      agentName: agent.name,
      totalScenarios: scenarios.length,
      startedAt: run.startedAt,
      pollUrl: `/api/agent-quality/runs/${run.id}`,
    });
  } catch (err: any) {
    logger.error('[agentQuality] run-async erro:', err);
    res.status(500).json({ error: 'erro ao iniciar teste', message: err?.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// GET /runs — histórico de runs da org do cliente
// ════════════════════════════════════════════════════════════════════
router.get('/runs', async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  try {
    const agentId = req.query.agentId ? String(req.query.agentId) : undefined;
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    // Runs 'invalidated' são as que rodaram sob o gabarito contaminado (v1):
    // o agente do cliente era testado contra a prova da ZappIQ e tirava ~48%.
    // Ficam no banco pra auditoria, mas o cliente não vê um score que nunca
    // foi sobre o negócio dele.
    const where: any = {
      agent: { organizationId: orgId },
      status: { not: 'invalidated' },
      // C3 (A049): o re-teste passou a ser execução GRAVADA, para existir
      // rastro de eficácia da correção. Ele roda 1 cenário 3 vezes, então
      // não é "a nota da semana" e não pode aparecer no histórico como se
      // fosse: a lista do cliente segue mostrando só execuções completas.
      triggeredBy: { not: 'client_retest' },
    };
    if (agentId) where.agentId = agentId;

    const runs = await prisma.agentEvalRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        agentId: true,
        status: true,
        evalSetVersion: true,
        coreRulesVersion: true,
        triggeredBy: true,
        totalScenarios: true,
        passed: true,
        partial: true,
        failed: true,
        criticalFailed: true,
        scorePercent: true,
        startedAt: true,
        completedAt: true,
        durationMs: true,
        agent: { select: { name: true } },
      },
    });
    // P56: piso de ruído do agente escolhido. É o que separa "caiu 5 pontos"
    // (a mesma nota, medida duas vezes) de queda de verdade. A tela do
    // cliente usa só o ESTADO derivado dele; o número fica para o admin.
    const ruido = agentId ? await carregarRuidoDoAgente(agentId) : null;

    res.json({ total: runs.length, runs, ruido });
  } catch (err: any) {
    logger.error('[agentQuality] /runs erro:', err);
    res.status(500).json({ error: 'erro ao listar runs', message: err?.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// GET /runs/:id — detalhes de uma run (com fixDecisions)
// ════════════════════════════════════════════════════════════════════
router.get('/runs/:id', async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  try {
    const includeResults = req.query.includeResults === 'true';
    const run = await prisma.agentEvalRun.findFirst({
      // A055: a listagem escondia as execuções 'invalidated' (as 26 que
      // rodaram sob o gabarito contaminado, média 47), mas a consulta por id
      // não filtrava: um link antigo abria a nota que nunca foi sobre o
      // negócio do cliente. Agora o mesmo filtro vale nos dois lugares.
      where: {
        id: req.params.id,
        agent: { organizationId: orgId },
        status: { not: 'invalidated' },
      },
      include: {
        agent: { select: { id: true, name: true, organizationId: true } },
        fixDecisions: { orderBy: { decidedAt: 'desc' } },
      },
    });
    if (!run) {
      res.status(404).json({ error: 'execução não encontrada' });
      return;
    }
    const { results, ...rest } = run as any;
    // FASE 2.2c follow-up: enriquece com userMessage do gabarito pra que runs
    // antigas (pré-deploy 2026-05-14 13:51) também mostrem a mensagem enviada
    // ao agente na UI. V2: o gabarito vem do tenant, não de uma constante.
    const profileRun = await resolveTenantAgentProfile(orgId, { agentId: run.agent.id });
    const defs = resolveEvalSet(profileRun);
    const enrichedResults = includeResults && Array.isArray(results)
      ? results.map((r: any) => ({
          ...r,
          userMessage:
            r.userMessage || defs.find((s) => s.id === r.scenarioId)?.userMessage || null,
        }))
      : undefined;
    // ─── P61: a nota recalculada, quando existir ──────────────────
    // Nunca confundida com execução nova: vem num campo próprio, com o
    // rótulo "recalculada" na tela.
    //
    // Revisão do PR: o aviso fala de "sua última execução". Numa execução
    // antiga aberta pelo histórico, a mesma frase dava a entender que a nota
    // de hoje tinha mudado. A consulta extra só acontece quando existe
    // regravação para mostrar.
    let regravacao = await resumirRegravacao(run.id).catch(() => null);
    if (regravacao) {
      const ultimaConcluida = await prisma.agentEvalRun
        .findFirst({
          where: { agentId: run.agentId, status: 'completed' },
          orderBy: { startedAt: 'desc' },
          select: { id: true },
        })
        .catch(() => null);
      if (ultimaConcluida?.id !== run.id) regravacao = null;
    }

    // ─── P56: estado em vez de número, para quem não é técnico ────
    const ruido = await carregarRuidoDoAgente(run.agentId);
    const anterior = await prisma.agentEvalRun
      .findFirst({
        where: {
          agentId: run.agentId,
          status: 'completed',
          id: { not: run.id },
          startedAt: { lt: run.startedAt },
        },
        orderBy: { startedAt: 'desc' },
        select: { scorePercent: true },
      })
      .catch(() => null);
    const estado = classificarMudanca({
      nota: run.scorePercent ?? null,
      notaAnterior: anterior?.scorePercent ?? null,
      ruido,
    });

    res.json({
      ...rest,
      results: enrichedResults,
      hasResults: results != null,
      regravacao,
      estado,
    });
  } catch (err: any) {
    logger.error('[agentQuality] /runs/:id erro:', err);
    res.status(500).json({ error: 'erro ao buscar execução', message: err?.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// FASE 2.2d (#252) — Generate suggestion on-demand (cliente)
// Mesma lógica do admin, mas com RLS por organizationId.
// ════════════════════════════════════════════════════════════════════
router.post(
  '/runs/:runId/scenarios/:scenarioId/generate-suggestion',
  requireRole('ADMIN', 'SUPERADMIN'),
  cotaDiaria('generate-suggestion'),
  async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId;
    const { runId, scenarioId } = req.params;
    try {
      const run = await loadRunScoped(runId, orgId);
      if (!run) {
        res.status(404).json({ error: 'execução não encontrada' });
        return;
      }
      const results = run.results as any[];
      if (!Array.isArray(results)) {
        res.status(400).json({ error: 'execução sem resultados' });
        return;
      }
      const idx = results.findIndex((r: any) => r.scenarioId === scenarioId);
      if (idx === -1) {
        res.status(404).json({ error: 'cenário não encontrado' });
        return;
      }
      const scenarioResult = results[idx];
      if (scenarioResult.suggestedFix) {
        res.json({ ok: true, suggestion: scenarioResult.suggestedFix, cached: true });
        return;
      }
      const profile = await resolveTenantAgentProfile(orgId, { agentId: run.agent.id });
      const scenarioDef = resolveEvalSet(profile).find((s) => s.id === scenarioId);
      if (!scenarioDef) {
        // Cenário não existe mais no gabarito deste tenant. Acontece com runs
        // antigas (v1), que traziam cenários da ZappIQ pro cliente.
        res.status(404).json({
          error: 'definição do cenário não encontrada',
          message:
            'Este cenário não faz parte do teste do seu agente. Execute um novo teste para ver os resultados atualizados.',
        });
        return;
      }
      const suggestion = await suggestFix(
        scenarioId,
        scenarioDef.expectedBehavior,
        scenarioResult.response || '',
        scenarioResult.judge?.reason || 'Cenário parcial — usuário pediu sugestão de melhoria',
        run.agent.systemPrompt || '',
        profile,
        // A043: o sugeridor vê o CORE (sempre) e as regras já aprovadas
        // deste agente, para fortalecer a existente em vez de escrever a
        // sexta versão dela.
        { regrasAtivas: await carregarRegrasAtivas({ organizationId: orgId, agentId: run.agentId }) },
      );
      if (!suggestion) {
        res.status(500).json({ error: 'IA não conseguiu gerar sugestão' });
        return;
      }
      results[idx] = { ...scenarioResult, suggestedFix: suggestion };
      await prisma.agentEvalRun.update({
        where: { id: runId },
        data: { results: results as any },
      });
      res.json({ ok: true, suggestion, cached: false });
    } catch (err: any) {
      logger.error('[agentQuality] generate-suggestion erro:', err);
      res.status(500).json({ error: 'erro ao gerar sugestão', message: err?.message });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// POST /runs/:runId/scenarios/:scenarioId/apply-fix
// ════════════════════════════════════════════════════════════════════
router.post(
  '/runs/:runId/scenarios/:scenarioId/apply-fix',
  requireRole('ADMIN', 'SUPERADMIN'),
  async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId;
    const actorUserId = req.user?.userId;
    const { runId, scenarioId } = req.params;
    const finalDiff = req.body?.finalDiff ? String(req.body.finalDiff) : undefined;
    const notes = req.body?.notes ? String(req.body.notes).slice(0, 1000) : undefined;

    try {
      const run = await loadRunScoped(runId, orgId);
      if (!run) {
        res.status(404).json({ error: 'execução não encontrada' });
        return;
      }

      const existing = await prisma.agentEvalFixDecision.findFirst({
        where: { runId, scenarioId, decision: { in: ['applied', 'rejected'] } },
        orderBy: { decidedAt: 'desc' },
      });
      if (existing && existing.decision === 'applied') {
        res.status(409).json({ error: 'sugestão já aplicada', decision: existing });
        return;
      }

      const scenarioMeta = findSuggestionInResults(run.results, scenarioId);
      if (!scenarioMeta || !scenarioMeta.suggestion) {
        res.status(400).json({ error: 'cenário sem sugestão disponível' });
        return;
      }

      const suggestion = scenarioMeta.suggestion as {
        summary: string;
        patches: Array<{ where: string; diff: string }>;
        confidence: number;
      };
      if (!suggestion.patches || suggestion.patches.length === 0) {
        res.status(400).json({ error: 'sugestão sem patches' });
        return;
      }

      const firstPatch = suggestion.patches[0];
      const diffToApply = finalDiff || firstPatch.diff;
      const whereHint = firstPatch.where || '';

      // ─── A188: REGRA CORTADA NÃO ENTRA NO PROMPT VIVO ─────────────
      // O sugeridor corta o patch em 600 caracteres sem avisar: 170 de 324
      // sugestões de clientes terminam exatamente nesse limite, muitas no meio
      // de uma palavra. Cinco desses fragmentos estão hoje no prompt da Iza e
      // da Marcia. A checagem também cobre o texto EDITADO pelo cliente, que
      // chega pelo corpo da requisição.
      if (!regraTerminaEmFraseCompleta(diffToApply)) {
        logger.warn('[agentQuality] apply-fix BLOQUEADO: regra cortada no meio', {
          orgId,
          agentId: run.agentId,
          scenarioId,
          fim: diffToApply.slice(-40),
        });
        res.status(422).json({
          error: 'regra_incompleta',
          message:
            'Esta correção está cortada no meio: o texto termina sem fechar a frase. ' +
            'Edite a sugestão até ela terminar com ponto final e aplique de novo.',
          fim: diffToApply.slice(-60),
        });
        return;
      }

      // ─── REDE FINAL DO ISOLAMENTO DE TENANT ───────────────────────
      // Este é o único ponto do produto que reescreve o systemPrompt do
      // cliente. Era por aqui que a "REGRA INVIOLÁVEL: se apresente como Iza
      // da ZappIQ" seria gravada no agente do CMJ.
      //
      // Guardamos aqui, e não só na geração, porque `finalDiff` vem do body:
      // o usuário pode editar a sugestão antes de aplicar.
      const profile = await resolveTenantAgentProfile(orgId, { agentId: run.agent.id });
      try {
        assertNoForeignBrand(`${whereHint}\n${diffToApply}`, profile, 'correção do agente');
      } catch (err) {
        if (err instanceof ForeignBrandLeakError) {
          logger.error('[agentQuality] apply-fix BLOQUEADO: vazaria marca da ZappIQ', {
            orgId,
            agentId: run.agentId,
            scenarioId,
            termos: err.leaks.map((l) => l.term),
          });
          res.status(422).json({
            error: 'patch_contaminado',
            message:
              `Esta correção faria ${profile.agentName} falar em nome de outra empresa. ` +
              `O agente representa apenas ${profile.businessName}. Edite a sugestão e tente de novo.`,
            leaks: err.leaks,
          });
          return;
        }
        throw err;
      }

      // ─── C3: VERIFICADOR DE CONFLITO (A078, A217) ─────────────────
      // Guarda de escrita, como as duas acima: roda com e sem o interruptor.
      // Em produção existem correções que mandam o OPOSTO da regra base
      // (uma da Iza sugere 20% de desconto contra o teto de 10% do CR-7) e
      // uma que proíbe a frase que o próprio gabarito exige (A217). Com as
      // duas no ar, o agente fica dividido e o erro volta: é exatamente o
      // sintoma que o dono relata.
      const regrasAtivas = await carregarRegrasAtivas({
        organizationId: orgId,
        agentId: run.agentId,
      });
      const cenarioDoGabarito = resolveEvalSet(profile).find((c) => c.id === scenarioId);
      const conflitos = detectarConflitos({
        texto: diffToApply,
        expectedBehavior: cenarioDoGabarito?.expectedBehavior ?? null,
        regrasAtivas,
        cenarioDaRegraNova: scenarioId,
      });
      if (conflitos.length > 0) {
        logger.warn('[agentQuality] apply-fix BLOQUEADO: correção conflitante', {
          orgId,
          agentId: run.agentId,
          scenarioId,
          tipos: conflitos.map((c) => c.tipo),
        });
        res.status(422).json({
          error: 'regra_conflitante',
          message: conflitos[0].explicacao,
          conflitos,
        });
        return;
      }

      const actor = await getActorSnapshot(actorUserId);

      // ─── C3: a correção como REGISTRO (A079, A081, A083) ──────────
      // Com o interruptor ligado, aplicar NÃO reescreve o system_prompt:
      // cria (ou substitui) a regra daquele cenário, e o bloco
      // "# Regras aprovadas pelo dono" é montado a cada turno. Era o acúmulo
      // que fazia o prompt da Iza crescer 65% em 30 aplicações.
      let comoRegistro = false;
      try {
        comoRegistro = await isFlagOn(orgId, 'regrasComoRegistros');
      } catch {
        comoRegistro = false;
      }

      if (comoRegistro) {
        const texto = limparTextoDaRegra(diffToApply);
        const saida = await prisma.$transaction(async (tx) => {
          const criada = await tx.agentEvalFixDecision.create({
            data: {
              runId,
              scenarioId,
              agentId: run.agentId,
              decision: 'applied',
              originalSuggestion: suggestion as any,
              finalDiff: diffToApply,
              // O prompt não muda neste caminho. Os dois lados do snapshot
              // guardam o mesmo texto de propósito: é a prova de que esta
              // decisão não mexeu no prompt, e o revert por hash continua
              // batendo caso a organização volte o interruptor.
              promptBefore: run.agent.systemPrompt || '',
              promptAfter: run.agent.systemPrompt || '',
              decidedById: actor.id,
              decidedByEmail: actor.email,
              decidedByName: actor.name,
              decidedByRole: actor.role,
              notes: notes || 'Aprovada como regra do cenário',
            },
          });

          const aplicada = await aplicarRegraDoCenario(
            {
              organizationId: orgId,
              agentId: run.agentId,
              scenarioId,
              texto,
              origem: finalDiff ? 'editada' : 'sugestao_ia',
              decisionId: criada.id,
              createdBy: actor.email,
            },
            tx as any,
          );

          return { decision: criada, aplicada };
        });

        logger.info({
          msg: 'agent_quality_fix_applied',
          runId,
          scenarioId,
          agentId: run.agentId,
          orgId,
          comoRegistro: true,
          substituiu: saida.aplicada.substituiu,
          decidedBy: actor.email,
          decisionId: saida.decision.id,
        });

        res.json({
          ok: true,
          decision: saida.decision,
          regra: saida.aplicada.regra,
          substituiu: saida.aplicada.substituiu,
          comoRegistro: true,
        });
        return;
      }

      const currentPrompt = run.agent.systemPrompt || '';
      const result = applyPatch({
        currentPrompt,
        where: whereHint,
        diff: diffToApply,
        scenarioId,
      });

      const decision = await prisma.$transaction(async (tx) => {
        // A decisão nasce primeiro para a versão do prompt já carregar o id
        // dela: no histórico dá para ir da versão à correção que a gerou.
        const criada = await tx.agentEvalFixDecision.create({
          data: {
            runId,
            scenarioId,
            agentId: run.agentId,
            decision: 'applied',
            originalSuggestion: suggestion as any,
            finalDiff: diffToApply,
            promptBefore: result.promptBefore,
            promptAfter: result.promptAfter,
            decidedById: actor.id,
            decidedByEmail: actor.email,
            decidedByName: actor.name,
            decidedByRole: actor.role,
            notes: notes || `Aplicado via ${result.strategy} na linha ${result.insertedAtLine}`,
          },
        });

        await publishPrompt(
          {
            agentId: run.agentId,
            systemPrompt: result.promptAfter,
            source: 'fix_apply',
            decisionId: criada.id,
            actor: actor.email,
          },
          tx as unknown as PromptVersionDb,
        );

        return criada;
      });

      logger.info({
        msg: 'agent_quality_fix_applied',
        runId,
        scenarioId,
        agentId: run.agentId,
        orgId,
        strategy: result.strategy,
        decidedBy: actor.email,
        decisionId: decision.id,
      });

      res.json({
        ok: true,
        decision,
        strategy: result.strategy,
        insertedAtLine: result.insertedAtLine,
      });
    } catch (err: any) {
      if (err instanceof TetoDeRegrasError) {
        logger.warn('[agentQuality] apply-fix recusado: teto de regras ativas', {
          runId, scenarioId, orgId,
        });
        res.status(422).json({ error: 'teto_de_regras', message: err.message });
        return;
      }
      if (err instanceof DuplicatePatchError) {
        logger.warn('[agentQuality] apply-fix rejeitado (DUPLICATE_PATCH)', {
          runId, scenarioId, orgId,
        });
        res.status(409).json({
          error: 'DUPLICATE_PATCH',
          message: err.message,
          existingExcerpt: err.existingExcerpt,
        });
        return;
      }
      logger.error('[agentQuality] apply-fix erro:', err);
      res.status(500).json({ error: 'erro ao aplicar sugestão', message: err?.message });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// POST /runs/:runId/scenarios/:scenarioId/re-test
// ─────────────────────────────────────────────────────────────────
// Loop curto pós-Apply: roda SÓ aquele cenário contra o systemPrompt atual
// (que já tem o fix aplicado) e devolve pass/partial/fail + diagnóstico.
// Objetivo: feedback imediato pra o usuário ver se a correção empurrou o
// score em direção a 90%+. Se não passou, ele edita e re-aplica.
// Custo: ~1 chat + 1 judge Sonnet por clique (~$0.01-0.05).
// ════════════════════════════════════════════════════════════════════
router.post(
  '/runs/:runId/scenarios/:scenarioId/re-test',
  requireRole('ADMIN', 'SUPERADMIN'),
  cotaDiaria('re-test'),
  async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId;
    const { runId, scenarioId } = req.params;
    try {
      const run = await loadRunScoped(runId, orgId);
      if (!run) {
        res.status(404).json({ error: 'execução não encontrada' });
        return;
      }
      const profile = await resolveTenantAgentProfile(orgId, { agentId: run.agent.id });
      const scenario = resolveEvalSet(profile).find((s) => s.id === scenarioId);
      if (!scenario) {
        res.status(404).json({ error: 'cenário não encontrado no set atual' });
        return;
      }
      // ─── A049: 3 amostras, gravadas ───────────────────────────────
      // Rodava UMA vez e não deixava rastro. Uma amostra a temperatura 0,3
      // não separa correção que pegou de sorte, e sem execução gravada
      // ninguém consegue dizer depois se a correção valeu. Agora são três
      // passadas do MESMO cenário contra o MESMO prompt.
      const amostras: AmostraDoReteste[] = [];
      for (let i = 1; i <= AMOSTRAS_DO_RETESTE; i++) {
        const { results } = await executeAgentEvalRun(
          [scenario],
          {
            id: run.agentId,
            name: run.agent.name,
            systemPrompt: run.agent.systemPrompt || '',
          },
          profile,
        );
        const r = results[0];
        amostras.push({
          amostra: i,
          combined: r.combined,
          resposta: String(r.response ?? ''),
          motivoDoJuiz: String(r.judge?.reason ?? ''),
        });
      }

      const resumo = consolidarReteste(amostras);

      // A decisão que motivou o re-teste, para o rastro de eficácia ficar
      // ligado à correção e não solto no tempo.
      const decisao = await prisma.agentEvalFixDecision.findFirst({
        where: { runId, scenarioId, decision: 'applied' },
        orderBy: { decidedAt: 'desc' },
        select: { id: true },
      });

      // Gravar é importante, mas não pode segurar a resposta: o re-teste já
      // rodou e o dono já pagou as três chamadas.
      let runDoReteste: string | null = null;
      try {
        const criada = await prisma.agentEvalRun.create({
          data: {
            agentId: run.agentId,
            status: 'completed',
            evalSetVersion: EVAL_SET_VERSION,
            coreRulesVersion: CORE_RULES_VERSION,
            harnessVersion: HARNESS_VERSION,
            triggeredBy: 'client_retest',
            fixDecisionId: decisao?.id ?? null,
            scenarioFilter: { scenarios: [scenarioId] } as any,
            totalScenarios: amostras.length,
            passed: resumo.aprovadas,
            partial: resumo.parciais,
            failed: resumo.reprovadas,
            erros: resumo.erros,
            results: amostras as any,
            completedAt: new Date(),
          },
          select: { id: true },
        });
        runDoReteste = criada.id;
      } catch (err: any) {
        logger.error('[agentQuality] re-teste rodou mas não gravou', {
          runId,
          scenarioId,
          orgId,
          err: err?.message,
        });
      }

      logger.info({
        msg: 'agent_quality_scenario_retested',
        runId,
        scenarioId,
        agentId: run.agentId,
        orgId,
        amostras: amostras.length,
        veredito: resumo.veredito,
        runDoReteste,
      });

      res.json({
        ok: true,
        scenarioId,
        runId: runDoReteste,
        fixDecisionId: decisao?.id ?? null,
        amostras,
        veredito: resumo.veredito,
        resumo,
        severity: scenario.severity,
        // O dono vê o que custou: são três chamadas ao modelo, não uma.
        custo: {
          chamadasDeLlm: AMOSTRAS_DO_RETESTE,
          explicacao: `Este re-teste roda o cenário ${AMOSTRAS_DO_RETESTE} vezes para não confundir sorte com correção.`,
        },
      });
    } catch (err: any) {
      logger.error('[agentQuality] re-test erro:', err);
      res.status(500).json({ error: 'erro ao re-testar', message: err?.message });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// POST /runs/:runId/scenarios/:scenarioId/reject-fix
// ════════════════════════════════════════════════════════════════════
router.post(
  '/runs/:runId/scenarios/:scenarioId/reject-fix',
  requireRole('ADMIN', 'SUPERADMIN'),
  async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId;
    const actorUserId = req.user?.userId;
    const { runId, scenarioId } = req.params;
    const reason = req.body?.reason ? String(req.body.reason).slice(0, 1000) : undefined;

    try {
      const run = await loadRunScoped(runId, orgId);
      if (!run) {
        res.status(404).json({ error: 'execução não encontrada' });
        return;
      }

      const existing = await prisma.agentEvalFixDecision.findFirst({
        where: { runId, scenarioId, decision: { in: ['applied', 'rejected'] } },
      });
      if (existing) {
        res.status(409).json({
          error: `cenário já tem decisão '${existing.decision}'`,
          decision: existing,
        });
        return;
      }

      const scenarioMeta = findSuggestionInResults(run.results, scenarioId);
      const actor = await getActorSnapshot(actorUserId);

      const decision = await prisma.agentEvalFixDecision.create({
        data: {
          runId,
          scenarioId,
          agentId: run.agentId,
          decision: 'rejected',
          originalSuggestion: (scenarioMeta?.suggestion || null) as any,
          decidedById: actor.id,
          decidedByEmail: actor.email,
          decidedByName: actor.name,
          decidedByRole: actor.role,
          notes: reason || 'Recusada sem justificativa',
        },
      });

      logger.info({
        msg: 'agent_quality_fix_rejected',
        runId,
        scenarioId,
        agentId: run.agentId,
        orgId,
        decidedBy: actor.email,
        decisionId: decision.id,
      });

      res.json({ ok: true, decision });
    } catch (err: any) {
      logger.error('[agentQuality] reject-fix erro:', err);
      res.status(500).json({ error: 'erro ao recusar sugestão', message: err?.message });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// POST /fix-decisions/:decisionId/revert — reverte aplicação
// ════════════════════════════════════════════════════════════════════
router.post('/fix-decisions/:decisionId/revert', requireRole('ADMIN', 'SUPERADMIN'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const actorUserId = req.user?.userId;
  const { decisionId } = req.params;
  const notes = req.body?.notes ? String(req.body.notes).slice(0, 1000) : undefined;

  try {
    // AgentEvalFixDecision não tem relação direta com Agent; navega via run.agent.
    const original = await prisma.agentEvalFixDecision.findFirst({
      where: { id: decisionId, run: { agent: { organizationId: orgId } } },
    });
    if (!original) {
      res.status(404).json({ error: 'decisão não encontrada' });
      return;
    }
    if (original.decision !== 'applied') {
      res.status(400).json({ error: `só é possível reverter decisões 'applied' (atual: ${original.decision})` });
      return;
    }
    if (!original.promptBefore) {
      res.status(400).json({ error: 'sem snapshot promptBefore — impossível reverter' });
      return;
    }

    const actorDaRegra = await getActorSnapshot(actorUserId);

    // ─── C3: a correção virou REGISTRO? Então desfazer é desativar UMA
    // regra, e o prompt não é tocado (A083). Sem isto, desfazer uma
    // correção de terça apagaria tudo o que entrou depois de terça.
    const regraViva = await regraDaDecisao(original.id);
    if (regraViva) {
      const revertida = await prisma.$transaction(async (tx) => {
        const criada = await tx.agentEvalFixDecision.create({
          data: {
            runId: original.runId,
            scenarioId: original.scenarioId,
            agentId: original.agentId,
            decision: 'reverted',
            originalSuggestion: original.originalSuggestion as any,
            // Prompt intocado: os dois lados guardam o texto atual.
            promptBefore: original.promptAfter,
            promptAfter: original.promptAfter,
            decidedById: actorDaRegra.id,
            decidedByEmail: actorDaRegra.email,
            decidedByName: actorDaRegra.name,
            decidedByRole: actorDaRegra.role,
            notes: notes || `Regra desfeita (cenário ${original.scenarioId})`,
            revertedFromId: original.id,
          },
        });
        const regra = await reverterRegra(
          { ruleId: regraViva.id, organizationId: orgId, actor: actorDaRegra.email },
          tx as any,
        );
        return { decision: criada, regra };
      });

      logger.info({
        msg: 'agent_quality_regra_revertida',
        decisionId: revertida.decision.id,
        ruleId: regraViva.id,
        revertedFromId: original.id,
        orgId,
        decidedBy: actorDaRegra.email,
      });

      res.json({ ok: true, decision: revertida.decision, regra: revertida.regra });
      return;
    }

    // ─── A083: reverter é cirúrgico, não é voltar no tempo ────────────
    // Antes, o revert gravava promptBefore sem olhar o que existia no
    // agente. Se o cliente tivesse editado o prompt depois (ou outra
    // correção tivesse entrado), tudo isso sumia em silêncio. Agora só
    // reverte enquanto o prompt ainda for exatamente o que esta correção
    // deixou. Mudou? O caminho é o histórico de versões.
    const agent = await loadAgentScoped(original.agentId, orgId);
    if (!agent) {
      res.status(404).json({ error: 'agente não encontrado' });
      return;
    }
    const hashDaEpoca = hashPrompt(original.promptAfter || '');
    const hashAtual = hashPrompt(agent.systemPrompt || '');
    if (hashAtual !== hashDaEpoca) {
      logger.warn('[agentQuality] revert recusado: o prompt mudou depois da correção', {
        orgId,
        agentId: original.agentId,
        decisionId: original.id,
      });
      // A frase legível vai em `error`: é o campo que o front mostra na
      // tela (apps/web/lib/api.ts). O código estável fica em `code`, para
      // o programa decidir o que fazer.
      res.status(409).json({
        error: 'O prompt mudou depois desta correção. Reverta pelo histórico de versões.',
        code: 'prompt_mudou',
      });
      return;
    }

    const actor = actorDaRegra;
    const revertDecision = await prisma.$transaction(async (tx) => {
      const criada = await tx.agentEvalFixDecision.create({
        data: {
          runId: original.runId,
          scenarioId: original.scenarioId,
          agentId: original.agentId,
          decision: 'reverted',
          originalSuggestion: original.originalSuggestion as any,
          promptBefore: original.promptAfter, // estado atual ANTES do revert
          promptAfter: original.promptBefore, // estado final APÓS revert
          decidedById: actor.id,
          decidedByEmail: actor.email,
          decidedByName: actor.name,
          decidedByRole: actor.role,
          notes: notes || `Revertida aplicação ${original.id.slice(0, 8)}…`,
          revertedFromId: original.id,
        },
      });

      // expectedHash: a mesma checagem, agora DENTRO da transação. Fecha a
      // janela entre a leitura acima e a gravação.
      await publishPrompt(
        {
          agentId: original.agentId,
          systemPrompt: original.promptBefore!,
          source: 'fix_revert',
          decisionId: criada.id,
          actor: actor.email,
          expectedHash: hashDaEpoca,
        },
        tx as unknown as PromptVersionDb,
      );

      return criada;
    });

    logger.info({
      msg: 'agent_quality_fix_reverted',
      decisionId: revertDecision.id,
      revertedFromId: original.id,
      orgId,
      decidedBy: actor.email,
    });

    res.json({ ok: true, decision: revertDecision });
  } catch (err: any) {
    if (err instanceof PromptChangedError) {
      res.status(409).json({
        error: 'O prompt mudou depois desta correção. Reverta pelo histórico de versões.',
        code: 'prompt_mudou',
      });
      return;
    }
    logger.error('[agentQuality] revert erro:', err);
    res.status(500).json({ error: 'erro ao reverter', message: err?.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// GET /agents/:agentId/rules — as regras aprovadas, por cenário
// ─────────────────────────────────────────────────────────────────
// P08: "uma lista legível das regras da sua IA, com a origem de cada uma e
// botão de desfazer". Antes o dono não tinha onde ver o que já estava valendo
// no agente dele: o texto aprovado sumia dentro de um prompt de 26 mil
// caracteres, e a tela da Qualidade só mostrava a decisão daquela execução.
// ════════════════════════════════════════════════════════════════════
router.get('/agents/:agentId/rules', async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { agentId } = req.params;
  try {
    const agent = await loadAgentScoped(agentId, orgId);
    if (!agent) {
      res.status(404).json({ error: 'agente não encontrado' });
      return;
    }

    const incluirHistorico = req.query.incluirHistorico === 'true';
    const regras = await carregarRegrasAtivas({
      organizationId: orgId,
      agentId,
      status: incluirHistorico ? ['ativa', 'substituida', 'revertida'] : 'ativa',
    });

    const ativas = regras.filter((r) => r.status === 'ativa');
    res.json({
      total: regras.length,
      teto: TETO_DE_REGRAS_ATIVAS,
      /** Quantas ainda cabem antes de o dono precisar consolidar (A081). */
      restantes: Math.max(0, TETO_DE_REGRAS_ATIVAS - ativas.length),
      regras: regras.map((r) => ({
        id: r.id,
        scenarioId: r.scenarioId,
        cenarioLegivel: r.scenarioId ?? 'Regra escrita por você',
        texto: r.texto,
        origem: r.origem,
        status: r.status,
        motivo: r.motivo,
        decisionId: r.decisionId,
        createdBy: r.createdBy ?? null,
        createdAt: r.createdAt,
      })),
    });
  } catch (err: any) {
    logger.error('[agentQuality] listar regras erro:', err);
    res.status(500).json({ error: 'erro ao listar regras', message: err?.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// POST /rules/:ruleId/revert — desfazer UMA regra
// ─────────────────────────────────────────────────────────────────
// A083. Desfazer deixa de ser "voltar o prompt inteiro para o texto de
// antes" e passa a ser desativar uma linha. As outras regras continuam
// exatamente onde estavam, e o prompt não é reescrito.
// ════════════════════════════════════════════════════════════════════
router.post(
  '/rules/:ruleId/revert',
  requireRole('ADMIN', 'SUPERADMIN'),
  async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId;
    const { ruleId } = req.params;
    try {
      const actor = await getActorSnapshot(req.user?.userId);
      const regra = await reverterRegra({ ruleId, organizationId: orgId, actor: actor.email });
      if (!regra) {
        res.status(404).json({ error: 'regra não encontrada ou já desfeita' });
        return;
      }
      res.json({ ok: true, regra });
    } catch (err: any) {
      logger.error('[agentQuality] desfazer regra erro:', err);
      res.status(500).json({ error: 'erro ao desfazer a regra', message: err?.message });
    }
  },
);

export default router;
