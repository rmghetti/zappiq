import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import redis from '../utils/redis.js';

const router = Router();

function getSince(period: string): Date {
  const map: Record<string, number> = { '24h': 86400000, '7d': 7 * 86400000, '30d': 30 * 86400000 };
  return new Date(Date.now() - (map[period] || map['7d']));
}

// GET /api/analytics/overview
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || '7d';
    const orgId = req.organizationId!;
    const cacheKey = `analytics:overview:${orgId}:${period}`;

    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) { res.json(JSON.parse(cached)); return; }

    const since = getSince(period);

    const [totalMessages, botMessages, openConvos, contacts, closedConvos] = await Promise.all([
      prisma.message.count({ where: { conversation: { organizationId: orgId }, direction: 'INBOUND', createdAt: { gte: since } } }),
      prisma.message.count({ where: { conversation: { organizationId: orgId }, isFromBot: true, createdAt: { gte: since } } }),
      prisma.conversation.count({ where: { organizationId: orgId, status: { in: ['OPEN', 'WAITING', 'ASSIGNED'] } } }),
      prisma.contact.count({ where: { organizationId: orgId, createdAt: { gte: since } } }),
      prisma.conversation.count({ where: { organizationId: orgId, status: 'CLOSED', closedAt: { gte: since } } }),
    ]);

    // Calcular tempo médio de resposta (diff entre mensagem INBOUND e próxima OUTBOUND)
    const responsePairs = await prisma.$queryRaw<{ avg_ms: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (ob.created_at - ib.created_at)) * 1000)::float AS avg_ms
      FROM messages ib
      JOIN messages ob ON ob.conversation_id = ib.conversation_id
        AND ob.direction = 'OUTBOUND'
        AND ob.created_at = (
          SELECT MIN(m2.created_at) FROM messages m2
          WHERE m2.conversation_id = ib.conversation_id
            AND m2.direction = 'OUTBOUND'
            AND m2.created_at > ib.created_at
        )
      JOIN conversations c ON c.id = ib.conversation_id
      WHERE ib.direction = 'INBOUND'
        AND c.organization_id = ${orgId}
        AND ib.created_at >= ${since}
    `;
    const avgResponseTimeMs = Math.round(responsePairs[0]?.avg_ms ?? 0);

    // CSAT médio das conversas que possuem avaliação
    const csatResult = await prisma.conversation.aggregate({
      where: { organizationId: orgId, csatScore: { not: null }, createdAt: { gte: since } },
      _avg: { csatScore: true },
    });
    const csat = csatResult._avg.csatScore
      ? Math.round(csatResult._avg.csatScore * 10) / 10
      : null;

    const data = {
      totalMessages,
      botMessages,
      automationRate: totalMessages > 0 ? Math.round((botMessages / totalMessages) * 100) : 0,
      openConversations: openConvos,
      newContacts: contacts,
      closedConversations: closedConvos,
      avgResponseTimeMs,
      csat,
      period,
    };

    await redis.setex(cacheKey, 300, JSON.stringify(data)).catch(() => {});
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/analytics/agents
router.get('/agents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const agents = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: {
        id: true, name: true, role: true, isOnline: true,
        _count: { select: { assignedConversations: true, messages: true } },
      },
    });
    res.json({ success: true, data: agents });
  } catch (err) { next(err); }
});

// GET /api/analytics/campaigns
router.get('/campaigns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { organizationId: req.organizationId!, status: { in: ['COMPLETED', 'SENDING'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, name: true, status: true,
        sentCount: true, deliveredCount: true, readCount: true, repliedCount: true,
        createdAt: true,
      },
    });
    res.json({ success: true, data: campaigns });
  } catch (err) { next(err); }
});

// GET /api/analytics/sentiment
router.get('/sentiment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || '7d';
    const since = getSince(period);

    const conversations = await prisma.conversation.groupBy({
      by: ['sentiment'],
      where: { organizationId: req.organizationId!, sentiment: { not: null }, createdAt: { gte: since } },
      _count: true,
    });

    res.json({ success: true, data: conversations });
  } catch (err) { next(err); }
});

// GET /api/analytics/heatmap
router.get('/heatmap', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || '7d';
    const since = getSince(period);

    const messages = await prisma.message.findMany({
      where: { conversation: { organizationId: req.organizationId! }, direction: 'INBOUND', createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const heatmap: Record<string, Record<string, number>> = {};
    for (const msg of messages) {
      const d = new Date(msg.createdAt);
      const day = d.toLocaleDateString('en-US', { weekday: 'short' });
      const hour = d.getHours().toString().padStart(2, '0');
      if (!heatmap[day]) heatmap[day] = {};
      heatmap[day][hour] = (heatmap[day][hour] || 0) + 1;
    }

    res.json({ success: true, data: heatmap });
  } catch (err) { next(err); }
});

export default router;
