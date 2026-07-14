/**
 * /api/admin/agent-eval — Eval contínuo de agentes (task #235)
 *
 * SUPERADMIN-only. Roda o gabarito do tenant (resolveEvalSet, em
 * apps/api/src/agents/agentEvalSet.ts) contra qualquer agent ativo e retorna
 * pass/fail por cenário.
 *
 * ISOLAMENTO DE TENANT (14/07/2026):
 *   O superadmin logado é da org da ZappIQ, mas testa agente de QUALQUER org.
 *   Por isso toda operação aqui resolve o perfil pela org DO AGENTE
 *   (agent.organizationId), nunca pela org do usuário logado. Resolver pela org
 *   do logado traria o gabarito da Iza de volta pra cima do agente do cliente,
 *   que é justamente o bug que o isolamento corrigiu.
 *
 * Por cenário:
 *   1. Constrói system prompt usando o mesmo path do agentOrchestrator
 *      (CORE_AGENT_RULES_V1 + agent.systemPrompt do DB) — garante que
 *      o teste reproduz o que cliente real receberia.
 *   2. Chama LLMRouter.complete() com forceProvider=anthropic-sonnet
 *      (judging consistente — Sonnet é o "ground truth" da plataforma).
 *   3. Roda check determinístico (passPatterns/failPatterns regex).
 *   4. Roda Sonnet judge: avalia se a resposta cumpre o expectedBehavior.
 *   5. Combina determinístico + judge em pass/partial/fail.
 *
 * Custo: ~50 chamadas Sonnet por run (25 scenarios × 2 calls cada).
 * Tempo: ~3-5 min por run (sequencial pra não saturar).
 *
 * Endpoints:
 *   POST /api/admin/agent-eval/run
 *     body: { agentId: string, scenarios?: string[], category?: EvalCategory, criticalOnly?: boolean }
 *     resp: { agentId, runId, total, passed, failed, partial, results: [...] }
 *
 *   GET /api/admin/agent-eval/scenarios?agentId=X (ou ?orgId=Y)
 *     resp: { version, scope, total, byCategory: {...}, scenarios: [...] }
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { CORE_RULES_VERSION } from '../agents/coreAgentRules.js';
import {
  resolveEvalSet,
  EVAL_SET_VERSION,
  type EvalScenario,
} from '../agents/agentEvalSet.js';
// Isolamento de tenant: o gabarito deixou de ser constante global e passou a
// ser resolvido pelo perfil da org do agente testado.
import {
  resolveTenantAgentProfile,
  type TenantAgentProfile,
} from '../agents/tenantAgentProfile.js';
import { assertNoForeignBrand, ForeignBrandLeakError } from '../agents/tenantIsolationGuard.js';
import { ZAPPIQ_ORG_ID } from '../config/zappiqOrg.js';
// V5/FASE 2 (#241): runner extraído pra service compartilhado (cron + route).
// Q1: computeReverifyVerdict exportado pra teste unitário puro.
import { executeAgentEvalRun, computeReverifyVerdict } from '../services/agentEvalRunner.js';
// FASE 2.1 (#241): Slack notify reusável entre cron e route manual.
import {
  notifySlackQualityIssue,
  shouldAlertQuality,
} from '../services/agentEvalCronService.js';
import { sendSlackAlert, buildHeaderBlock, buildSectionBlock } from '../services/slackNotifier.js';
// FASE 2.2a (#243): aplicação cirúrgica de patches no system_prompt.
// FASE 2.2c (#246): DuplicatePatchError pra rejeitar sugestão IA repetida.
import { applyPatch, DuplicatePatchError } from '../services/agentPromptPatcher.js';
// FASE 2.2d (#252): on-demand suggestion pra cenários partial
import { suggestFix } from '../services/agentEvalRunner.js';

const router = Router();

// ─── Routes ─────────────────────────────────────────────────────────

// Diagnóstico admin: "contra o que este agente é testado?".
// Não existe mais "a lista de cenários" no singular: o gabarito é montado por
// tenant, então listar exige saber de quem. Aceita ?agentId= (preferido, resolve
// a org pelo próprio agente) ou ?orgId=. Sem nenhum dos dois não há tenant a
// resolver, e o fallback é a org da própria ZappIQ, que enxerga o superset
// (universal + ZappIQ) e serve pra conferir o gabarito completo.
router.get(
  '/scenarios',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    try {
      const agentId = req.query.agentId ? String(req.query.agentId) : undefined;
      let orgId = req.query.orgId ? String(req.query.orgId) : undefined;

      if (agentId) {
        const agent = await prisma.agent.findUnique({
          where: { id: agentId },
          select: { organizationId: true },
        });
        if (!agent) {
          res.status(404).json({ error: `agent ${agentId} não encontrado` });
          return;
        }
        // Org DO AGENTE, nunca a do superadmin logado.
        orgId = agent.organizationId;
      }

      const profile = await resolveTenantAgentProfile(orgId || ZAPPIQ_ORG_ID, { agentId });
      const scenarios = resolveEvalSet(profile);

      const byCategory: Record<string, number> = {};
      for (const s of scenarios) {
        byCategory[s.category] = (byCategory[s.category] || 0) + 1;
      }
      res.json({
        version: EVAL_SET_VERSION,
        // Deixa explícito de quem é o gabarito devolvido: sem isso o admin lê
        // uma lista de cenários sem saber a que tenant ela pertence.
        scope: {
          organizationId: profile.organizationId,
          isZappIQ: profile.isZappIQ,
          agentName: profile.agentName,
          businessName: profile.businessName,
          resolvedFrom: agentId ? 'agentId' : orgId ? 'orgId' : 'fallback_org_zappiq',
        },
        total: scenarios.length,
        byCategory,
        scenarios: scenarios.map((s) => ({
          id: s.id,
          category: s.category,
          severity: s.severity,
          description: s.description,
        })),
      });
    } catch (err: any) {
      logger.error('[agentEval] scenarios erro:', err);
      res.status(500).json({ error: 'erro ao listar cenários', message: err?.message });
    }
  },
);

// ─── Filtro de cenários (helper compartilhado pelos 2 endpoints) ────

// A base é sempre o gabarito do tenant do agente testado. Antes era a constante
// AGENT_EVAL_SET (a prova da ZappIQ), que caía em cima de todo mundo: o filtro
// só pode recortar dentro do que se aplica àquele agente.
function filterScenarios(
  profile: TenantAgentProfile,
  opts: {
    scenarioIds?: string[];
    category?: string;
    criticalOnly?: boolean;
  },
): EvalScenario[] {
  const base = resolveEvalSet(profile);
  if (opts.scenarioIds && opts.scenarioIds.length > 0) {
    return base.filter((s) => opts.scenarioIds!.includes(s.id));
  }
  if (opts.criticalOnly) return base.filter((s) => s.severity === 'critical');
  if (opts.category) return base.filter((s) => s.category === opts.category);
  return base;
}

// ─── executeRunLoop e computeSummary agora vêm de services/agentEvalRunner ─
//    (extraídos em FASE 2 / V5 — reusados pelo agentEvalCronService).

// ─── POST /run (sync — backwards compat) ────────────────────────────

router.post(
  '/run',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    const agentId = String(req.body?.agentId || '');
    if (!agentId) {
      res.status(400).json({ error: 'agentId obrigatório' });
      return;
    }

    try {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { id: true, name: true, systemPrompt: true, organizationId: true },
      });
      if (!agent) {
        res.status(404).json({ error: `agent ${agentId} não encontrado` });
        return;
      }

      // Perfil da org DO AGENTE. O superadmin é da ZappIQ e o agente pode ser de
      // qualquer cliente: usar a org do logado reintroduziria o gabarito da Iza.
      const profile = await resolveTenantAgentProfile(agent.organizationId, { agentId });
      const scenarios = filterScenarios(profile, {
        scenarioIds: Array.isArray(req.body?.scenarios) ? req.body.scenarios : undefined,
        category: req.body?.category,
        criticalOnly: req.body?.criticalOnly === true,
      });
      if (scenarios.length === 0) {
        res.status(400).json({ error: 'nenhum scenario corresponde ao filtro' });
        return;
      }

      logger.info(`[agentEval] sync run iniciado agentId=${agentId} scenarios=${scenarios.length}`);
      const { results, durationMs, summary } = await executeAgentEvalRun(scenarios, agent, profile);

      res.json({
        version: EVAL_SET_VERSION,
        agentId,
        agentName: agent.name,
        totalMs: durationMs,
        total: results.length,
        ...summary,
        results,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error('[agentEval] erro:', err);
      res.status(500).json({ error: 'erro ao executar eval', message: err?.message });
    }
  },
);

// ─── POST /run-async (V3.2 — persistido, retorna runId pra polling) ─

router.post(
  '/run-async',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    const agentId = String(req.body?.agentId || '');
    if (!agentId) {
      res.status(400).json({ error: 'agentId obrigatório' });
      return;
    }

    try {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { id: true, name: true, systemPrompt: true, organizationId: true },
      });
      if (!agent) {
        res.status(404).json({ error: `agent ${agentId} não encontrado` });
        return;
      }

      const scenarioIds = Array.isArray(req.body?.scenarios) ? req.body.scenarios : undefined;
      const category = req.body?.category;
      const criticalOnly = req.body?.criticalOnly === true;
      const triggeredBy = String(req.body?.triggeredBy || 'manual'); // 'manual' | 'cron' | 'pre_release'

      // Perfil da org DO AGENTE, não a do superadmin logado (ver cabeçalho).
      const profile = await resolveTenantAgentProfile(agent.organizationId, { agentId });
      const scenarios = filterScenarios(profile, { scenarioIds, category, criticalOnly });
      if (scenarios.length === 0) {
        res.status(400).json({ error: 'nenhum scenario corresponde ao filtro' });
        return;
      }

      // Cria row pending em DB
      const run = await prisma.agentEvalRun.create({
        data: {
          agentId,
          status: 'pending',
          evalSetVersion: EVAL_SET_VERSION,
          coreRulesVersion: CORE_RULES_VERSION,
          triggeredBy,
          scenarioFilter: { scenarioIds, category, criticalOnly } as any,
          totalScenarios: scenarios.length,
        },
        select: { id: true, startedAt: true },
      });

      // Dispara execução em background (setImmediate libera response imediato)
      setImmediate(async () => {
        try {
          await prisma.agentEvalRun.update({
            where: { id: run.id },
            data: { status: 'running' },
          });
          logger.info(`[agentEval] async run iniciado runId=${run.id} agentId=${agentId} scenarios=${scenarios.length}`);

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
          logger.info(`[agentEval] async run completed runId=${run.id} score=${summary.scorePercent}%`);

          // FASE 2.2a (#243): instrumentação Slack — persiste status no DB
          // pra diagnosticar falhas silenciosas que antes só ficavam nos
          // Fly logs (que somem com restart).
          if (!shouldAlertQuality(summary)) {
            await prisma.agentEvalRun.update({
              where: { id: run.id },
              data: { slackAlertStatus: 'skipped' }, // score >= 90, sem critical
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
                  slackAlertError: sent
                    ? null
                    : 'sendSlackAlert retornou false (webhook não configurado, 4xx/5xx, ou timeout)',
                  slackAlertSentAt: sent ? new Date() : null,
                },
              }).catch(() => {});

              logger.info(
                `[agentEval] Slack alert ${sent ? 'enviado' : 'falhou silenciosamente'} runId=${run.id}`,
              );
            } catch (slackErr: any) {
              await prisma.agentEvalRun.update({
                where: { id: run.id },
                data: {
                  slackAlertStatus: 'failed',
                  slackAlertError: String(slackErr?.message || slackErr).slice(0, 1000),
                },
              }).catch(() => {});
              logger.warn(`[agentEval] Slack alert exceção (não bloqueia run)`, {
                err: slackErr?.message,
                runId: run.id,
              });
            }
          }
        } catch (err: any) {
          logger.error(`[agentEval] async run failed runId=${run.id}`, { err: err?.message });
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
        evalSetVersion: EVAL_SET_VERSION,
        coreRulesVersion: CORE_RULES_VERSION,
        startedAt: run.startedAt,
        pollUrl: `/api/admin/agent-eval/runs/${run.id}`,
      });
    } catch (err: any) {
      logger.error('[agentEval] run-async erro:', err);
      res.status(500).json({ error: 'erro ao criar run', message: err?.message });
    }
  },
);

// ─── GET /runs/:id (polling de status) ──────────────────────────────

router.get(
  '/runs/:id',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    try {
      const includeResults = req.query.includeResults === 'true';
      const run = await prisma.agentEvalRun.findUnique({
        where: { id: req.params.id },
        include: {
          agent: { select: { id: true, name: true, organizationId: true } },
          // FASE 2.2a (#243): inclui decisões aplicadas/recusadas pra UI
          // mostrar status correto (sem oferecer botão de aplicar 2x).
          fixDecisions: {
            orderBy: { decidedAt: 'desc' },
          },
        },
      });
      if (!run) {
        res.status(404).json({ error: 'run não encontrada' });
        return;
      }
      // Omite results por padrão (pode ser MB) — frontend pede explicitamente
      const { results, ...rest } = run as any;
      // FASE 2.2c follow-up: runs antigas (pré-deploy 2026-05-14 13:51) não têm
      // `userMessage` no JSONB. Faz lookup no gabarito pra que a UI mostre a
      // interação testada completa mesmo em runs históricas. V2: o gabarito vem
      // do tenant do agente da run, não de uma constante global.
      const profileRun = await resolveTenantAgentProfile(run.agent.organizationId, {
        agentId: run.agent.id,
      });
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
      logger.error('[agentEval] runs/:id erro:', err);
      res.status(500).json({ error: 'erro ao buscar run', message: err?.message });
    }
  },
);

// ─── GET /runs (histórico por agent) ────────────────────────────────

router.get(
  '/runs',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    try {
      const agentId = req.query.agentId ? String(req.query.agentId) : undefined;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const status = req.query.status ? String(req.query.status) : undefined;

      const where: any = {};
      if (agentId) where.agentId = agentId;
      if (status) where.status = status;

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
          error: true,
          agent: { select: { name: true } },
        },
      });
      res.json({ total: runs.length, runs });
    } catch (err: any) {
      logger.error('[agentEval] runs (list) erro:', err);
      res.status(500).json({ error: 'erro ao listar runs', message: err?.message });
    }
  },
);

// ─── POST /test-slack (FASE 2.1 — diagnóstico de webhook) ──────
// Dispara uma mensagem fake de quality alert pra validar se o webhook
// Slack está configurado e funcionando. Retorna sucesso/falha + qual
// env var foi usada. Sem efeito persistente (não cria run no DB).
router.post(
  '/test-slack',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (_req: Request, res: Response) => {
    const webhookDedicated = process.env.SLACK_WEBHOOK_AGENT_QUALITY;
    const webhookFallback = process.env.SLACK_WEBHOOK_QUOTA_ALERTS;
    const webhook = webhookDedicated || webhookFallback;
    const which = webhookDedicated
      ? 'SLACK_WEBHOOK_AGENT_QUALITY (dedicado)'
      : webhookFallback
        ? 'SLACK_WEBHOOK_QUOTA_ALERTS (fallback)'
        : null;

    if (!webhook) {
      res.status(400).json({
        ok: false,
        configured: false,
        message:
          'Nenhum webhook Slack configurado. Configure SLACK_WEBHOOK_AGENT_QUALITY (preferido) ou SLACK_WEBHOOK_QUOTA_ALERTS (fallback) via flyctl secrets set --app zappiq-api',
      });
      return;
    }

    try {
      const ok = await sendSlackAlert({
        webhook,
        text: '🧪 Teste de webhook · Qualidade do Agente ZappIQ',
        blocks: [
          buildHeaderBlock('🧪 Teste de webhook — Qualidade do Agente'),
          buildSectionBlock(
            `*Webhook usado:* \`${which}\`\n*Disparado por:* SUPERADMIN via /admin/agent-quality\n\nSe você está vendo esta mensagem, o alerta automático funciona. Próxima execução abaixo de 90% vai notificar aqui.`,
          ),
        ],
        username: 'ZappIQ QA Bot',
        iconEmoji: ':test_tube:',
      });
      res.json({
        ok,
        configured: true,
        webhookUsed: which,
        message: ok
          ? 'Mensagem enviada. Verifique o canal configurado no webhook.'
          : 'Webhook configurado mas envio falhou. Cheque URL/token.',
      });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        configured: true,
        webhookUsed: which,
        message: err?.message || 'erro inesperado',
      });
    }
  },
);

// ─── POST /test-real-alert (FASE 2.2c #246 — diagnose Slack regression) ──
// /test-slack chega no canal; notifySlackQualityIssue não. Esse endpoint
// chama a FUNÇÃO REAL com dados fake — se chegar, payload simplificado
// resolveu. Se não, é canal/permissão e precisa nova investigação.
router.post(
  '/test-real-alert',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (_req: Request, res: Response) => {
    try {
      const sent = await notifySlackQualityIssue({
        agentId: 'test-agent-id',
        agentName: 'Iza (teste)',
        organizationName: 'ZappIQ Diagnose',
        runId: `test-${Date.now()}`,
        scorePercent: 72,
        passed: 18,
        partial: 4,
        failed: 3,
        criticalFailed: 1,
        totalScenarios: 25,
        durationMs: 180_000,
        topFails: [
          { scenarioId: 'cr5_nome_disponivel_usar', category: 'core_rules', severity: 'high' },
          { scenarioId: 'zappiq_trial_lead_morno', category: 'sales', severity: 'critical' },
          { scenarioId: 'handoff_objection', category: 'handoff', severity: 'high' },
        ],
      });
      res.json({
        ok: sent,
        message: sent
          ? 'Mensagem enviada via notifyQualityIssue. Confira o canal Slack.'
          : 'sendSlackAlert retornou false — webhook não configurado ou retornou 4xx/5xx.',
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err?.message || 'erro inesperado' });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// FASE 2.2d (#252) — Generate suggestion on-demand (cenários partial)
// ════════════════════════════════════════════════════════════════════
// Sugestões automáticas só são geradas em cenários `fail` no runner (custo
// controlado). Pra `partial` o user pode pedir manualmente — custo ~$0.05
// por sugestão. Persiste no results JSONB da run pra cache (não regera
// se já tem).
router.post(
  '/runs/:runId/scenarios/:scenarioId/generate-suggestion',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    const { runId, scenarioId } = req.params;
    try {
      const run = await prisma.agentEvalRun.findUnique({
        where: { id: runId },
        // organizationId é obrigatório aqui: é dele que sai o perfil do tenant.
        include: {
          agent: { select: { id: true, name: true, systemPrompt: true, organizationId: true } },
        },
      });
      if (!run) {
        res.status(404).json({ error: 'run não encontrada' });
        return;
      }
      const results = run.results as any[];
      if (!Array.isArray(results)) {
        res.status(400).json({ error: 'run sem results' });
        return;
      }
      const idx = results.findIndex((r: any) => r.scenarioId === scenarioId);
      if (idx === -1) {
        res.status(404).json({ error: 'scenario não encontrado na run' });
        return;
      }
      const scenarioResult = results[idx];
      // Cache: já tem sugestão? Retorna direto, sem regerar.
      if (scenarioResult.suggestedFix) {
        res.json({ ok: true, suggestion: scenarioResult.suggestedFix, cached: true });
        return;
      }
      // Carrega expectedBehavior do gabarito DO TENANT do agente desta run.
      // O mesmo perfil vai pro suggestFix: a sugestão tem que ser escrita pra
      // agente e empresa do cliente, não pra Iza da ZappIQ.
      const profile = await resolveTenantAgentProfile(run.agent.organizationId, {
        agentId: run.agent.id,
      });
      const scenarioDef = resolveEvalSet(profile).find((s) => s.id === scenarioId);
      if (!scenarioDef) {
        // Cenário fora do gabarito deste tenant. Acontece em runs antigas (v1),
        // que aplicavam a prova da ZappIQ no agente do cliente.
        res.status(404).json({ error: 'scenario não encontrado no eval set deste tenant' });
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
      // Persiste no JSONB results pra cache (próxima chamada não regera)
      results[idx] = { ...scenarioResult, suggestedFix: suggestion };
      await prisma.agentEvalRun.update({
        where: { id: runId },
        data: { results: results as any },
      });
      res.json({ ok: true, suggestion, cached: false });
    } catch (err: any) {
      logger.error('[agentEval] generate-suggestion erro:', err);
      res.status(500).json({ error: 'erro ao gerar sugestão', message: err?.message });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// FASE 2.2a (#243) — Apply / Reject / Revert sugestões IA
// ════════════════════════════════════════════════════════════════════

/**
 * Helper: extrai metadados do user autenticado pra snapshot em audit log.
 * Garante que histórico fica completo mesmo se user for deletado depois.
 */
async function getActorSnapshot(userId: string | undefined) {
  // FASE 2.2b fix: JwtPayload define `userId` (não `id`). Callers passam
  // `req.user?.userId`. Aceitamos null/undefined defensivo.
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

/**
 * Helper: encontra o suggestedFix de um cenário específico nos results
 * persistidos de uma run.
 */
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

/**
 * POST /api/admin/agent-eval/runs/:runId/scenarios/:scenarioId/apply-fix
 *
 * Aplica sugestão IA no system_prompt do agent associado à run.
 * Body opcional:
 *   - finalDiff: texto editado pelo user (sobrescreve diff original da sugestão)
 *   - notes: nota livre
 *
 * Cria audit row em agent_eval_fix_decisions com:
 *   - promptBefore (snapshot pra rollback)
 *   - promptAfter (snapshot novo)
 *   - decidedBy (snapshot do user pra histórico)
 */
router.post(
  '/runs/:runId/scenarios/:scenarioId/apply-fix',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    const { runId, scenarioId } = req.params;
    const finalDiff = req.body?.finalDiff ? String(req.body.finalDiff) : undefined;
    const notes = req.body?.notes ? String(req.body.notes).slice(0, 1000) : undefined;
    const actorUserId = (req as any).user?.userId as string | undefined;

    try {
      // Carrega run + agent (organizationId é o que resolve o perfil do tenant)
      const run = await prisma.agentEvalRun.findUnique({
        where: { id: runId },
        include: {
          agent: { select: { id: true, name: true, systemPrompt: true, organizationId: true } },
        },
      });
      if (!run) {
        res.status(404).json({ error: 'run não encontrada' });
        return;
      }

      // Já existe decisão ativa pra esse (runId, scenarioId)?
      const existing = await prisma.agentEvalFixDecision.findFirst({
        where: { runId, scenarioId, decision: { in: ['applied', 'rejected'] } },
        orderBy: { decidedAt: 'desc' },
      });
      if (existing && existing.decision === 'applied') {
        res.status(409).json({
          error: 'sugestão já aplicada',
          decision: existing,
        });
        return;
      }

      // Localiza suggestion nos results da run
      const scenarioMeta = findSuggestionInResults(run.results, scenarioId);
      if (!scenarioMeta || !scenarioMeta.suggestion) {
        res.status(400).json({ error: 'cenário sem sugestão IA disponível' });
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

      // Usa finalDiff se user editou, senão primeiro patch
      const firstPatch = suggestion.patches[0];
      const diffToApply = finalDiff || firstPatch.diff;
      const whereHint = firstPatch.where || '';

      // ─── REDE FINAL DO ISOLAMENTO DE TENANT ───────────────────────
      // Mesma trava do agentQuality.ts, e aqui ela pesa mais: o superadmin é da
      // ZappIQ e edita o agente de qualquer cliente. Era por este caminho que a
      // "REGRA INVIOLÁVEL: se apresente como Iza da ZappIQ" seria gravada no
      // systemPrompt do CMJ.
      //
      // Guardamos no apply, e não só na geração, porque `finalDiff` vem do body:
      // o admin pode editar a sugestão antes de aplicar.
      const profile = await resolveTenantAgentProfile(run.agent.organizationId, {
        agentId: run.agent.id,
      });
      try {
        assertNoForeignBrand(`${whereHint}\n${diffToApply}`, profile, 'correção do agente');
      } catch (err) {
        if (err instanceof ForeignBrandLeakError) {
          logger.error('[agentEval] apply-fix BLOQUEADO: vazaria marca da ZappIQ', {
            orgId: profile.organizationId,
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

      // Aplica patch no system_prompt
      const currentPrompt = run.agent.systemPrompt || '';
      const result = applyPatch({
        currentPrompt,
        where: whereHint,
        diff: diffToApply,
        scenarioId,
      });

      // Update agent + cria audit row em uma transaction
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
        msg: 'agent_eval_fix_applied',
        runId,
        scenarioId,
        agentId: run.agentId,
        strategy: result.strategy,
        insertedAtLine: result.insertedAtLine,
        promptLengthBefore: result.promptBefore.length,
        promptLengthAfter: result.promptAfter.length,
        decidedBy: actor.email,
        decisionId: decision.id,
      });

      // ── Q1: re-verifica o cenário com o prompt recém-aplicado ──────────────
      // Fail-soft: erro no re-verify NÃO falha o apply (fix já persistido).
      let reverify: {
        scenarioId: string;
        before: 'pass' | 'partial' | 'fail' | null;
        after: 'pass' | 'partial' | 'fail';
        improved: boolean;
      } | { error: true } | null = null;

      // Encontra o cenário no gabarito do tenant (profile já resolvido acima)
      const scenarioDef = resolveEvalSet(profile).find((s) => s.id === scenarioId);
      if (scenarioDef) {
        try {
          // Extrai o combined anterior da run (results JSONB)
          const priorResult = Array.isArray(run.results)
            ? (run.results as any[]).find((r: any) => r.scenarioId === scenarioId)
            : null;
          const before: 'pass' | 'partial' | 'fail' | null =
            priorResult?.combined ?? null;

          // Re-run com o prompt recém-aplicado (1 LLM call)
          const { results: rerunResults } = await executeAgentEvalRun(
            [scenarioDef],
            {
              id: run.agentId,
              name: run.agent.name,
              systemPrompt: result.promptAfter,
            },
            profile,
          );
          const afterCombined = rerunResults[0]?.combined ?? 'fail';
          const verdict = computeReverifyVerdict(before, afterCombined);

          reverify = { scenarioId, ...verdict };

          logger.info('[AgentEval] re-verify pós-fix', {
            agentId: run.agentId,
            scenarioId,
            before: verdict.before,
            after: verdict.after,
            improved: verdict.improved,
          });
        } catch (reverifyErr: any) {
          logger.warn('[AgentEval] re-verify falhou (não afeta o apply)', {
            runId,
            scenarioId,
            err: reverifyErr?.message,
          });
          reverify = { error: true };
        }
      }
      // ── fim re-verify ───────────────────────────────────────────────────────

      res.json({
        ok: true,
        decision,
        strategy: result.strategy,
        insertedAtLine: result.insertedAtLine,
        promptLengthBefore: result.promptBefore.length,
        promptLengthAfter: result.promptAfter.length,
        reverify,
      });
    } catch (err: any) {
      // FASE 2.2c (#246): dedup — patch duplicado vira 409 com mensagem clara
      if (err instanceof DuplicatePatchError) {
        logger.warn('[agentEval] apply-fix rejeitado (DUPLICATE_PATCH)', {
          runId, scenarioId, excerpt: err.existingExcerpt.slice(0, 100),
        });
        res.status(409).json({
          error: 'DUPLICATE_PATCH',
          message: err.message,
          existingExcerpt: err.existingExcerpt,
        });
        return;
      }
      logger.error('[agentEval] apply-fix erro:', err);
      res.status(500).json({ error: 'erro ao aplicar sugestão', message: err?.message });
    }
  },
);

/**
 * POST /api/admin/agent-eval/runs/:runId/scenarios/:scenarioId/reject-fix
 *
 * Marca uma sugestão como recusada. Audit row criada com snapshot do user
 * + razão opcional. UI não oferece mais botão de aplicar pra essa run/cenário.
 */
router.post(
  '/runs/:runId/scenarios/:scenarioId/reject-fix',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    const { runId, scenarioId } = req.params;
    const reason = req.body?.reason ? String(req.body.reason).slice(0, 1000) : undefined;
    const actorUserId = (req as any).user?.userId as string | undefined;

    try {
      const run = await prisma.agentEvalRun.findUnique({
        where: { id: runId },
        select: { id: true, agentId: true, results: true },
      });
      if (!run) {
        res.status(404).json({ error: 'run não encontrada' });
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
        msg: 'agent_eval_fix_rejected',
        runId,
        scenarioId,
        agentId: run.agentId,
        decidedBy: actor.email,
        decisionId: decision.id,
      });

      res.json({ ok: true, decision });
    } catch (err: any) {
      logger.error('[agentEval] reject-fix erro:', err);
      res.status(500).json({ error: 'erro ao recusar sugestão', message: err?.message });
    }
  },
);

/**
 * POST /api/admin/agent-eval/fix-decisions/:decisionId/revert
 *
 * Reverte uma aplicação anterior. Restaura promptBefore da decisão
 * original no agent + cria nova audit row com decision='reverted'.
 */
router.post(
  '/fix-decisions/:decisionId/revert',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    const { decisionId } = req.params;
    const reason = req.body?.reason ? String(req.body.reason).slice(0, 1000) : undefined;
    const actorUserId = (req as any).user?.userId as string | undefined;

    try {
      const original = await prisma.agentEvalFixDecision.findUnique({
        where: { id: decisionId },
      });
      if (!original) {
        res.status(404).json({ error: 'decisão não encontrada' });
        return;
      }
      if (original.decision !== 'applied') {
        res.status(400).json({ error: 'só é possível reverter decisões aplicadas' });
        return;
      }
      if (!original.promptBefore) {
        res.status(400).json({ error: 'snapshot do prompt antes não disponível pra reverter' });
        return;
      }

      const actor = await getActorSnapshot(actorUserId);

      const reverted = await prisma.$transaction(async (tx) => {
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
            // Restaura: promptBefore da revert = promptAfter da aplicação original
            promptBefore: original.promptAfter,
            promptAfter: original.promptBefore,
            decidedById: actor.id,
            decidedByEmail: actor.email,
            decidedByName: actor.name,
            decidedByRole: actor.role,
            revertedFromId: original.id,
            notes: reason || 'Reversão sem justificativa',
          },
        });
      });

      logger.info({
        msg: 'agent_eval_fix_reverted',
        decisionId: reverted.id,
        revertedFromId: original.id,
        agentId: original.agentId,
        decidedBy: actor.email,
      });

      res.json({ ok: true, decision: reverted });
    } catch (err: any) {
      logger.error('[agentEval] revert erro:', err);
      res.status(500).json({ error: 'erro ao reverter', message: err?.message });
    }
  },
);

/**
 * GET /api/admin/agent-eval/fix-decisions
 *
 * Audit log paginado (cross-tenant, SUPERADMIN). Útil pra dashboard de
 * auditoria geral mostrando quem aplicou/recusou o que ao longo do tempo.
 */
router.get(
  '/fix-decisions',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const agentId = req.query.agentId ? String(req.query.agentId) : undefined;
      const decision = req.query.decision ? String(req.query.decision) : undefined;

      const where: any = {};
      if (agentId) where.agentId = agentId;
      if (decision) where.decision = decision;

      const decisions = await prisma.agentEvalFixDecision.findMany({
        where,
        orderBy: { decidedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          runId: true,
          scenarioId: true,
          agentId: true,
          decision: true,
          decidedByEmail: true,
          decidedByName: true,
          decidedByRole: true,
          decidedAt: true,
          notes: true,
          revertedFromId: true,
          // não retorna promptBefore/After (pode ser MB) — só /:id pra detalhe
        },
      });
      res.json({ total: decisions.length, decisions });
    } catch (err: any) {
      logger.error('[agentEval] fix-decisions list erro:', err);
      res.status(500).json({ error: 'erro ao listar decisões', message: err?.message });
    }
  },
);

export default router;
