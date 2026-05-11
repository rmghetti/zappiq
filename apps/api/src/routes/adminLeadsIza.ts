/**
 * Admin Leads + Iza Conversations (2 features SUPERADMIN, 2026-05-11).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * /api/admin/leads — visibilidade total de signups/orgs novas
 * ════════════════════════════════════════════════════════════════════════════
 * Unifica 3 fontes pra dar a foto real de quem está entrando no produto:
 *   1. signups (tabela pré-onboarding) — intenção declarada
 *   2. organizations (cadastro completo) — quem virou tenant
 *   3. messages count — quem realmente USOU
 *
 * Status calculado:
 *   - 'signup_only'    → registro em signups, sem org criada (não confirmou)
 *   - 'cadastrado'     → tem org, 0 conversas (parado)
 *   - 'ativo'          → tem org + conversas + mensagens reais
 *
 * Filtra orgs staging por default (mesma lógica de /quota-watch).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * /api/admin/iza-conversations — espião nas conversas da Iza
 * ════════════════════════════════════════════════════════════════════════════
 * SUPERADMIN logado em qualquer tenant consegue ver as conversas da Iza
 * canonical (`cmo1ywwfe00ko1jskexiexsm4`). Bypass do RLS via service-side
 * query direta com WHERE explícito.
 *
 * Endpoints:
 *   GET /api/admin/iza-conversations         → lista conversas + last msg
 *   GET /api/admin/iza-conversations/:id     → mensagens completas da conversa
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

// Iza canonical (memória project_zappiq_3_orgs_zappiq_naming)
const IZA_ORG_ID = 'cmo1ywwfe00ko1jskexiexsm4';

// Domínio dos seed staging — usar pra filtrar
const STAGING_EMAIL_DOMAIN = '@exemplo-staging.zappiq.com.br';

// ─── GET /api/admin/leads ────────────────────────────────────────────────

async function leadsHandler(req: Request, res: Response) {
  try {
    const days = Math.min(Number(req.query.days) || 30, 90);
    const includeStaging = req.query.includeStaging === 'true';
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    // 1) Signups (intenção pré-org)
    const signups = (await prisma.$queryRawUnsafe(`
      SELECT id, email, name, plan_chosen, status, company, cnpj,
             organization_id, utm_source, utm_medium, utm_campaign,
             created_at, confirmed_at
      FROM signups
      WHERE created_at >= $1
      ORDER BY created_at DESC
    `, since)) as Array<any>;

    // 2) Orgs criadas no período (com primeiro user owner)
    const orgsRaw = (await prisma.$queryRawUnsafe(`
      SELECT
        o.id,
        o.name AS org_name,
        o.plan,
        o."isTrialActive",
        o."subscriptionStatus",
        o."createdAt",
        u.name AS owner_name,
        u.email AS owner_email,
        (SELECT COUNT(*) FROM conversations WHERE "organizationId" = o.id) AS conv_count,
        (SELECT COUNT(*) FROM messages m
         JOIN conversations c ON c.id = m."conversationId"
         WHERE c."organizationId" = o.id) AS msg_count
      FROM organizations o
      LEFT JOIN LATERAL (
        SELECT name, email FROM users
        WHERE "organizationId" = o.id
        AND role IN ('SUPERADMIN', 'ADMIN')
        ORDER BY "createdAt" ASC
        LIMIT 1
      ) u ON true
      WHERE o."createdAt" >= $1
      ORDER BY o."createdAt" DESC
    `, since)) as Array<any>;

    // Filtra orgs staging (todos users com domain @exemplo-staging.*)
    let filteredOrgs = orgsRaw;
    let stagingFilteredCount = 0;
    if (!includeStaging) {
      const stagingRows = (await prisma.$queryRawUnsafe(`
        SELECT o.id FROM organizations o
        WHERE NOT EXISTS (
          SELECT 1 FROM users u
          WHERE u."organizationId" = o.id
          AND u.email NOT LIKE '%${STAGING_EMAIL_DOMAIN}'
        )
        AND EXISTS (SELECT 1 FROM users u WHERE u."organizationId" = o.id)
      `)) as Array<{ id: string }>;
      const stagingIds = new Set(stagingRows.map((r) => r.id));
      filteredOrgs = orgsRaw.filter((o) => !stagingIds.has(o.id));
      stagingFilteredCount = orgsRaw.length - filteredOrgs.length;
    }

    // 3) Combinação: status por org
    const orgRows = filteredOrgs.map((o) => {
      const msgCount = Number(o.msg_count);
      const convCount = Number(o.conv_count);
      const status: 'ativo' | 'cadastrado' = msgCount > 0 ? 'ativo' : 'cadastrado';
      return {
        kind: 'organization' as const,
        id: o.id,
        name: o.org_name,
        ownerName: o.owner_name,
        ownerEmail: o.owner_email,
        plan: o.plan,
        isTrialActive: o.isTrialActive,
        subscriptionStatus: o.subscriptionStatus,
        company: null,
        cnpj: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        conversationsCount: convCount,
        messagesCount: msgCount,
        status,
        createdAt: o.createdAt.toISOString(),
        confirmedAt: o.createdAt.toISOString(),
      };
    });

    // 4) Signups que NÃO viraram org (organization_id null)
    const signupOnlyRows = signups
      .filter((s) => !s.organization_id)
      .map((s) => ({
        kind: 'signup' as const,
        id: s.id,
        name: s.name,
        ownerName: s.name,
        ownerEmail: s.email,
        plan: s.plan_chosen,
        isTrialActive: false,
        subscriptionStatus: s.status,
        company: s.company,
        cnpj: s.cnpj,
        utmSource: s.utm_source,
        utmMedium: s.utm_medium,
        utmCampaign: s.utm_campaign,
        conversationsCount: 0,
        messagesCount: 0,
        status: 'signup_only' as const,
        createdAt: s.created_at.toISOString(),
        confirmedAt: s.confirmed_at ? s.confirmed_at.toISOString() : null,
      }));

    const allRows = [...orgRows, ...signupOnlyRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const summary = {
      totalLeads: allRows.length,
      signupOnly: allRows.filter((r) => r.status === 'signup_only').length,
      cadastrado: allRows.filter((r) => r.status === 'cadastrado').length,
      ativo: allRows.filter((r) => r.status === 'ativo').length,
      stagingFilteredCount,
      periodDays: days,
    };

    res.json({
      summary,
      rows: allRows,
      includeStaging,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('[admin/leads] erro:', err);
    res.status(500).json({ error: 'erro ao consultar leads', message: err?.message });
  }
}

// ─── GET /api/admin/iza-conversations ───────────────────────────────────

async function izaConversationsHandler(_req: Request, res: Response) {
  try {
    const conversations = (await prisma.$queryRawUnsafe(`
      SELECT
        c.id,
        c.status,
        c.channel,
        c.summary,
        c."csatScore",
        c."createdAt",
        c."updatedAt",
        c."closedAt",
        co.name AS contact_name,
        co.phone AS contact_phone,
        (SELECT COUNT(*) FROM messages WHERE "conversationId" = c.id) AS msg_count,
        (SELECT m.content FROM messages m
         WHERE m."conversationId" = c.id
         ORDER BY m."createdAt" DESC LIMIT 1) AS last_msg,
        (SELECT m."createdAt" FROM messages m
         WHERE m."conversationId" = c.id
         ORDER BY m."createdAt" DESC LIMIT 1) AS last_msg_at
      FROM conversations c
      LEFT JOIN contacts co ON co.id = c."contactId"
      WHERE c."organizationId" = $1
      AND c."deletedAt" IS NULL
      ORDER BY c."updatedAt" DESC
      LIMIT 100
    `, IZA_ORG_ID)) as Array<any>;

    res.json({
      izaOrgId: IZA_ORG_ID,
      total: conversations.length,
      rows: conversations.map((c) => ({
        id: c.id,
        status: c.status,
        channel: c.channel,
        summary: c.summary,
        csatScore: c.csatScore,
        contactName: c.contact_name,
        contactPhone: c.contact_phone,
        msgCount: Number(c.msg_count),
        lastMsg: c.last_msg ? String(c.last_msg).slice(0, 200) : null,
        lastMsgAt: c.last_msg_at?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        closedAt: c.closedAt?.toISOString() ?? null,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('[admin/iza-conversations] erro:', err);
    res.status(500).json({ error: 'erro ao consultar conversas Iza', message: err?.message });
  }
}

// ─── GET /api/admin/iza-conversations/:id ───────────────────────────────

async function izaConversationDetailHandler(req: Request, res: Response) {
  try {
    const conversationId = req.params.id;
    if (!conversationId) {
      res.status(400).json({ error: 'conversation id obrigatório' });
      return;
    }

    // Verificar que a conversa pertence à Iza
    const conv = (await prisma.$queryRawUnsafe(`
      SELECT c.id, c.status, c.channel, c.summary, c."csatScore",
             c."createdAt", c."updatedAt", c."closedAt",
             co.name AS contact_name, co.phone AS contact_phone
      FROM conversations c
      LEFT JOIN contacts co ON co.id = c."contactId"
      WHERE c.id = $1 AND c."organizationId" = $2 AND c."deletedAt" IS NULL
      LIMIT 1
    `, conversationId, IZA_ORG_ID)) as Array<any>;

    if (conv.length === 0) {
      res.status(404).json({ error: 'conversa não encontrada na Iza' });
      return;
    }

    const messages = (await prisma.$queryRawUnsafe(`
      SELECT id, content, direction, "isFromBot", status,
             "messageType", "createdAt"
      FROM messages
      WHERE "conversationId" = $1
      ORDER BY "createdAt" ASC
    `, conversationId)) as Array<any>;

    res.json({
      conversation: {
        id: conv[0].id,
        status: conv[0].status,
        channel: conv[0].channel,
        summary: conv[0].summary,
        csatScore: conv[0].csatScore,
        contactName: conv[0].contact_name,
        contactPhone: conv[0].contact_phone,
        createdAt: conv[0].createdAt.toISOString(),
        updatedAt: conv[0].updatedAt.toISOString(),
        closedAt: conv[0].closedAt?.toISOString() ?? null,
      },
      messages: messages.map((m) => ({
        id: m.id,
        content: m.content,
        direction: m.direction,
        isFromBot: m.isFromBot,
        status: m.status,
        messageType: m.messageType,
        createdAt: m.createdAt.toISOString(),
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('[admin/iza-conversation-detail] erro:', err);
    res.status(500).json({ error: 'erro ao consultar conversa', message: err?.message });
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────

router.get('/leads', authMiddleware as any, requireRole('SUPERADMIN') as any, leadsHandler);
router.get(
  '/iza-conversations',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  izaConversationsHandler,
);
router.get(
  '/iza-conversations/:id',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  izaConversationDetailHandler,
);

export default router;
