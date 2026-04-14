// OTel SDK precisa ser carregado PRIMEIRO — antes de express/http/pg/etc.
// Auto-instrumentations so patcham modulos carregados depois de sdk.start().
import './config/tracing.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { redis } from './utils/redis.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import { initQueues, closeQueues } from './services/queueService.js';
import { prisma } from '@zappiq/database';

// Routes
import authRoutes from './routes/auth.js';
import webhookRoutes from './routes/webhook.js';
import contactsRoutes from './routes/contacts.js';
import conversationsRoutes from './routes/conversations.js';
import messagesRoutes from './routes/messages.js';
import campaignsRoutes from './routes/campaigns.js';
import analyticsRoutes from './routes/analytics.js';
import flowsRoutes from './routes/flows.js';
import knowledgeBaseRoutes from './routes/knowledgeBase.js';
import templatesRoutes from './routes/templates.js';
import dealsRoutes from './routes/deals.js';
import billingRoutes from './routes/billing.js';
import settingsRoutes from './routes/settings.js';
import onboardingRoutes from './routes/onboarding.js';
import stripeWebhookRoutes from './routes/stripeWebhook.js';
import auditLogsRoutes from './routes/auditLogs.js';
import dsrRoutes from './routes/dataSubjectRequests.js';
import { initRetentionJob } from './services/retentionService.js';

const app = express();
const httpServer = createServer(app);

// Trust first proxy (Fly.io) -- required for express-rate-limit behind reverse proxy
app.set('trust proxy', 1);

// ── Socket.io ───────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.NEXT_PUBLIC_APP_URL,
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);

// ── Socket.io JWT authentication middleware ──
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token || typeof token !== 'string') {
    return next(new Error('Authentication required'));
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; organizationId: string };
    (socket as any).userId = decoded.userId;
    (socket as any).organizationId = decoded.organizationId;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  const orgId = (socket as any).organizationId;
  logger.info(`[Socket] Client connected: ${socket.id} (org: ${orgId})`);

  // Auto-join the user's organization room
  if (orgId) socket.join(`org:${orgId}`);

  socket.on('join_org', (requestedOrgId: string) => {
    // Only allow joining own org room
    if (requestedOrgId !== orgId) {
      logger.warn(`[Socket] ${socket.id} tried to join unauthorized org:${requestedOrgId}`);
      return;
    }
    socket.join(`org:${requestedOrgId}`);
    logger.debug(`[Socket] ${socket.id} joined org:${requestedOrgId}`);
  });

  socket.on('agent_typing', (data: { conversationId: string }) => {
    // Broadcast only within the authenticated org room
    socket.to(`org:${orgId}`).emit('agent_typing', data);
  });

  socket.on('disconnect', () => {
    logger.debug(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// ── BullMQ Queues ──────────────────────────────
initQueues().catch((err) => {
  logger.error('[Server] Failed to initialize queues:', err);
});

// ── Stripe Webhook (raw body, must be before express.json) ──
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }), stripeWebhookRoutes);

// ── Global Middleware ────────────────────────────
app.use(helmet());
app.use(cors({ origin: env.NEXT_PUBLIC_APP_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('short', { stream: { write: (msg: string) => logger.info(msg.trim()) } }));

// Global rate limiting (500 req / 15 min on all /api)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// Strict auth rate limiting (10 req / 15 min per IP on login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later' },
});

// ── Health Check ────────────────────────────────
// /health  — liveness: processo vivo, sem dependências externas
// /ready   — readiness: Postgres + Redis OK, pronto para tráfego
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'zappiq-api',
    version: '2.0.0',
    uptime: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
  });
});

app.get('/ready', async (_req, res) => {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};
  let allOk = true;

  // Postgres (via Supabase pooler)
  const pgStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = { ok: true, latencyMs: Date.now() - pgStart };
  } catch (err: any) {
    allOk = false;
    checks.postgres = { ok: false, latencyMs: Date.now() - pgStart, error: err?.message ?? 'unknown' };
  }

  // Redis (Upstash)
  const rdStart = Date.now();
  try {
    const pong = await redis.ping();
    checks.redis = { ok: pong === 'PONG', latencyMs: Date.now() - rdStart };
    if (pong !== 'PONG') allOk = false;
  } catch (err: any) {
    allOk = false;
    checks.redis = { ok: false, latencyMs: Date.now() - rdStart, error: err?.message ?? 'unknown' };
  }

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ready' : 'not_ready',
    service: 'zappiq-api',
    version: '2.0.0',
    uptime: Math.floor(process.uptime()),
    checks,
  });
});

// ── Public Routes ───────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/onboarding', onboardingRoutes);

// ── Protected Routes ────────────────────────────
app.use('/api/contacts', authMiddleware, contactsRoutes);
app.use('/api/conversations', authMiddleware, conversationsRoutes);
app.use('/api/conversations', authMiddleware, messagesRoutes);
app.use('/api/campaigns', authMiddleware, campaignsRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/flows', authMiddleware, flowsRoutes);
app.use('/api/kb', authMiddleware, knowledgeBaseRoutes);
app.use('/api/templates', authMiddleware, templatesRoutes);
app.use('/api/deals', authMiddleware, dealsRoutes);
app.use('/api/billing', authMiddleware, billingRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/audit-logs', authMiddleware, auditLogsRoutes);

// DSR — POST público (titular não é usuário); demais exigem auth interna
app.use('/api/dsr', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/') return next();
  return authMiddleware(req, res, next);
}, dsrRoutes);

// ── LGPD retention job ──────────────────────────
initRetentionJob().catch((err) => {
  logger.error('[Server] Failed to initialize retention job:', err);
});

// ── Error Handler (must be last) ────────────────
app.use(errorHandler);

// ── Start Server ────────────────────────────────
httpServer.listen(env.PORT, () => {
  logger.info(`[Server] ZappIQ API v2 running on port ${env.PORT}`);
  logger.info(`[Server] Environment: ${env.NODE_ENV}`);
  logger.info(`[Server] Health check: http://localhost:${env.PORT}/health`);
});

// ── Graceful shutdown ───────────────────────────
// Ordem: para de aceitar HTTP → fecha Socket.io → drena BullMQ → Prisma → Redis
// Fallback: se algo trava, exit(1) em 30s para não segurar deploy da Fly.
let shuttingDown = false;
async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`[Server] ${signal} received. Draining...`);

  const forceExit = setTimeout(() => {
    logger.error('[Server] Shutdown timeout (30s). Forcing exit.');
    process.exit(1);
  }, 30_000);
  forceExit.unref();

  try {
    // 1) Para de aceitar novas conexões HTTP
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    logger.info('[Server] HTTP server closed');

    // 2) Desconecta Socket.io clients
    io.close();
    logger.info('[Server] Socket.io closed');

    // 3) Drena workers/queues BullMQ
    await closeQueues();

    // 4) Fecha Prisma
    try {
      await prisma.$disconnect();
      logger.info('[Server] Prisma disconnected');
    } catch (err) {
      logger.warn('[Server] Prisma disconnect error:', err);
    }

    // 5) Fecha ioredis
    try {
      await redis.quit();
      logger.info('[Server] Redis quit');
    } catch (err) {
      logger.warn('[Server] Redis quit error:', err);
    }

    clearTimeout(forceExit);
    logger.info('[Server] Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('[Server] Error during shutdown:', err);
    clearTimeout(forceExit);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

export { app, io, httpServer };
