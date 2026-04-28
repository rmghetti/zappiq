/* ══════════════════════════════════════════════════════════════════════
 * V2-025 · /api/admin/llm-status (Sprint 0 Observability DAY 1)
 * --------------------------------------------------------------------
 * Endpoint admin para healthcheck dos providers LLM (LLMRouter cascade)
 * + métricas agregadas das últimas 24h (cost-per-tenant, fallback rate).
 *
 * Auth: header X-Admin-Secret == env.META_APP_SECRET (mesmo padrão de
 * adminWhatsapp.ts — reusa o secret existente, sem secret novo no Fly).
 *
 * Uso operacional:
 *   curl -H "X-Admin-Secret: $META_APP_SECRET" \
 *        https://zappiq-api.fly.dev/api/admin/llm-status
 *
 * Resposta:
 *   {
 *     providers: [
 *       { id: "anthropic-sonnet", model: "claude-sonnet-4-6", breakerOpen: false, failures: 0 },
 *       ...
 *     ],
 *     last24h: {
 *       totalCalls: 1234,
 *       totalCostUsd: "5.23",
 *       avgLatencyMs: 1842,
 *       fallbackRate: 0.012,    // 1.2%
 *       byProvider: { "anthropic-sonnet": 1200, "anthropic-haiku": 30, "openai-mini": 4 }
 *     }
 *   }
 *
 * Útil em incidente: confirmar se cascade está saudável + ver tráfego real.
 * ══════════════════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { llmRouter } from '../services/llm/LLMRouter.js';
import { prisma } from '@zappiq/database';

const router = Router();

function requireAdminAuth(req: Request, res: Response): boolean {
  const provided = req.header('x-admin-secret');
  const expected = env.META_APP_SECRET;
  if (!expected) {
    res.status(500).json({ error: 'META_APP_SECRET não configurado no servidor' });
    return false;
  }
  if (!provided || provided !== expected) {
    res.status(403).json({ error: 'X-Admin-Secret inválido ou ausente' });
    return false;
  }
  return true;
}

router.get('/llm-status', async (req: Request, res: Response) => {
  if (!requireAdminAuth(req, res)) return;

  try {
    const providers = llmRouter.getStatus();

    // Agregação 24h via llm_call_logs (tabela criada no Blocker 1)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [stats, byProviderRaw] = await Promise.all([
      prisma.lLMCallLog.aggregate({
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { costUsdEstimate: true },
        _avg: { latencyMs: true },
      }),
      prisma.lLMCallLog.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);

    // Fallback rate = chamadas com fallback_triggered=true / total
    const fallbacks = await prisma.lLMCallLog.count({
      where: { createdAt: { gte: since }, fallbackTriggered: true },
    });

    const totalCalls = stats._count._all ?? 0;
    const fallbackRate = totalCalls > 0 ? fallbacks / totalCalls : 0;

    const byProvider: Record<string, number> = {};
    for (const row of byProviderRaw) {
      byProvider[row.provider] = row._count._all;
    }

    res.json({
      providers,
      last24h: {
        totalCalls,
        totalCostUsd: stats._sum.costUsdEstimate?.toString() ?? '0',
        avgLatencyMs: Math.round(stats._avg.latencyMs ?? 0),
        fallbackRate: Number(fallbackRate.toFixed(4)),
        byProvider,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[admin/llm-status] erro:', err);
    res.status(500).json({ error: 'erro ao consultar status' });
  }
});

export default router;
