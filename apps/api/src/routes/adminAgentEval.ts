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
import { resolveEvalSet, EVAL_SET_VERSION } from '../agents/agentEvalSet.js';
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
// C1a (A036): contexto de produção no teste, atrás do interruptor contextoUnico.
import { criarMontadorDeContextoDoEval } from '../services/agentEvalContext.js';
import {
  enqueueEvalRun,
  enqueueRegrade,
  resolveScenariosForRun,
} from '../services/agentEvalQueue.js';
// P61 — regravar a nota sobre as respostas já gravadas, sem chamar LLM.
import {
  execucoesParaRegravar,
  contarExecucoesParaRegravar,
  resumirRegravacao,
} from '../services/evalRegradeService.js';
// P56 — piso de ruído do agente. No admin a faixa aparece com número; na tela
// do cliente, só o estado derivado dela.
import { carregarRuidoDoAgente } from '../services/evalRuidoService.js';
// FASE 2.1 (#241): Slack notify reusável entre cron e route manual.
import { notifySlackQualityIssue } from '../services/agentEvalCronService.js';
import { sendSlackAlert, buildHeaderBlock, buildSectionBlock } from '../services/slackNotifier.js';
// FASE 2.2a (#243): aplicação cirúrgica de patches no system_prompt.
// FASE 2.2c (#246): DuplicatePatchError pra rejeitar sugestão IA repetida.
// A188: a mesma régua de "a regra fecha a frase?" que a porta do cliente usa.
import {
  applyPatch,
  DuplicatePatchError,
  regraTerminaEmFraseCompleta,
} from '../services/agentPromptPatcher.js';
// FASE 2.2d (#252): on-demand suggestion pra cenários partial
import { suggestFix } from '../services/agentEvalRunner.js';
// C3 (A043): as regras aprovadas pelo dono, para o sugeridor não duplicar.
import {
  carregarRegrasAtivas,
  blocoDeRegrasDaOrganizacao,
  type RegraGravada,
} from '../services/agentRulesService.js';
// C3 (A078, A217): a mesma guarda de conflito da porta do cliente.
import { detectarConflitos } from '../agents/regrasDoAgente.js';
// A083: toda escrita no prompt declara a origem e vira versão; reverter só
// vale enquanto o prompt ainda for o que aquela correção deixou.
import {
  publishPrompt,
  hashPrompt,
  PromptChangedError,
  type PromptVersionDb,
} from '../services/promptVersionService.js';

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

// ─── Filtro de cenários: um só, em services/agentEvalQueue.ts ───────
// Era uma cópia por rota mais a leitura da execução: três lugares lendo o
// mesmo scenarioFilter. resolveScenariosForRun é a leitura única, e a base
// continua sendo o gabarito do tenant do agente testado.

// ─── executeRunLoop e computeSummary agora vêm de services/agentEvalRunner ─
//    (extraídos em FASE 2 / V5 — reusados pelo agentEvalCronService).

// ─── POST /run (sync — backwards compat) ────────────────────────────

/**
 * O bloco "# Regras aprovadas pelo dono" do agente, sem derrubar a rota.
 *
 * Rodada 3 do PR #375: as duas portas do superadmin que executam o avaliador
 * (POST /run e o re-verify do apply-fix) mediam o agente SEM as regras que o
 * dono aprovou. Fail-soft como no orquestrador: sem bloco, a execução segue.
 */
async function blocoDeRegrasFailSoft(organizationId: string, agentId: string): Promise<string> {
  try {
    return await blocoDeRegrasDaOrganizacao(organizationId, { agentId });
  } catch (err) {
    logger.warn('[agentEval] bloco de regras indisponível (segue sem ele)', {
      organizationId,
      agentId,
      err: err instanceof Error ? err.message : String(err),
    });
    return '';
  }
}

/**
 * O contexto de regras do avaliador: o bloco para o AGENTE e as regras
 * ativas para o SUGERIDOR.
 *
 * Rodada 4 do PR #375: o bloco chegava ao agente, mas o sugeridor lia
 * "Nenhuma regra aprovada ainda para este agente" e propunha de novo a
 * regra que já estava no bloco. Bloco vazio (interruptor desligado ou
 * agente sem regra): lista vazia e nenhuma consulta a mais. Fail-soft como
 * o bloco.
 */
async function contextoDeRegrasFailSoft(
  organizationId: string,
  agentId: string,
): Promise<{ regrasBlock: string; regrasAtivas: RegraGravada[] }> {
  const regrasBlock = await blocoDeRegrasFailSoft(organizationId, agentId);
  if (!regrasBlock) return { regrasBlock, regrasAtivas: [] };
  try {
    return { regrasBlock, regrasAtivas: await carregarRegrasAtivas({ organizationId, agentId }) };
  } catch (err) {
    logger.warn('[agentEval] regras do sugeridor indisponíveis (segue sem elas)', {
      organizationId,
      agentId,
      err: err instanceof Error ? err.message : String(err),
    });
    return { regrasBlock, regrasAtivas: [] };
  }
}

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
      const scenarios = resolveScenariosForRun(profile, {
        scenarioIds: Array.isArray(req.body?.scenarios) ? req.body.scenarios : undefined,
        category: req.body?.category,
        criticalOnly: req.body?.criticalOnly === true,
      });
      if (scenarios.length === 0) {
        res.status(400).json({ error: 'nenhum scenario corresponde ao filtro' });
        return;
      }

      logger.info(`[agentEval] sync run iniciado agentId=${agentId} scenarios=${scenarios.length}`);
      const { results, durationMs, summary } = await executeAgentEvalRun(scenarios, agent, profile, {
        // Rodada 3 do PR #375: mede o agente COM as regras aprovadas pelo
        // dono. Rodada 4: e o sugeridor sabe quais regras já existem.
        ...(await contextoDeRegrasFailSoft(agent.organizationId, agent.id)),
        // C1a: o contexto de produção, atrás de contextoUnico. Rodada 2 do PR
        // #377: no mesmo objeto; o montador recebe o bloco lido acima.
        montarContexto: criarMontadorDeContextoDoEval(agent, agent.organizationId),
      });

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
      const scenarios = resolveScenariosForRun(profile, { scenarioIds, category, criticalOnly });
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

      // A048: a execução deixou de rodar dentro do processo da API. Vira job
      // da fila `agent-eval` (concorrência 1, jobId = runId) e o worker roda
      // executeRunJob, o MESMO corpo do cron e da rota do cliente. Antes era
      // um setImmediate, e reinício de máquina no meio deixava a linha em
      // 'running' para sempre (duas execuções da Iza de 15/07 seguem assim).
      await enqueueEvalRun(run.id);

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
      // P61: resumo da nota recalculada desta execução, quando existir.
      const regravacao = await resumirRegravacao(run.id).catch(() => null);
      res.json({
        ...rest,
        results: enrichedResults,
        hasResults: results != null,
        regravacao,
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

      // Rodada 4 do PR #375: o re-teste do cliente é gravado como execução
      // concluída, mas as amostras dele não têm `judge`. A tela abre a última
      // concluída e o FixSuggestionCard quebrava lendo `judge.reason`.
      const where: any = { triggeredBy: { not: 'client_retest' } };
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
          erros: true,
          harnessVersion: true,
          error: true,
          agent: { select: { name: true } },
        },
      });
      // P56: quanto a nota deste agente oscila sozinha, com o prompt parado.
      // Sem isso, o painel lê 5 pontos de diferença como se fosse sinal.
      const ruido = agentId ? await carregarRuidoDoAgente(agentId) : null;
      res.json({ total: runs.length, runs, ruido });
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
        // A043: as regras já aprovadas deste agente vão junto, para o
        // sugeridor fortalecer a existente em vez de duplicá-la.
        {
          regrasAtivas: await carregarRegrasAtivas({
            organizationId: run.agent.organizationId,
            agentId: run.agentId,
          }),
        },
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

      // ─── A188: REGRA CORTADA NÃO ENTRA NO PROMPT VIVO ─────────────
      // A trava nasceu na porta do cliente, mas é por aqui que os fragmentos
      // truncados chegaram aos prompts da Iza e da Marcia: o superadmin
      // escreve no systemPrompt de qualquer cliente. O sugeridor corta o
      // patch em 600 caracteres sem avisar, muitas vezes no meio da palavra.
      // Vale também para o texto editado no admin, que chega pelo corpo.
      if (!regraTerminaEmFraseCompleta(diffToApply)) {
        logger.warn('[agentEval] apply-fix BLOQUEADO: regra cortada no meio', {
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

      // ─── C3: verificador de conflito (A078, A217) ─────────────────
      // A mesma guarda da porta do cliente. O caminho do superadmin foi por
      // onde entraram as quatro regras contraditórias da Iza sobre
      // "tecnologia proprietária", uma delas listando como Exemplo INCORRETO
      // a frase que o gabarito EXIGE.
      const cenarioParaConflito = resolveEvalSet(profile).find((c) => c.id === scenarioId);
      const conflitos = detectarConflitos({
        texto: diffToApply,
        expectedBehavior: cenarioParaConflito?.expectedBehavior ?? null,
        regrasAtivas: await carregarRegrasAtivas({
          organizationId: run.agent.organizationId,
          agentId: run.agentId,
        }),
        cenarioDaRegraNova: scenarioId,
      });
      if (conflitos.length > 0) {
        logger.warn('[agentEval] apply-fix BLOQUEADO: correção conflitante', {
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

      // ─── ATENÇÃO: esta porta IGNORA `regrasComoRegistros` de propósito ──
      //
      // A porta do cliente (agentQuality.ts) olha o interruptor da
      // organização: com ele ligado, aprovar cria um REGISTRO em agent_rules
      // e o system_prompt não é tocado. Aqui, não: o superadmin continua
      // colando o texto dentro do prompt, sempre.
      //
      // É deliberado. Esta rota é a saída de emergência da casa, e ela
      // precisa funcionar mesmo com o interruptor desligado, com a tabela
      // indisponível ou com o serviço de regras quebrado. Trocar o
      // comportamento dela pelo do cliente tiraria justamente a rota que
      // conserta o cliente quando o caminho novo falha.
      //
      // O PREÇO: numa organização COM a flag ligada, aplicar por aqui
      // DUPLICA a regra. Ela entra colada no prompt por este caminho e
      // continua sendo montada no bloco "# Regras aprovadas pelo dono" pelo
      // outro. O agente recebe a mesma ordem duas vezes, e desfazer pela
      // tela do cliente tira só a do bloco.
      //
      // REGRA DE OPERAÇÃO: com a flag ligada na organização X, não aplique
      // correção pela tela de admin daquele agente. Use a tela do cliente.
      // Se precisar mesmo usar esta porta, desligue a flag da organização
      // antes e migre as regras ativas dela depois.
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
        // A decisão nasce primeiro para a versão do prompt carregar o id dela.
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
        before: 'pass' | 'partial' | 'fail' | 'erro' | null;
        after: 'pass' | 'partial' | 'fail' | 'erro';
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
          const before: 'pass' | 'partial' | 'fail' | 'erro' | null =
            priorResult?.combined ?? null;

          // Re-run com o prompt recém-aplicado (1 LLM call)
          const agenteDoReteste = {
            id: run.agentId,
            name: run.agent.name,
            systemPrompt: result.promptAfter,
          };
          const { results: rerunResults } = await executeAgentEvalRun(
            [scenarioDef],
            agenteDoReteste,
            profile,
            {
              // Rodada 3 do PR #375: o re-verify mede o prompt novo COM as
              // regras aprovadas, como o orquestrador vai montar. Rodada 4: e o
              // sugeridor sabe quais regras já existem.
              ...(await contextoDeRegrasFailSoft(run.agent.organizationId, run.agentId)),
              // C1a: contexto de produção, atrás de contextoUnico (rodada 2
              // do PR #377: no mesmo objeto das regras).
              montarContexto: criarMontadorDeContextoDoEval(agenteDoReteste, run.agent.organizationId),
            },
          );
          // A171: 'erro' é falha técnica do re-teste. computeReverifyVerdict
          // já trata: improved só quando o resultado novo é 'pass'.
          const afterCombined = rerunResults[0]?.combined ?? 'erro';
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

      // ─── A083: só reverte enquanto o prompt for o que a correção deixou ──
      // Antes, o revert gravava promptBefore sem comparar com o prompt atual:
      // qualquer edição posterior do cliente era apagada em silêncio.
      const agent = await prisma.agent.findUnique({
        where: { id: original.agentId },
        select: { id: true, systemPrompt: true },
      });
      if (!agent) {
        res.status(404).json({ error: 'agente não encontrado' });
        return;
      }
      const hashDaEpoca = hashPrompt(original.promptAfter || '');
      const hashAtual = hashPrompt(agent.systemPrompt || '');
      if (hashAtual !== hashDaEpoca) {
        logger.warn('[agentEval] revert recusado: o prompt mudou depois da correção', {
          agentId: original.agentId,
          decisionId: original.id,
        });
        res.status(409).json({
          error: 'O prompt mudou depois desta correção. Reverta pelo histórico de versões.',
          code: 'prompt_mudou',
        });
        return;
      }

      const actor = await getActorSnapshot(actorUserId);

      const reverted = await prisma.$transaction(async (tx) => {
        const criada = await tx.agentEvalFixDecision.create({
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

        // A mesma checagem, agora dentro da transação: fecha a janela entre a
        // leitura acima e a gravação.
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
        msg: 'agent_eval_fix_reverted',
        decisionId: reverted.id,
        revertedFromId: original.id,
        agentId: original.agentId,
        decidedBy: actor.email,
      });

      res.json({ ok: true, decision: reverted });
    } catch (err: any) {
      if (err instanceof PromptChangedError) {
        res.status(409).json({
          error: 'O prompt mudou depois desta correção. Reverta pelo histórico de versões.',
          code: 'prompt_mudou',
        });
        return;
      }
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

// ════════════════════════════════════════════════════════════════════
// P61 — REGRAVAÇÃO: recalcular a nota sobre o que JÁ está gravado
// ─────────────────────────────────────────────────────────────────
// POST /api/admin/agent-eval/regrade
//   body: { organizationId?, runIds?, dryRun }
//
// É o botão "Recalcular notas (gabarito v3)" do painel. Relê os resultados v2
// já gravados com a régua nova e grava em eval_regrades. NÃO chama o agente,
// NÃO chama o juiz e NÃO escreve em agent_eval_runs: custo zero e a execução
// original fica intacta.
//
// O padrão é dryRun = true. Recalcular 3.712 cenários é barato, mas gravar
// sem ver antes não é: o fundador roda a prévia, lê o resumo e só então
// confirma com dryRun = false.
// ════════════════════════════════════════════════════════════════════
router.post(
  '/regrade',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    try {
      const organizationId = req.body?.organizationId
        ? String(req.body.organizationId)
        : undefined;
      const runIds = Array.isArray(req.body?.runIds)
        ? req.body.runIds.map(String)
        : undefined;
      // Só grava quem pedir explicitamente. Ausente ou qualquer outra coisa
      // significa prévia.
      const dryRun = req.body?.dryRun !== false;

      const elegiveis = await execucoesParaRegravar({ organizationId, runIds });
      if (elegiveis.length === 0) {
        res.status(400).json({
          error: 'nenhuma execução elegível',
          message:
            'Não há execução concluída com resultados gravados para recalcular com este filtro.',
        });
        return;
      }

      const jobId = await enqueueRegrade({ runIds: elegiveis, dryRun });

      // Revisão do PR: o clique regrava um lote (TETO_DE_REGRAVACAO) e a
      // resposta diz o que sobrou. Sem isto, quem clicava não sabia se tinha
      // recalculado tudo ou só a primeira página.
      const totalElegiveis = await contarExecucoesParaRegravar({ organizationId, runIds }).catch(
        () => elegiveis.length,
      );
      const faltam = Math.max(0, totalElegiveis - elegiveis.length);

      logger.info({
        msg: 'agent_eval_regrade_pedida',
        jobId,
        execucoes: elegiveis.length,
        faltam,
        dryRun,
        organizationId: organizationId ?? null,
        pedidaPor: req.user?.userId ?? null,
      });

      const base = dryRun
        ? 'Prévia em andamento: nada será gravado. Abra o resumo de uma execução para ver o efeito.'
        : 'Recálculo em andamento. O resumo por execução fica disponível em seguida.';

      res.status(202).json({
        jobId,
        execucoes: elegiveis.length,
        totalElegiveis,
        faltam,
        dryRun,
        runIds: elegiveis.slice(0, 50),
        message:
          faltam > 0
            ? `${base} Ficaram ${faltam} execuções de fora deste lote: clique de novo para seguir.`
            : base,
        resumoUrl: '/api/admin/agent-eval/regrade/<runId>',
      });
    } catch (err: any) {
      logger.error('[agentEval] regrade erro:', err);
      res.status(500).json({ error: 'erro ao pedir a regravação', message: err?.message });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// GET /api/admin/agent-eval/regrade/:runId — resumo de uma execução
// ─────────────────────────────────────────────────────────────────
// Nota antiga, nota regravada, quantas reprovações eram do gabarito e a
// leitura por cenário. É o número que o fundador leva para a conversa.
// ════════════════════════════════════════════════════════════════════
router.get(
  '/regrade/:runId',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    try {
      const resumo = await resumirRegravacao(String(req.params.runId));
      if (!resumo) {
        res.status(404).json({
          error: 'sem regravação para esta execução',
          message:
            'Esta execução ainda não foi recalculada com o gabarito atual. Rode o recálculo primeiro.',
        });
        return;
      }
      res.json(resumo);
    } catch (err: any) {
      logger.error('[agentEval] resumo da regravação erro:', err);
      res.status(500).json({ error: 'erro ao ler a regravação', message: err?.message });
    }
  },
);

export default router;
