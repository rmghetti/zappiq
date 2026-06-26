import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import redis from '../utils/redis.js';
import { generatePulseInsight } from '../services/analyticsPulse.js';

const router = Router();

function getSince(period: string): Date {
  const map: Record<string, number> = { '24h': 86400000, '7d': 7 * 86400000, '30d': 30 * 86400000 };
  return new Date(Date.now() - (map[period] || map['7d']));
}

// Janela [since, until). Suporta período pré-definido (24h/7d/30d) OU intervalo
// customizado via from/to ('YYYY-MM-DD', inclusivo no dia final).
function getRange(q: any): { since: Date; until: Date; label: string } {
  const from = typeof q.from === 'string' ? q.from : '';
  const to = typeof q.to === 'string' ? q.to : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const since = new Date(`${from}T00:00:00.000Z`);
    const until = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86400000);
    if (!isNaN(since.getTime()) && !isNaN(until.getTime()) && until > since) {
      return { since, until, label: `${from}_${to}` };
    }
  }
  const period = typeof q.period === 'string' ? q.period : '7d';
  const map: Record<string, number> = { '24h': 86400000, '7d': 7 * 86400000, '30d': 30 * 86400000 };
  const until = new Date();
  const since = new Date(until.getTime() - (map[period] || map['7d']));
  return { since, until, label: period };
}

// GET /api/analytics/overview
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const { since, until, label } = getRange(req.query);
    const cacheKey = `analytics:overview:v4:${orgId}:${label}`;

    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) { res.json(JSON.parse(cached)); return; }

    const [totalMessages, botMessages, openConvos, contacts, closedConvos, aiResolved, humanResolved] = await Promise.all([
      prisma.message.count({ where: { conversation: { organizationId: orgId }, direction: 'INBOUND', createdAt: { gte: since, lt: until } } }),
      prisma.message.count({ where: { conversation: { organizationId: orgId }, isFromBot: true, createdAt: { gte: since, lt: until } } }),
      prisma.conversation.count({ where: { organizationId: orgId, status: { in: ['OPEN', 'WAITING', 'ASSIGNED'] } } }),
      prisma.contact.count({ where: { organizationId: orgId, createdAt: { gte: since, lt: until } } }),
      prisma.conversation.count({ where: { organizationId: orgId, status: 'CLOSED', closedAt: { gte: since, lt: until } } }),
      // Resolvido pela IA = fechada sem nenhum humano atribuído (mesma semântica do TenantUsageMonthly).
      prisma.conversation.count({ where: { organizationId: orgId, status: 'CLOSED', closedAt: { gte: since, lt: until }, assignedToId: null } }),
      prisma.conversation.count({ where: { organizationId: orgId, status: 'CLOSED', closedAt: { gte: since, lt: until }, assignedToId: { not: null } } }),
    ]);

    // Tempo de resposta (diff INBOUND → próxima OUTBOUND): média + p95.
    const responseStats = await prisma.$queryRaw<{ avg_ms: number | null; p95_ms: number | null }[]>`
      WITH pairs AS (
        SELECT EXTRACT(EPOCH FROM (ob.created_at - ib.created_at)) * 1000 AS ms
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
          AND ib.created_at < ${until}
      )
      SELECT AVG(ms)::float AS avg_ms,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY ms)::float AS p95_ms
      FROM pairs
    `;
    const avgResponseTimeMs = Math.round(responseStats[0]?.avg_ms ?? 0);
    const p95ResponseTimeMs = Math.round(responseStats[0]?.p95_ms ?? 0);

    // Volume por dia (ou por hora se janela <= 2 dias). Série temporal real —
    // serve o gráfico (inclusive períodos custom) e o drill-down por data.
    const rangeMs = until.getTime() - since.getTime();
    const byHour = rangeMs <= 2 * 86400000;
    const truncUnit = byHour ? 'hour' : 'day';
    const fmt = byHour ? 'YYYY-MM-DD"T"HH24' : 'YYYY-MM-DD';
    const volRows = await prisma.$queryRawUnsafe<{ bucket: string; cnt: number }[]>(
      `SELECT to_char(date_trunc('${truncUnit}', m.created_at), '${fmt}') AS bucket, COUNT(*)::int AS cnt
       FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE c.organization_id = $1 AND m.direction = 'INBOUND' AND m.created_at >= $2 AND m.created_at < $3
       GROUP BY 1 ORDER BY 1`,
      orgId, since, until,
    );
    const volumeByDay = volRows.map((r) => ({ bucket: r.bucket, count: Number(r.cnt) }));

    const csatResult = await prisma.conversation.aggregate({
      where: { organizationId: orgId, csatScore: { not: null }, createdAt: { gte: since, lt: until } },
      _avg: { csatScore: true },
    });
    const csat = csatResult._avg.csatScore ? Math.round(csatResult._avg.csatScore * 10) / 10 : null;

    const totalResolved = aiResolved + humanResolved;

    // Período anterior (mesma duração, imediatamente antes) para os deltas.
    const prevUntil = since;
    const prevSince = new Date(since.getTime() - rangeMs);
    const [pTotal, pBot, pContacts, pClosed, pAiResolved, pHumanResolved, pCsatAgg] = await Promise.all([
      prisma.message.count({ where: { conversation: { organizationId: orgId }, direction: 'INBOUND', createdAt: { gte: prevSince, lt: prevUntil } } }),
      prisma.message.count({ where: { conversation: { organizationId: orgId }, isFromBot: true, createdAt: { gte: prevSince, lt: prevUntil } } }),
      prisma.contact.count({ where: { organizationId: orgId, createdAt: { gte: prevSince, lt: prevUntil } } }),
      prisma.conversation.count({ where: { organizationId: orgId, status: 'CLOSED', closedAt: { gte: prevSince, lt: prevUntil } } }),
      prisma.conversation.count({ where: { organizationId: orgId, status: 'CLOSED', closedAt: { gte: prevSince, lt: prevUntil }, assignedToId: null } }),
      prisma.conversation.count({ where: { organizationId: orgId, status: 'CLOSED', closedAt: { gte: prevSince, lt: prevUntil }, assignedToId: { not: null } } }),
      prisma.conversation.aggregate({ where: { organizationId: orgId, csatScore: { not: null }, createdAt: { gte: prevSince, lt: prevUntil } }, _avg: { csatScore: true } }),
    ]);
    const pTotalResolved = pAiResolved + pHumanResolved;
    const prev = {
      automationRate: pTotal > 0 ? Math.round((pBot / pTotal) * 100) : 0,
      aiResolvedRate: pTotalResolved > 0 ? Math.round((pAiResolved / pTotalResolved) * 100) : 0,
      newContacts: pContacts,
      closedConversations: pClosed,
      csat: pCsatAgg._avg.csatScore != null ? Math.round(pCsatAgg._avg.csatScore * 10) / 10 : null,
    };

    const data = {
      totalMessages,
      botMessages,
      automationRate: totalMessages > 0 ? Math.round((botMessages / totalMessages) * 100) : 0,
      openConversations: openConvos,
      newContacts: contacts,
      closedConversations: closedConvos,
      aiResolved,
      humanResolved,
      aiResolvedRate: totalResolved > 0 ? Math.round((aiResolved / totalResolved) * 100) : 0,
      avgResponseTimeMs,
      p95ResponseTimeMs,
      csat,
      prev,
      volumeByDay,
      granularity: byHour ? 'hour' : 'day',
      rangeStart: since.toISOString(),
      rangeEnd: until.toISOString(),
      period: label,
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
    const { since, until } = getRange(req.query);

    const conversations = await prisma.conversation.groupBy({
      by: ['sentiment'],
      where: { organizationId: req.organizationId!, sentiment: { not: null }, createdAt: { gte: since, lt: until } },
      _count: true,
    });

    res.json({ success: true, data: conversations });
  } catch (err) { next(err); }
});

// GET /api/analytics/heatmap
router.get('/heatmap', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { since, until } = getRange(req.query);

    const messages = await prisma.message.findMany({
      where: { conversation: { organizationId: req.organizationId! }, direction: 'INBOUND', createdAt: { gte: since, lt: until } },
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

// GET /api/analytics/drilldown — abre os dados por trás de um ponto do analytics.
//   kind=messages&start=ISO&end=ISO              → mensagens da janela (clique no gráfico de volume)
//   kind=conversations&sentiment=X&start&end     → conversas (clique numa fatia de sentimento)
router.get('/drilldown', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const kind = (req.query.kind as string) || 'messages';
    const start = req.query.start ? new Date(String(req.query.start)) : null;
    const end = req.query.end ? new Date(String(req.query.end)) : null;
    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      res.status(400).json({ success: false, error: 'parâmetros start/end inválidos' });
      return;
    }

    if (kind === 'conversations') {
      const sentiment = req.query.sentiment as string | undefined;
      const items = await prisma.conversation.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          ...(sentiment ? { sentiment: sentiment as any } : {}),
          createdAt: { gte: start, lt: end },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true, status: true, sentiment: true, createdAt: true,
          contact: { select: { name: true, phone: true } },
          _count: { select: { messages: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, direction: true, createdAt: true } },
        },
      });
      res.json({ success: true, data: { kind, items } });
      return;
    }

    const items = await prisma.message.findMany({
      where: { conversation: { organizationId: orgId }, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, direction: true, isFromBot: true, type: true, content: true, createdAt: true,
        conversation: { select: { id: true, contact: { select: { name: true, phone: true } } } },
      },
    });
    res.json({ success: true, data: { kind: 'messages', items } });
  } catch (err) { next(err); }
});

// GET /api/analytics/insights — último insight "Pulso" da org
router.get('/insights', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const insight = await prisma.analyticsInsight.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: insight });
  } catch (err) { next(err); }
});

// POST /api/analytics/insights/refresh — gera o insight do dia sob demanda
// (para o cliente ver o Pulso na hora, sem esperar o cron noturno).
router.post('/insights/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    // Dia de referência = ontem por padrão (já fechado); ?today=1 força hoje.
    const ref = req.query.today === '1' ? new Date() : new Date(Date.now() - 86400000);
    await generatePulseInsight(orgId, ref);
    const insight = await prisma.analyticsInsight.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: insight });
  } catch (err) { next(err); }
});

export default router;
