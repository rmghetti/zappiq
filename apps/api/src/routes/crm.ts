/**
 * CRM Onda 3 (PR #217) · Métricas executivas do pipeline de vendas
 *
 * Endpoint expõe 6 KPIs que executivos esperam ver no topo de qualquer CRM
 * sério: win rate, sales velocity, ticket médio, conversão por estágio,
 * top 3 motivos de perda e forecast pipeline-weighted.
 *
 * Janela padrão: últimos 90 dias (override via ?days=N até max 365).
 * RLS por organizationId via rlsTenantMiddleware (definido em server.ts).
 *
 * Fórmulas:
 * - winRate = wonCount / (wonCount + lostCount) [janela]
 * - ticketMedio = avg(value) WHERE stage=won [janela]
 * - salesVelocity = wonCount × ticketMedio × winRate / avgSalesCycleDays
 *   (avgSalesCycleDays = avg(closedAt - createdAt) pros wons na janela)
 * - conversaoPorEstagio = pra cada stage, % de deals criados que JÁ
 *   passaram por ele (alcançaram ou ultrapassaram a ordem desse stage)
 * - motivosPerda = top 3 lossReason GROUP BY count
 * - forecast = Σ (value × stageProbability) pra deals ABERTOS
 *   probs: new=10% · qualified=25% · proposal=50% · negotiation=70%
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '@zappiq/database';

const router = Router();

// Stage probabilities pra forecast pipeline-weighted (PR #217).
// Valores convencionais de SaaS B2B; cliente pode ajustar futuramente
// via settings se quiser (não MVP).
const STAGE_PROBABILITY: Record<string, number> = {
  new: 0.1,
  qualified: 0.25,
  proposal: 0.5,
  negotiation: 0.7,
};

// Ordem canônica dos stages (usada pra calcular conversão acumulada).
// Match com STAGES do /crm/page.tsx — manter sincronizado.
const STAGE_ORDER: string[] = ['new', 'qualified', 'proposal', 'negotiation', 'won'];

router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const daysParam = Number(req.query.days);
    const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 365 ? daysParam : 90;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Carga única do dataset relevante (deals da org, todos status)
    const allDeals = await prisma.deal.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        stage: true,
        value: true,
        createdAt: true,
        closedAt: true,
        wonAt: true,
        lostAt: true,
        lossReason: true,
      },
    });

    // ─── Wons e Losts na janela ──────────────────────────────────────
    const wonsInWindow = allDeals.filter(
      (d) => d.stage === 'won' && (d.wonAt ?? d.closedAt) && (d.wonAt ?? d.closedAt!) >= cutoff,
    );
    const lostsInWindow = allDeals.filter(
      (d) => d.stage === 'lost' && (d.lostAt ?? d.closedAt) && (d.lostAt ?? d.closedAt!) >= cutoff,
    );
    const closedInWindow = wonsInWindow.length + lostsInWindow.length;
    const winRate = closedInWindow > 0 ? wonsInWindow.length / closedInWindow : 0;

    // ─── Ticket médio (apenas wons na janela) ────────────────────────
    const wonValues = wonsInWindow
      .map((d) => Number(d.value || 0))
      .filter((v) => v > 0);
    const ticketMedio =
      wonValues.length > 0 ? wonValues.reduce((a, b) => a + b, 0) / wonValues.length : 0;

    // ─── Sales cycle médio (createdAt → wonAt) em dias ───────────────
    const cycleDays = wonsInWindow
      .map((d) => {
        const closed = d.wonAt ?? d.closedAt;
        if (!closed) return null;
        const ms = closed.getTime() - d.createdAt.getTime();
        return ms / (24 * 60 * 60 * 1000);
      })
      .filter((v): v is number => v !== null && v > 0);
    const avgSalesCycleDays =
      cycleDays.length > 0 ? cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length : 0;

    // ─── Sales velocity: ($/dia esperado do pipeline) ────────────────
    // Fórmula padrão: (# wons × ticket médio × win rate) / cycle days
    const salesVelocity =
      avgSalesCycleDays > 0
        ? (wonsInWindow.length * ticketMedio * winRate) / avgSalesCycleDays
        : 0;

    // ─── Conversão por estágio (acumulado: % que CHEGOU naquele stage) ─
    // Pra cada stage na ordem, conta quantos deals já passaram nele.
    // "Passou" = stage atual == X OU stage atual está mais à frente OU é won.
    const totalCriados = allDeals.filter((d) => d.createdAt >= cutoff).length;
    const conversaoPorEstagio = STAGE_ORDER.map((stageKey, idx) => {
      const passou = allDeals.filter((d) => {
        if (d.createdAt < cutoff) return false;
        const dealIdx = STAGE_ORDER.indexOf(d.stage);
        // Won conta como passou por todos. Lost conta no stage onde perdeu.
        // Stage não na lista (legacy) ignora.
        if (d.stage === 'won') return true;
        if (dealIdx === -1) return false;
        return dealIdx >= idx;
      }).length;
      return {
        stage: stageKey,
        passou,
        total: totalCriados,
        percentual: totalCriados > 0 ? passou / totalCriados : 0,
      };
    });

    // ─── Top 3 motivos de perda ──────────────────────────────────────
    const lossReasonCounts = new Map<string, number>();
    for (const d of lostsInWindow) {
      const reason = d.lossReason || 'outro';
      lossReasonCounts.set(reason, (lossReasonCounts.get(reason) || 0) + 1);
    }
    const motivosPerda = Array.from(lossReasonCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason, count]) => ({ reason, count }));

    // ─── Forecast pipeline-weighted ──────────────────────────────────
    // Soma (value × probability) pra deals abertos (não won, não lost).
    const dealsAbertos = allDeals.filter(
      (d) => d.stage !== 'won' && d.stage !== 'lost',
    );
    const forecast = dealsAbertos.reduce((acc, d) => {
      const prob = STAGE_PROBABILITY[d.stage] ?? 0;
      const val = Number(d.value || 0);
      return acc + val * prob;
    }, 0);

    // PR #220 (CRM 3c): breakdown por estágio pra UI mostrar de onde vem o
    // forecast. Pra cada stage aberto, soma valor bruto + valor projetado
    // (value × probability) + count de deals.
    const forecastBreakdown = Object.entries(STAGE_PROBABILITY).map(([stageKey, prob]) => {
      const dealsNoStage = dealsAbertos.filter((d) => d.stage === stageKey);
      const valorBruto = dealsNoStage.reduce((acc, d) => acc + Number(d.value || 0), 0);
      return {
        stage: stageKey,
        probability: prob,
        count: dealsNoStage.length,
        valorBruto,
        valorProjetado: valorBruto * prob,
      };
    });

    res.json({
      windowDays: days,
      computedAt: new Date().toISOString(),
      kpis: {
        winRate, // 0..1
        ticketMedio, // R$
        salesVelocity, // R$/dia
        avgSalesCycleDays, // dias
        forecast, // R$ pipeline ponderado
        totalAbertos: dealsAbertos.length,
        totalFechadosJanela: closedInWindow,
        wonsJanela: wonsInWindow.length,
        lostsJanela: lostsInWindow.length,
      },
      conversaoPorEstagio,
      motivosPerda,
      forecastBreakdown,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
