/* ══════════════════════════════════════════════════════════════════════
 * adminClientes — Área "Clientes" (Superadmin) / Fase 2 (telas).
 * --------------------------------------------------------------------
 * Router SUPERADMIN montado em '/api/admin/clientes' (server.ts). Padrão de
 * guard idêntico ao adminOrganizations.ts (router.use(authMiddleware,
 * requireRole('SUPERADMIN'))).
 *
 * Reúne, por baixo, os blocos que já existem:
 *   - crm_accounts (fonte da verdade do CRM de plataforma, Fase 1)
 *   - organizations + users (adminOrganizations)
 *   - tenant_usage_monthly (adminTenantUsage — uso/custo/margem reais)
 *   - signups + combineLeadRows (adminLeads.util — dedup por email)
 * A lógica pura (classificação, health, KPIs) vive em adminClientes.util.ts.
 *
 * Endpoints:
 *   GET  /                       — lista unificada de contas (Visão Geral)
 *   GET  /:orgId                 — perfil 360 (agrega org + usage + crm_account)
 *   GET  /financeiro/summary     — resumo financeiro HONESTO (MRR real + derivados)
 *   POST /:orgId/owner           — seta crm_accounts.ownerUserId
 *   POST /backfill               — dispara o backfill idempotente (Fase 1)
 *
 * Princípio (§0/§10): separar REAL de ESTIMADO. MRR real = soma de contas PAGO
 * (exige stripeSubscriptionId). Nunca o MRR fantasma de catálogo.
 * ══════════════════════════════════════════════════════════════════════ */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { currentYearMonth, isSeedOrg } from '../services/tenantUsageService.js';
import { mrrCentsForPlan } from './stripeWebhook.util.js';
import {
  buildAccountRow,
  computeKpis,
  computeHealthBreakdown,
  computeHealthAggregate,
  type AccountRawInput,
  type ClienteAccountRow,
} from './adminClientes.util.js';

const router = Router();

router.use(authMiddleware, requireRole('SUPERADMIN'));

// Domínio dos seed staging — mesma lógica de /admin/leads e /quota-watch.
const STAGING_EMAIL_DOMAIN = '@exemplo-staging.zappiq.com.br';

/** Janela mensal [start, end) em UTC a partir de 'YYYY-MM'. */
function monthRangeUtc(yearMonth: string): { start: Date; end: Date } {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = new Date(Date.UTC(y, (m ?? 1) - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m ?? 1, 1, 0, 0, 0));
  return { start, end };
}

/** MRR de catálogo (centavos) para o plano — estimativa, mensal. 0 se sem preço. */
function catalogMrrCentsForPlan(plan: string | null | undefined): number {
  return mrrCentsForPlan(plan, 'monthly');
}

// ─── helpers de leitura (I/O isolado; a lógica pura fica em .util) ───────────

/** Ids de orgs consideradas staging (todos os users em @exemplo-staging.*). */
async function loadStagingOrgIds(): Promise<Set<string>> {
  const rows = (await prisma.$queryRawUnsafe(`
    SELECT o.id FROM organizations o
    WHERE NOT EXISTS (
      SELECT 1 FROM users u
      WHERE u."organizationId" = o.id
      AND u.email NOT LIKE '%${STAGING_EMAIL_DOMAIN}'
    )
    AND EXISTS (SELECT 1 FROM users u WHERE u."organizationId" = o.id)
  `)) as Array<{ id: string }>;
  return new Set(rows.map((r) => r.id));
}

/** Ids de orgs marcadas como seed (settings.seed=true — PR-L 20/08/2026).
 *  Ficam fora dos totais financeiros; visíveis na lista com badge isSeed. */
async function loadSeedOrgIds(): Promise<Set<string>> {
  const rows = await prisma.organization.findMany({
    where: { settings: { path: ['seed'], equals: true } },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/** Usage do mês corrente por org (aiMessages + margem) — bloco reusado. */
async function loadUsageByOrg(
  period: string,
): Promise<Map<string, { aiMessagesProcessed: number; grossMarginPercent: number | null; llmCostUsd: number; revenueBrl: number }>> {
  const usage = (await (prisma as any).TenantUsageMonthly.findMany({
    where: { periodYearMonth: period },
    select: {
      organizationId: true,
      aiMessagesProcessed: true,
      grossMarginPercent: true,
      llmCostUsd: true,
      revenueBrlCents: true,
    },
  })) as Array<any>;
  const map = new Map<string, any>();
  for (const u of usage) {
    map.set(u.organizationId, {
      aiMessagesProcessed: Number(u.aiMessagesProcessed ?? 0),
      grossMarginPercent: u.grossMarginPercent ?? null,
      llmCostUsd: Number(u.llmCostUsd ?? 0),
      revenueBrl: Number(u.revenueBrlCents ?? 0) / 100,
    });
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/admin/clientes — lista unificada (Visão Geral)
// ═══════════════════════════════════════════════════════════════════════════
async function listHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const includeStaging = req.query.includeStaging === 'true';
    const period = (req.query.period as string) || currentYearMonth();
    const now = new Date();

    // 1) crm_accounts é a fonte da verdade (Fase 1). Já traz lifecycleStage
    //    materializado, ownerUserId, mrr, trial, etc.
    const accounts = await prisma.crmAccount.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            plan: true,
            churnedAt: true,
            subscriptionStatus: true,
            stripeSubscriptionId: true,
            trialEndsAt: true,
            isTrialActive: true,
            trialConverted: true,
            paidAt: true,
            aiReadinessScore: true,
            // settings entra só para o badge de seed (PR-L 20/08/2026).
            settings: true,
            users: {
              where: { role: { in: ['SUPERADMIN', 'ADMIN'] } },
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { name: true, email: true },
            },
          },
        },
      },
    });

    const usageByOrg = await loadUsageByOrg(period);
    const stagingOrgIds = includeStaging ? new Set<string>() : await loadStagingOrgIds();

    const raws: AccountRawInput[] = accounts.map((a) => {
      const org = a.organization;
      const usage = a.organizationId ? usageByOrg.get(a.organizationId) : undefined;
      const owner = org?.users?.[0];
      const isStaging = Boolean(
        a.organizationId && stagingOrgIds.has(a.organizationId),
      ) || a.email.toLowerCase().endsWith(STAGING_EMAIL_DOMAIN);

      return {
        crmAccountId: a.id,
        organizationId: a.organizationId,
        signupId: a.signupId,
        name: org?.name ?? a.company ?? owner?.name ?? a.email,
        email: a.email,
        company: a.company,
        cnpj: a.cnpj,
        plan: a.plan ?? org?.plan ?? null,
        materializedStage: a.lifecycleStage,
        churnedAt: org?.churnedAt ?? null,
        subscriptionStatus: org?.subscriptionStatus ?? null,
        stripeSubscriptionId: org?.stripeSubscriptionId ?? null,
        trialEndsAt: a.trialEndsAt ?? org?.trialEndsAt ?? null,
        isTrialActive: org?.isTrialActive ?? null,
        trialConverted: org?.trialConverted ?? null,
        paidAt: org?.paidAt ?? null,
        mrrCents: a.mrrCents,
        aiReadinessScore: org?.aiReadinessScore ?? null,
        aiMessagesProcessed: usage?.aiMessagesProcessed ?? 0,
        grossMarginPercent: usage?.grossMarginPercent ?? null,
        lastActivityAt: a.lastActivityAt,
        ownerUserId: a.ownerUserId,
        isStaging,
        // Seed fica na lista (badge), mas fora do MRR dos KPIs (computeKpis).
        isSeed: isSeedOrg((org as any)?.settings),
        createdAt: a.createdAt,
      };
    });

    const allRows: ClienteAccountRow[] = raws.map((r) => buildAccountRow(r, now));
    const rows = includeStaging ? allRows : allRows.filter((r) => !r.isStaging);
    const stagingFilteredCount = allRows.length - rows.length;

    const kpis = computeKpis(rows, now);
    const healthAggregate = computeHealthAggregate(rows);

    res.json({
      period,
      includeStaging,
      stagingFilteredCount,
      kpis,
      healthAggregate,
      rows,
      total: rows.length,
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    logger.error({ msg: 'admin_clientes_list_failed', error: String((err as any)?.message ?? err) });
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/admin/clientes/financeiro/summary — resumo financeiro HONESTO (Fase 3)
// ═══════════════════════════════════════════════════════════════════════════
// Separa rigidamente REAL de ESTIMADO (§0/§10):
//   - real: MRR real (soma de contas PAGO — exige stripeSubscriptionId), custo
//     LLM agregado real (SUM llm_call_logs via tenant_usage), margem real por
//     cliente, receita reconhecida de faturas Stripe pagas de fato no período.
//   - potencial: "receita potencial (catálogo)" — soma do MRR de catálogo de
//     TODAS as contas não-staging, ROTULADA como estimativa (nunca é MRR real).
//   - pending: NRR/GRR/MRR bridge/MRR em risco/dunning — computados dos dados
//     reais (ficam zerados/honestos enquanto não há base pagante).
async function financeiroSummaryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const period = (req.query.period as string) || currentYearMonth();
    const now = new Date();
    const { start: periodStart, end: periodEnd } = monthRangeUtc(period);

    const accounts = await prisma.crmAccount.findMany({
      select: {
        id: true,
        organizationId: true,
        email: true,
        lifecycleStage: true,
        mrrCents: true,
        plan: true,
      },
    });
    const stagingOrgIds = await loadStagingOrgIds();
    const seedOrgIds = await loadSeedOrgIds();
    const usageByOrg = await loadUsageByOrg(period);

    let mrrRealCents = 0;
    let payingAccounts = 0;
    let llmCostUsd = 0;
    let revenueBrl = 0;
    let profitableTenants = 0;
    let deficitTenants = 0;
    // Receita potencial (catálogo) — estimativa rotulada. Soma do mrr de catálogo
    // de TODAS as contas não-staging que teriam preço (não é receita real).
    let potentialMrrCents = 0;
    // MRR em risco: contas PAST_DUE (dunning) — mrr que pode virar churn.
    let mrrAtRiskCents = 0;
    let pastDueAccounts = 0;
    let churnedAccounts = 0;
    const payingOrgIds: string[] = [];

    for (const a of accounts) {
      const isStaging =
        (a.organizationId && stagingOrgIds.has(a.organizationId)) ||
        a.email.toLowerCase().endsWith(STAGING_EMAIL_DOMAIN);
      if (isStaging) continue;
      // PR-L (20/08/2026): seed fora de TODOS os totais financeiros — MRR,
      // potencial de catálogo, margem e receita reconhecida. Este endpoint só
      // devolve agregados; a listagem individual (com badge) fica no GET /.
      if (a.organizationId && seedOrgIds.has(a.organizationId)) continue;

      const stage = (a.lifecycleStage ?? '').toUpperCase();
      const isPaying = stage === 'PAGO' || stage === 'ACTIVE' || stage === 'ATIVO';
      if (isPaying) {
        mrrRealCents += a.mrrCents ?? 0;
        payingAccounts++;
        if (a.organizationId) payingOrgIds.push(a.organizationId);
      }
      if (stage === 'PAST_DUE') {
        mrrAtRiskCents += a.mrrCents ?? 0;
        pastDueAccounts++;
      }
      if (stage === 'CHURNED') churnedAccounts++;

      // Potencial de catálogo (estimativa) — só para contas com plano precificável.
      potentialMrrCents += catalogMrrCentsForPlan(a.plan);

      const usage = a.organizationId ? usageByOrg.get(a.organizationId) : undefined;
      if (usage) {
        llmCostUsd += usage.llmCostUsd;
        revenueBrl += usage.revenueBrl;
        if (usage.grossMarginPercent != null) {
          if (usage.grossMarginPercent >= 0) profitableTenants++;
          else deficitTenants++;
        }
      }
    }

    // Receita reconhecida REAL do período: faturas Stripe efetivamente pagas
    // (stripe_invoices, Fase 3). Hoje vazio até chegar o 1º pagamento.
    const invoiceAgg = await prisma.stripeInvoice.aggregate({
      where: { paidAt: { gte: periodStart, lt: periodEnd } },
      _sum: { amountBrlCents: true },
      _count: { _all: true },
    });
    const recognizedInvoiceCents = invoiceAgg._sum.amountBrlCents ?? 0;
    const paidInvoicesCount = invoiceAgg._count._all ?? 0;

    // Receita recuperada por dunning: faturas pagas no período cujo cliente
    // estava/está PAST_DUE (recuperação de inadimplência). Real, hoje vazio.
    let recoveredByDunningCents = 0;
    const pastDueOrgIds = accounts
      .filter((a) => (a.lifecycleStage ?? '').toUpperCase() === 'PAST_DUE' && a.organizationId)
      .map((a) => a.organizationId as string);
    if (pastDueOrgIds.length > 0) {
      const recovered = await prisma.stripeInvoice.aggregate({
        where: { organizationId: { in: pastDueOrgIds }, paidAt: { gte: periodStart, lt: periodEnd } },
        _sum: { amountBrlCents: true },
      });
      recoveredByDunningCents = recovered._sum.amountBrlCents ?? 0;
    }

    const hasPaying = payingAccounts > 0;

    res.json({
      period,
      // Bloco de saúde de dados — sinaliza para a UI mostrar o banner honesto.
      dataHealth: {
        hasPayingCustomers: hasPaying,
        payingAccounts,
        note: hasPaying
          ? null
          : 'Nenhum cliente pagante real ainda. Faturamento/pagamentos ficam vazios; consumo/custo/margem são reais.',
      },
      real: {
        mrrRealCents,
        mrrRealBrl: mrrRealCents / 100,
        payingAccounts,
        // Custo/margem REAIS do período (excluindo staging).
        llmCostUsd,
        recognizedRevenueBrl: revenueBrl,
        profitableTenants,
        deficitTenants,
        // Receita reconhecida de faturas Stripe pagas de fato (Fase 3).
        recognizedInvoiceCents,
        recognizedInvoiceBrl: recognizedInvoiceCents / 100,
        paidInvoicesCount,
      },
      // Estimativa ROTULADA — nunca é MRR de board. UI mostra como "potencial".
      potential: {
        catalogMrrCents: potentialMrrCents,
        catalogMrrBrl: potentialMrrCents / 100,
        label: 'Receita potencial (catálogo) — estimativa, não é receita real.',
      },
      // Derivados de retenção. Computados dos dados reais; ficam honestamente
      // vazios/aguardando enquanto não há base pagante. hasBaseline sinaliza a UI.
      pending: {
        hasPayingBaseline: hasPaying,
        // NRR/GRR precisam de 2 períodos com base pagante — nulos até lá.
        nrr: null,
        grr: null,
        mrrBridge: null,
        mrrAtRiskCents,
        mrrAtRiskBrl: mrrAtRiskCents / 100,
        pastDueAccounts,
        churnedAccounts,
        recoveredByDunningCents,
        recoveredByDunningBrl: recoveredByDunningCents / 100,
        note: hasPaying
          ? null
          : 'NRR/GRR/MRR bridge aguardam base pagante. MRR em risco/churn/dunning são reais e já refletem os dados.',
      },
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    logger.error({ msg: 'admin_clientes_financeiro_failed', error: String((err as any)?.message ?? err) });
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/admin/clientes/:orgId — perfil 360
// ═══════════════════════════════════════════════════════════════════════════
async function detailHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { orgId } = req.params;
    const period = (req.query.period as string) || currentYearMonth();
    const now = new Date();

    // A conta pode ser identificada pelo organizationId OU pelo id da crm_account
    // (leads/signups pré-org não têm organizationId).
    const account = await prisma.crmAccount.findFirst({
      where: { OR: [{ organizationId: orgId }, { id: orgId }] },
      include: {
        activities: { orderBy: { createdAt: 'desc' }, take: 30 },
        organization: {
          include: {
            users: {
              select: { id: true, name: true, email: true, role: true, createdAt: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!account) {
      res.status(404).json({ error: 'Conta não encontrada' });
      return;
    }

    const org = account.organization;

    // Série histórica de uso (últimos 6 meses) — bloco de tenant-usage.
    let usageHistory: any[] = [];
    let currentUsage: any = null;
    if (account.organizationId) {
      usageHistory = (await (prisma as any).TenantUsageMonthly.findMany({
        where: { organizationId: account.organizationId },
        orderBy: { periodYearMonth: 'desc' },
        take: 6,
      })) as any[];
      currentUsage = usageHistory.find((u: any) => u.periodYearMonth === period) ?? usageHistory[0] ?? null;
    }

    // Linha canônica (mesma lógica da lista) para reaproveitar stage/health.
    const usage = currentUsage
      ? {
          aiMessagesProcessed: Number(currentUsage.aiMessagesProcessed ?? 0),
          grossMarginPercent: currentUsage.grossMarginPercent ?? null,
        }
      : { aiMessagesProcessed: 0, grossMarginPercent: null };

    const row = buildAccountRow(
      {
        crmAccountId: account.id,
        organizationId: account.organizationId,
        signupId: account.signupId,
        name: org?.name ?? account.company ?? account.email,
        email: account.email,
        company: account.company,
        cnpj: account.cnpj,
        plan: account.plan ?? org?.plan ?? null,
        materializedStage: account.lifecycleStage,
        churnedAt: org?.churnedAt ?? null,
        subscriptionStatus: org?.subscriptionStatus ?? null,
        stripeSubscriptionId: org?.stripeSubscriptionId ?? null,
        trialEndsAt: account.trialEndsAt ?? org?.trialEndsAt ?? null,
        isTrialActive: org?.isTrialActive ?? null,
        trialConverted: org?.trialConverted ?? null,
        paidAt: org?.paidAt ?? null,
        mrrCents: account.mrrCents,
        aiReadinessScore: org?.aiReadinessScore ?? null,
        aiMessagesProcessed: usage.aiMessagesProcessed,
        grossMarginPercent: usage.grossMarginPercent,
        lastActivityAt: account.lastActivityAt,
        ownerUserId: account.ownerUserId,
        // Badge de seed no perfil 360 (PR-L 20/08/2026).
        isSeed: isSeedOrg((org as any)?.settings),
        createdAt: account.createdAt,
      },
      now,
    );

    // stripeCustomerId REAL vem das colunas novas da Fase 1 (nunca = tenantId).
    const stripeCustomerId = (org as any)?.stripeCustomerId ?? null;
    const stripeSubscriptionId = (org as any)?.stripeSubscriptionId ?? null;

    // Motor de Health estratégico (Fase 1): breakdown por dimensão + playbook.
    // Reusa os MESMOS sinais da row canônica (stage/uso/adoção/margem) + trial.
    const health = computeHealthBreakdown(
      {
        aiReadinessScore: org?.aiReadinessScore ?? null,
        aiMessagesProcessed: usage.aiMessagesProcessed,
        grossMarginPercent: usage.grossMarginPercent,
        stage: row.stage,
        trialDaysLeft: row.trialDaysLeft,
      },
      account.organizationId ?? null,
    );

    res.json({
      // A — identidade / firmográfico
      identity: {
        crmAccountId: account.id,
        organizationId: account.organizationId,
        signupId: account.signupId,
        name: org?.name ?? account.company ?? account.email,
        email: account.email,
        company: account.company,
        cnpj: account.cnpj,
        niche: (org as any)?.settings?.niche ?? null,
        createdAt: account.createdAt.toISOString(),
        aiReadinessScore: org?.aiReadinessScore ?? null,
      },
      // B — plano & assinatura
      plan: {
        plan: account.plan ?? org?.plan ?? null,
        stage: row.stage,
        healthScore: row.healthScore,
        healthColor: row.healthColor,
        trialEndsAt: row.trialEndsAt,
        trialDaysLeft: row.trialDaysLeft,
        isTrialActive: org?.isTrialActive ?? null,
        trialCostCapUsd: (org as any)?.trialCostCapUsd ?? null,
      },
      // C — cobrança Stripe (colunas reais da Fase 1)
      billing: {
        stripeCustomerId,
        stripeSubscriptionId,
        subscriptionStatus: org?.subscriptionStatus ?? null,
        paidAt: (org as any)?.paidAt?.toISOString?.() ?? null,
        churnedAt: (org as any)?.churnedAt?.toISOString?.() ?? null,
        cardAddedAt: (org as any)?.cardAddedAt?.toISOString?.() ?? null,
        mrrCents: account.mrrCents,
      },
      // D/E — consumo REAL + custo/margem (histórico de tenant-usage)
      usage: {
        current: currentUsage
          ? {
              period: currentUsage.periodYearMonth,
              aiMessagesProcessed: Number(currentUsage.aiMessagesProcessed ?? 0),
              conversationsOpened: Number(currentUsage.conversationsOpened ?? 0),
              conversationsAiResolved: Number(currentUsage.conversationsAiResolved ?? 0),
              conversationsHumanResolved: Number(currentUsage.conversationsHumanResolved ?? 0),
              handoffsCount: Number(currentUsage.handoffsCount ?? 0),
              llmCostUsd: Number(currentUsage.llmCostUsd ?? 0),
              grossMarginPercent: currentUsage.grossMarginPercent ?? null,
            }
          : null,
        history: usageHistory.map((r: any) => ({
          period: r.periodYearMonth,
          aiMessagesProcessed: Number(r.aiMessagesProcessed ?? 0),
          llmCostUsd: Number(r.llmCostUsd ?? 0),
          grossMarginPercent: r.grossMarginPercent ?? null,
          conversationsOpened: Number(r.conversationsOpened ?? 0),
          conversationsAiResolved: Number(r.conversationsAiResolved ?? 0),
          conversationsHumanResolved: Number(r.conversationsHumanResolved ?? 0),
          handoffsCount: Number(r.handoffsCount ?? 0),
        })),
      },
      // G — timeline (crm_account_activity)
      activities: account.activities.map((act) => ({
        id: act.id,
        type: act.type,
        payload: act.payload,
        createdAt: act.createdAt.toISOString(),
      })),
      // H/I — qualificação + owner + próxima ação (esqueleto honesto)
      owner: {
        ownerUserId: account.ownerUserId,
        candidates: org?.users?.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })) ?? [],
      },
      nextAction: buildNextAction(row),
      // Motor de Health estratégico (Fase 1) — breakdown + playbook acionável.
      health,
      // links úteis (F — conversas)
      links: {
        izaConversations: account.organizationId
          ? `/admin/iza-conversations?org=${account.organizationId}`
          : null,
      },
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    logger.error({ msg: 'admin_clientes_detail_failed', error: String((err as any)?.message ?? err) });
    next(err);
  }
}

/** Próxima ação recomendada (regra simples v1, sem PLG). */
function buildNextAction(row: ClienteAccountRow): string {
  switch (row.stage) {
    case 'PAST_DUE':
      return 'Cobrança falhou — acionar recuperação (dunning) e contato humano.';
    case 'TRIAL_EXPIRADO':
      return 'Trial expirou sem conversão — abrir conversa de reativação/oferta.';
    case 'EM_TRIAL':
      return row.trialDaysLeft != null && row.trialDaysLeft <= 3
        ? 'Trial vence em breve — empurrão de ativação + convite para plano.'
        : 'Acompanhar adoção no trial e remover atrito de onboarding.';
    case 'NOVO':
      return 'Lead novo — qualificar e agendar onboarding.';
    case 'CHURNED':
      return 'Conta em churn — win-back quando fizer sentido.';
    case 'PAGO':
      return row.healthColor === 'red'
        ? 'Cliente pagante em risco — CS proativo para evitar churn.'
        : 'Cliente saudável — buscar expansão/upsell.';
    default:
      return 'Revisar conta.';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/admin/clientes/:orgId/owner — seta ownerUserId
// ═══════════════════════════════════════════════════════════════════════════
async function setOwnerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { orgId } = req.params;
    const ownerUserId: string | null = req.body?.ownerUserId ?? null;

    const account = await prisma.crmAccount.findFirst({
      where: { OR: [{ organizationId: orgId }, { id: orgId }] },
      select: { id: true, ownerUserId: true },
    });
    if (!account) {
      res.status(404).json({ error: 'Conta não encontrada' });
      return;
    }

    await prisma.crmAccount.update({
      where: { id: account.id },
      data: { ownerUserId },
    });
    // registra na timeline (reusa crm_account_activity).
    await prisma.crmAccountActivity.create({
      data: {
        crmAccountId: account.id,
        type: 'owner_assigned',
        payload: { from: account.ownerUserId ?? null, to: ownerUserId, by: (req as any).user?.userId ?? null },
      },
    });

    res.json({ ok: true, crmAccountId: account.id, ownerUserId });
  } catch (err) {
    logger.error({ msg: 'admin_clientes_set_owner_failed', error: String((err as any)?.message ?? err) });
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/admin/clientes/backfill — dispara o backfill idempotente (Fase 1)
// ═══════════════════════════════════════════════════════════════════════════
// Superadmin dispara o backfill em runtime. Idempotente: liga signups↔org por
// email + semeia crm_accounts para todas as orgs/signups. Sem push/deploy.
async function backfillHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dryRun = req.query.dryRun === 'true' || req.body?.dryRun === true;
    const { runBackfillCrmAccounts } = await import('../services/backfillCrmAccountsService.js');
    const result = await runBackfillCrmAccounts({ dryRun });
    res.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ msg: 'admin_clientes_backfill_failed', error: String((err as any)?.message ?? err) });
    next(err);
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────
router.get('/', listHandler);
router.get('/financeiro/summary', financeiroSummaryHandler);
router.post('/backfill', backfillHandler);
router.get('/:orgId', detailHandler);
router.post('/:orgId/owner', setOwnerHandler);

export default router;
