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
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import { initQueues, closeQueues } from './services/queueService.js';

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
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'zappiq-api',
    version: '2.0.0',
    uptime: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
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

// ── Error Handler (must be last) ────────────────
app.use(errorHandler);

// ── Start Server ────────────────────────────────
httpServer.listen(env.PORT, () => {
  logger.info(`[Server] ZappIQ API v2 running on port ${env.PORT}`);
  logger.info(`[Server] Environment: ${env.NODE_ENV}`);
  logger.info(`[Server] Health check: http://localhost:${env.PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[Server] SIGTERM received. Shutting down...');
  await closeQueues();
  httpServer.close(() => process.exit(0));
});

export { app, io, httpServer };
