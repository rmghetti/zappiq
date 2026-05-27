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

/**
 * GET /api/crm/attribution (CRM Onda 4, PR #221)
 *
 * Atribuição fim-a-fim de campanha → venda. Pra cada campanha da org,
 * agrega o funil completo: sent → reply → contact criado → deal criado →
 * deal ganho → receita total.
 *
 * CAC (Customer Acquisition Cost) estimado: usamos R$ 0,05 por mensagem
 * enviada (proxy do custo WhatsApp Cloud API + RBM). Quando schema ganhar
 * Campaign.budgetCents real, trocar pela soma de spend.
 *
 * Janela padrão: últimos 90 dias.
 */
const ESTIMATED_COST_PER_MSG_BRL = 0.05; // proxy até termos Campaign.budgetCents

router.get('/attribution', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const daysParam = Number(req.query.days);
    const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 365 ? daysParam : 90;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Carrega todas as campanhas da org (sem cutoff — quero contar histórico)
    const campaigns = await prisma.campaign.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        repliedCount: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Carrega contacts e deals atribuídos (com sourceCampaignId) na janela
    const [contactsAttributed, dealsAttributed] = await Promise.all([
      prisma.contact.findMany({
        where: {
          organizationId: orgId,
          sourceCampaignId: { not: null },
          createdAt: { gte: cutoff },
        },
        select: { id: true, sourceCampaignId: true },
      }),
      prisma.deal.findMany({
        where: {
          organizationId: orgId,
          sourceCampaignId: { not: null },
          createdAt: { gte: cutoff },
        },
        select: { id: true, sourceCampaignId: true, stage: true, value: true, wonAt: true },
      }),
    ]);

    // Pra cada campanha, agrega
    const attribution = campaigns.map((c) => {
      const cContacts = contactsAttributed.filter((x) => x.sourceCampaignId === c.id);
      const cDeals = dealsAttributed.filter((x) => x.sourceCampaignId === c.id);
      const cDealsWon = cDeals.filter((d) => d.stage === 'won');
      const receitaTotal = cDealsWon.reduce((acc, d) => acc + Number(d.value || 0), 0);
      const ticketMedio = cDealsWon.length > 0 ? receitaTotal / cDealsWon.length : 0;
      const cacEstimado = c.sentCount * ESTIMATED_COST_PER_MSG_BRL;
      const roi = cacEstimado > 0 ? (receitaTotal - cacEstimado) / cacEstimado : 0;
      const replyRate = c.sentCount > 0 ? c.repliedCount / c.sentCount : 0;
      const conversionRate = cContacts.length > 0 ? cDealsWon.length / cContacts.length : 0;

      return {
        id: c.id,
        name: c.name,
        type: c.type,
        status: c.status,
        createdAt: c.createdAt,
        // Funil
        sentCount: c.sentCount,
        deliveredCount: c.deliveredCount,
        readCount: c.readCount,
        repliedCount: c.repliedCount,
        contactsCreated: cContacts.length,
        dealsCreated: cDeals.length,
        dealsWon: cDealsWon.length,
        // Financeiro
        receitaTotal,
        ticketMedio,
        cacEstimado,
        roi, // (receita - custo) / custo. Pode ser negativo.
        // Taxas
        replyRate, // repliedCount / sentCount
        conversionRate, // dealsWon / contactsCreated
      };
    });

    // KPIs agregados
    const totalReceita = attribution.reduce((acc, a) => acc + a.receitaTotal, 0);
    const totalDealsWon = attribution.reduce((acc, a) => acc + a.dealsWon, 0);
    const totalCAC = attribution.reduce((acc, a) => acc + a.cacEstimado, 0);
    const totalReplies = attribution.reduce((acc, a) => acc + a.repliedCount, 0);
    const totalSent = attribution.reduce((acc, a) => acc + a.sentCount, 0);
    const melhorCampanha = attribution
      .filter((a) => a.cacEstimado > 0)
      .sort((a, b) => b.roi - a.roi)[0] || null;

    res.json({
      windowDays: days,
      kpisGerais: {
        totalReceitaAtribuida: totalReceita,
        totalDealsAtribuidos: totalDealsWon,
        totalCacEstimado: totalCAC,
        roiGeral: totalCAC > 0 ? (totalReceita - totalCAC) / totalCAC : 0,
        replyRateMedio: totalSent > 0 ? totalReplies / totalSent : 0,
        melhorCampanha: melhorCampanha
          ? { id: melhorCampanha.id, name: melhorCampanha.name, roi: melhorCampanha.roi }
          : null,
        totalCampanhas: attribution.length,
      },
      campanhas: attribution,
      assumptions: {
        costPerMessageBrl: ESTIMATED_COST_PER_MSG_BRL,
        note: 'CAC = sentCount × R$ 0,05 (proxy Cloud API). Quando Campaign.budgetCents existir, trocar por spend real.',
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
