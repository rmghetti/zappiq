/**
 * /api/agent-quality — versão CLIENTE da Qualidade do Agente (task #244 / FASE 2.2b)
 *
 * Mesma lógica do admin (adminAgentEval.ts) MAS:
 *   • Sem requireRole('SUPERADMIN') — qualquer usuário autenticado acessa.
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
import { authMiddleware } from '../middleware/auth.js';
import { CORE_RULES_VERSION } from '../agents/coreAgentRules.js';
import {
  resolveEvalSet,
  getSkippedScenarios,
  EVAL_SET_VERSION,
  type EvalScenario,
} from '../agents/agentEvalSet.js';
import {
  resolveTenantAgentProfile,
  type TenantAgentProfile,
} from '../agents/tenantAgentProfile.js';
import { assertNoForeignBrand, ForeignBrandLeakError } from '../agents/tenantIsolationGuard.js';
import { executeAgentEvalRun } from '../services/agentEvalRunner.js';
import {
  notifySlackQualityIssue,
  shouldAlertQuality,
} from '../services/agentEvalCronService.js';
import { applyPatch, DuplicatePatchError } from '../services/agentPromptPatcher.js';
// FASE 2.2d (#252): on-demand suggestion pra cenários partial.
// AGENT_EVAL_SET já importado mais acima (FASE 2.2b) — só adicionamos suggestFix.
import { suggestFix } from '../services/agentEvalRunner.js';

const router = Router();
router.use(authMiddleware as any);

// ─── Cooldown: cliente roda no máximo 1 eval / 24h por agent ────────
const RUN_COOLDOWN_HOURS = 24;

// ─── Filtro de cenários, sempre a partir do gabarito DO TENANT ──────
// Antes, a base era a constante AGENT_EVAL_SET (a prova da ZappIQ). Agora o
// ponto de partida é sempre resolveEvalSet(profile): o cliente só pode ser
// filtrado dentro do que se aplica a ele.
function filterScenarios(
  profile: TenantAgentProfile,
  opts: { scenarioIds?: string[]; category?: string; criticalOnly?: boolean },
): EvalScenario[] {
  const base = resolveEvalSet(profile);
  if (opts.scenarioIds && opts.scenarioIds.length > 0) {
    return base.filter((s) => opts.scenarioIds!.includes(s.id));
  }
  if (opts.criticalOnly) return base.filter((s) => s.severity === 'critical');
  if (opts.category) return base.filter((s) => s.category === opts.category);
  return base;
}

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
// POST /run-async — dispara eval (cooldown 24h por agent)
// ════════════════════════════════════════════════════════════════════
router.post('/run-async', async (req: Request, res: Response) => {
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

    // Cooldown: bloqueia se já rodou nas últimas 24h
    const cutoff = new Date(Date.now() - RUN_COOLDOWN_HOURS * 3600 * 1000);
    const recent = await prisma.agentEvalRun.findFirst({
      where: {
        agentId,
        triggeredBy: { in: ['manual', 'client_manual'] },
        startedAt: { gte: cutoff },
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true, startedAt: true, status: true },
    });
    if (recent && recent.status !== 'failed') {
      const nextAvailable = new Date(recent.startedAt.getTime() + RUN_COOLDOWN_HOURS * 3600 * 1000);
      res.status(429).json({
        error: 'cooldown',
        message: `Você já executou um teste nas últimas ${RUN_COOLDOWN_HOURS}h. Próximo disponível em ${nextAvailable.toLocaleString('pt-BR')}.`,
        nextAvailableAt: nextAvailable.toISOString(),
        lastRunId: recent.id,
      });
      return;
    }

    const scenarioIds = Array.isArray(req.body?.scenarios) ? req.body.scenarios : undefined;
    const category = req.body?.category;
    const criticalOnly = req.body?.criticalOnly === true;

    const profile = await resolveTenantAgentProfile(orgId, { agentId });
    const scenarios = filterScenarios(profile, { scenarioIds, category, criticalOnly });
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

    setImmediate(async () => {
      try {
        await prisma.agentEvalRun.update({
          where: { id: run.id },
          data: { status: 'running' },
        });
        logger.info(
          `[agentQuality] client run iniciado runId=${run.id} agentId=${agentId} orgId=${orgId} scenarios=${scenarios.length}`,
        );

        const { results, durationMs, summary } = await executeAgentEvalRun(scenarios, agent, profile);

        await prisma.agentEvalRun.update({
          where: { id: run.id },
          data: {
            status: 'completed',
            ...summary,
            results: results as any,
            completedAt: new Date(),
            durationMs,
          },
        });

        // Slack alert (mesma lógica do admin — score < 90 ou critical fail)
        if (!shouldAlertQuality(summary)) {
          await prisma.agentEvalRun.update({
            where: { id: run.id },
            data: { slackAlertStatus: 'skipped' },
          }).catch(() => {});
        } else {
          try {
            const topFails = (results as any[])
              .filter((r) => r.combined === 'fail')
              .map((r) => ({
                scenarioId: r.scenarioId,
                category: r.category,
                severity: r.severity,
              }));

            const orgInfo = await prisma.agent.findUnique({
              where: { id: agentId },
              select: { organization: { select: { name: true } } },
            });

            const sent = await notifySlackQualityIssue({
              agentId,
              agentName: agent.name,
              organizationName: orgInfo?.organization?.name || '—',
              runId: run.id,
              scorePercent: summary.scorePercent,
              passed: summary.passed,
              partial: summary.partial,
              failed: summary.failed,
              criticalFailed: summary.criticalFailed,
              totalScenarios: scenarios.length,
              durationMs,
              topFails,
            });

            await prisma.agentEvalRun.update({
              where: { id: run.id },
              data: {
                slackAlertStatus: sent ? 'sent' : 'failed',
                slackAlertError: sent ? null : 'sendSlackAlert retornou false',
                slackAlertSentAt: sent ? new Date() : null,
              },
            }).catch(() => {});
          } catch (slackErr: any) {
            await prisma.agentEvalRun.update({
              where: { id: run.id },
              data: {
                slackAlertStatus: 'failed',
                slackAlertError: String(slackErr?.message || slackErr).slice(0, 1000),
              },
            }).catch(() => {});
          }
        }
      } catch (err: any) {
        logger.error(`[agentQuality] client run failed runId=${run.id}`, { err: err?.message });
        await prisma.agentEvalRun.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            error: String(err?.message || 'unknown'),
            completedAt: new Date(),
          },
        }).catch(() => {});
      }
    });

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
    res.json({ total: runs.length, runs });
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
      where: { id: req.params.id, agent: { organizationId: orgId } },
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
    res.json({
      ...rest,
      results: enrichedResults,
      hasResults: results != null,
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

      const currentPrompt = run.agent.systemPrompt || '';
      const result = applyPatch({
        currentPrompt,
        where: whereHint,
        diff: diffToApply,
        scenarioId,
      });

      const actor = await getActorSnapshot(actorUserId);
      const decision = await prisma.$transaction(async (tx) => {
        await tx.agent.update({
          where: { id: run.agentId },
          data: { systemPrompt: result.promptAfter },
        });
        return tx.agentEvalFixDecision.create({
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
      const { results } = await executeAgentEvalRun(
        [scenario],
        {
          id: run.agentId,
          name: run.agent.name,
          systemPrompt: run.agent.systemPrompt || '',
        },
        profile,
      );
      const result = results[0];
      logger.info({
        msg: 'agent_quality_scenario_retested',
        runId,
        scenarioId,
        agentId: run.agentId,
        orgId,
        combined: result.combined,
      });
      res.json({
        ok: true,
        scenarioId,
        combined: result.combined,
        judge: result.judge,
        severity: result.severity,
        response: result.response,
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
router.post('/fix-decisions/:decisionId/revert', async (req: Request, res: Response) => {
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

    const actor = await getActorSnapshot(actorUserId);
    const revertDecision = await prisma.$transaction(async (tx) => {
      await tx.agent.update({
        where: { id: original.agentId },
        data: { systemPrompt: original.promptBefore! },
      });
      return tx.agentEvalFixDecision.create({
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
    logger.error('[agentQuality] revert erro:', err);
    res.status(500).json({ error: 'erro ao reverter', message: err?.message });
  }
});

export default router;
