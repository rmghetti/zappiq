/**
 * /api/billing/meta-costs · Conta Clara beta (Resposta Meta out/2026, PR-J).
 *
 * Extrato do custo Meta por mensagem do mês, calculado do ledger
 * meta_billing_events (metaBillingLedger) × metaRateCard do shared. É a base
 * da seção "Conta Clara" em /billing: total do mês, quebra por categoria e
 * por dia, projeção linear, top conversas e contagem da janela grátis.
 *
 * Query: ?month=YYYY-MM (default: mês corrente em UTC).
 *
 * A tarifa é da Meta e cai na conta do cliente COM a Meta; aqui é
 * acompanhamento a custo, sem markup. Antes de 01/10/2026 a categoria
 * service sai a R$ 0 (vigência do rate card na data de cada evento).
 *
 * Tenancy: filtro explícito por organizationId do JWT, como nas rotas
 * vizinhas (em produção a RLS não filtra sozinha, ver rlsTenant.ts).
 * Privacidade: o telefone do contato NUNCA sai inteiro, só mascarado
 * (maskPhoneBr), padrão "+55 11 9****-4321".
 */
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import {
  computeMetaCosts,
  maskPhoneBr,
  monthRangeUtc,
  parseMonthParam,
  type MetaCostEventRow,
} from './metaCosts.util.js';

const router = Router();

// ── GET /api/billing/meta-costs: extrato do mês ────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'organization context missing' });
      return;
    }

    const month = parseMonthParam(req.query.month);
    if (!month) {
      res.status(400).json({ error: 'month inválido, use o formato YYYY-MM' });
      return;
    }

    const { start, end } = monthRangeUtc(month);

    // Mesma regra de fallback de effectiveEventDate, em forma de filtro
    // indexável: entra no mês quem foi ENTREGUE nele; sem deliveredAt vale o
    // statusTs; sem os dois, o createdAt (índices [org, deliveredAt] e
    // [org, statusTs] cobrem os dois primeiros ramos).
    const rows: MetaCostEventRow[] = await prisma.metaBillingEvent.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { deliveredAt: { gte: start, lt: end } },
          { deliveredAt: null, statusTs: { gte: start, lt: end } },
          { deliveredAt: null, statusTs: null, createdAt: { gte: start, lt: end } },
        ],
      },
      select: {
        category: true,
        billable: true,
        pricingType: true,
        deliveredAt: true,
        statusTs: true,
        createdAt: true,
        conversationId: true,
      },
    });

    const aggregation = computeMetaCosts(month, rows);

    // Join leve pro rótulo humano das top conversas: nome do contato +
    // telefone mascarado. Fail-soft: sem o join, o extrato sai só com ids.
    const conversationIds = aggregation.topConversations.map((t) => t.conversationId);
    const contactByConversation = new Map<string, { name: string | null; phone: string | null }>();
    if (conversationIds.length > 0) {
      const conversations = await prisma.conversation
        .findMany({
          where: { id: { in: conversationIds }, organizationId: orgId },
          select: { id: true, contact: { select: { name: true, phone: true } } },
        })
        .catch(() => []);
      for (const conv of conversations) {
        contactByConversation.set(conv.id, {
          name: conv.contact?.name ?? null,
          phone: conv.contact?.phone ?? null,
        });
      }
    }

    const topConversations = aggregation.topConversations.map((t) => {
      const contact = contactByConversation.get(t.conversationId);
      return {
        ...t,
        contactName: contact?.name ?? null,
        contactPhoneMasked: maskPhoneBr(contact?.phone),
      };
    });

    res.json({ success: true, data: { ...aggregation, topConversations } });
  } catch (err) {
    next(err);
  }
});

export default router;
