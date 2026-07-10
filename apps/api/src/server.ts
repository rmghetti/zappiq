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
import { rlsTenantMiddleware } from './middleware/rlsTenant.js';
import { requireActivePlan } from './middleware/requireActivePlan.js'; // Trial Enforcement — gate de trial vencido (402)
import { initQueues, closeQueues } from './services/queueService.js';
import { initFlowTimerWorker } from './services/flowScheduler.js';
import { setIo } from './utils/socketRegistry.js';
import { prisma } from '@zappiq/database';

// Routes
import authRoutes from './routes/auth.js';
import webhookRoutes from './routes/webhook.js';
// FASE 4 (#251) — Instagram Direct webhook (mesma estrutura do WhatsApp)
import webhookInstagramRoutes from './routes/webhookInstagram.js';
import contactsRoutes from './routes/contacts.js';
import conversationsRoutes from './routes/conversations.js';
import messagesRoutes from './routes/messages.js';
import campaignsRoutes from './routes/campaigns.js';
import impulsoRoutes from './routes/impulso.js';
import impulsoAccessRoutes from './routes/impulsoAccess.js';
import { requireImpulso } from './middleware/requireImpulso.js';
import analyticsRoutes from './routes/analytics.js';
import flowsRoutes from './routes/flows.js';
import flowTemplatesRoutes from './routes/flowTemplates.js';
import knowledgeBaseRoutes from './routes/knowledgeBase.js';
import aiTrainingRoutes from './routes/aiTraining.js'; // PR #106.1 — readiness score + KB upload + Q&A + identity
import izaAjudaRoutes from './routes/izaAjuda.js'; // Fase 2 — chat de suporte da plataforma
import appointmentsRoutes from './routes/appointments.js'; // Agendamento — agenda interna (hub)
import integrationsGoogleRoutes from './routes/integrationsGoogle.js'; // Agendamento — OAuth Google Calendar
import templatesRoutes from './routes/templates.js';
import dealsRoutes from './routes/deals.js';
import crmRoutes from './routes/crm.js'; // PR #217 — métricas executivas /api/crm/metrics
import tasksRoutes from './routes/tasks.js'; // FEATURE 5b.5 — tela de Tarefas / follow-ups da IA
import billingRoutes from './routes/billing.js';
import settingsRoutes from './routes/settings.js';
import onboardingRoutes from './routes/onboarding.js';
import embeddedSignupRoutes from './routes/embeddedSignup.js'; // #273/#274 — callbacks OAuth WA/IG Embedded Signup
import stripeWebhookRoutes from './routes/stripeWebhook.js';
import auditLogsRoutes from './routes/auditLogs.js';
import dsrRoutes from './routes/dataSubjectRequests.js';
import adminWhatsappRoutes from './routes/adminWhatsapp.js';
import adminOrganizationsRoutes from './routes/adminOrganizations.js'; // PR #218.1 — montar endpoint admin orgs (era órfão)
import adminCouponsRoutes from './routes/adminCoupons.js'; // 2026-07-08 — cupons de desconto (SUPERADMIN)
import adminLlmRoutes from './routes/adminLlm.js'; // V2-025 Observability DAY 1
import adminLeadsIzaRoutes from './routes/adminLeadsIza.js'; // 2026-05-11 leads + iza-conversations
import adminLlmStreamRoutes from './routes/adminLlmStream.js'; // PR #V4-004 streaming SSE test
import adminAgentEvalRoutes from './routes/adminAgentEval.js'; // V3 #235 agent eval contínuo
import agentQualityRoutes from './routes/agentQuality.js'; // FASE 2.2b #244 — versão cliente Qualidade do Agente
import adminOnboardingJourneyRoutes from './routes/adminOnboardingJourney.js'; // FASE 1.B #240 onboarding D+1/D+3/D+7
import adminClientesRoutes from './routes/adminClientes.js'; // Área Clientes Fase 2 — Visão Geral + 360 + financeiro
import webChatRoutes from './routes/webChat.js'; // FASE 4 P7 #263 — chat in-page site usa Iza real
import adminIzaFactsRoutes from './routes/adminIzaFacts.js'; // FASE 4 P7+ Admin Camada 2 CRUD
import { initRetentionJob } from './services/retentionService.js';
import { bootstrapFlowTemplatesIfEmpty } from './bootstrap/seedFlowTemplates';

import { initTenantUsageJob } from './services/tenantUsageService.js'; // PR #149 — H10 unit economics
import { initUsageReconciliationJob } from './services/usageReconciliationService.js'; // PR #149 — Quota Mgmt #6 audit-only
import { initTrialFollowupJob } from './services/trialFollowupService.js'; // FASE 1.B #240 — onboarding D+1/D+3/D+7
import { initAgentEvalCronJob } from './services/agentEvalCronService.js'; // FASE 2 / V5 #241 — eval diário + Slack alert
import { initAnalyticsPulseCronJob } from './services/analyticsPulseCron.js'; // Analytics Pulso — insight diário por org
import { initCampaignSchedulerCronJob } from './services/campaignSchedulerCron.js'; // W2.4 — dispara campanhas agendadas
import { initTrialExpirationCronJob } from './services/trialExpirationCron.js'; // Área Clientes Fase 1 — fecha trials vencidos + recomputa lifecycleStage
import { initSuperadminTrialDigestJob } from './services/superadminTrialDigestCron.js'; // Trial Enforcement — digest diário ao CEO (e-mail + Slack)

const app = express();
const httpServer = createServer(app);

// Trust first proxy (Fly.io) -- required for express-rate-limit behind reverse proxy
app.set('trust proxy', 1);

// ── CORS allowlist ──────────────────────────────────────
// Permite producao (NEXT_PUBLIC_APP_URL) + Vercel Previews (qualquer subdomain
// que combine com o padrao zappiq-*-zappiq.vercel.app ou zappiq-git-*.vercel.app).
// Sem isso, smoke E2E em Preview falha com "Failed to fetch" (CORS rejection).
const ALLOWED_ORIGIN_PATTERNS: Array<string | RegExp> = [
  env.NEXT_PUBLIC_APP_URL,
  'https://zappiq.com.br',
  'https://www.zappiq.com.br',
  /^https:\/\/zappiq-git-[a-z0-9-]+-zappiq\.vercel\.app$/, // branch alias previews
  /^https:\/\/zappiq-[a-z0-9]+-zappiq\.vercel\.app$/, // deployment hash previews
];

function corsOriginCheck(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  // Server-to-server, healthchecks, curl sem Origin: permitir.
  if (!origin) return callback(null, true);
  const ok = ALLOWED_ORIGIN_PATTERNS.some((p) =>
    typeof p === 'string' ? p === origin : p.test(origin),
  );
  if (ok) return callback(null, true);
  callback(new Error(`CORS: origin ${origin} not allowed`));
}

// ── Socket.io ───────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: corsOriginCheck,
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);

// W2.1: expõe o io por singleton de módulo pra que o BullMQ worker (mesmo
// processo, mas fora do contexto Express) consiga emitir new_message/notification.
// Sem isso o worker passava io: undefined e o inbox só atualizava com F5.
setIo(io);

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

// Maestro v2 — worker de timers de fluxo (wait/schedule)
try {
  initFlowTimerWorker();
} catch (err) {
  logger.error('[Server] Failed to initialize flow-timer worker:', err);
}

// ── Stripe Webhook (raw body, must be before express.json) ──
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }), stripeWebhookRoutes);

// ── Instagram Webhook POST (raw body, must be before express.json) ──
// FASE 4 (#251): mesma assinatura HMAC da Meta — precisa de raw body pra validar
app.use('/api/webhook/instagram', express.raw({ type: 'application/json', limit: '10mb' }));

// ── WhatsApp Webhook POST (raw body, must be before express.json) ──
// Necessario para validar HMAC X-Hub-Signature-256 byte-a-byte com o payload
// original que a Meta assinou. Se for parseado pelo express.json, JSON.stringify
// volta diferente (ordem de chaves, espacos) e a assinatura nunca bate.
app.use('/api/webhook/whatsapp', express.raw({ type: 'application/json', limit: '10mb' }));

// ── Global Middleware ────────────────────────────
app.use(helmet());
app.use(cors({ origin: corsOriginCheck, credentials: true }));
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
// FASE 4 P7 (#263): chat in-page do site (zappiq.com.br) — público, sem auth,
// rate-limit dedicado. Usa MESMA Iza do WhatsApp (system prompt v7.6 + cascade).
app.use('/api/web-chat', webChatRoutes);
app.use('/api/webhook', webhookRoutes);
// FASE 4 (#251): Instagram Direct webhook montado na MESMA path mãe; o Express
// resolve por sub-path (/whatsapp vs /instagram).
app.use('/api/webhook', webhookInstagramRoutes);
app.use('/api/onboarding', onboardingRoutes);

// ── Admin diagnostics (auth via header X-Admin-Secret == META_APP_SECRET) ─
app.use('/api/admin/whatsapp', adminWhatsappRoutes);
app.use('/api/admin/organizations', adminOrganizationsRoutes); // PR #218.1 — montar admin orgs pra OrgSwitcher
app.use('/api/admin/coupons', adminCouponsRoutes); // 2026-07-08 — cupons de desconto (SUPERADMIN)
app.use('/api/admin', adminLlmRoutes); // V2-025: GET /api/admin/llm-status
app.use('/api/admin', adminLeadsIzaRoutes); // 2026-05-11: /admin/leads + /admin/iza-conversations
app.use('/api/admin', adminIzaFactsRoutes); // FASE 4 P7+ : /admin/iza-facts CRUD Camada 2
app.use('/api/admin', adminLlmStreamRoutes); // PR #V4-004: /admin/llm-stream-test (SSE)
app.use('/api/admin/agent-eval', adminAgentEvalRoutes); // V3 #235: golden set + judge
app.use('/api/admin/onboarding-journey', adminOnboardingJourneyRoutes); // FASE 1.B #240: trigger + state
app.use('/api/admin/clientes', adminClientesRoutes); // Área Clientes Fase 2: lista + 360 + financeiro + owner + backfill

// ── Client-facing Qualidade do Agente (FASE 2.2b #244) ─
// authMiddleware aplicado dentro da própria route + RLS por organizationId.
app.use('/api/agent-quality', agentQualityRoutes);

// ── Protected Routes (auth + RLS tenant isolation + gate de trial vencido) ─
// requireActivePlan (Trial Enforcement) bloqueia (402) orgs sem plano pago ativo,
// EXCETO /api/billing (precisa ficar acessível pra pessoa escolher/pagar um plano).
// /api/auth, /api/onboarding, /api/dsr (direito LGPD) e /api/admin/* ficam fora por design.
app.use('/api/contacts', authMiddleware, rlsTenantMiddleware, requireActivePlan, contactsRoutes);
app.use('/api/conversations', authMiddleware, rlsTenantMiddleware, requireActivePlan, conversationsRoutes);
app.use('/api/conversations', authMiddleware, rlsTenantMiddleware, requireActivePlan, messagesRoutes);
app.use('/api/campaigns', authMiddleware, rlsTenantMiddleware, requireActivePlan, campaignsRoutes);
// Impulso — acesso/entitlement + trial do add-on. Passa pelo requireActivePlan (só
// cliente com plano/trial da plataforma ativo), mas NÃO por requireImpulso: todo cliente
// ativo consulta o status e pode ativar o teste de 7 dias do Impulso.
app.use('/api/impulso-access', authMiddleware, rlsTenantMiddleware, requireActivePlan, impulsoAccessRoutes);
// Impulso — features (gated por requireImpulso: precisa do add-on/trial/alpha do Impulso ativo).
app.use('/api/impulso', authMiddleware, rlsTenantMiddleware, requireActivePlan, requireImpulso(), impulsoRoutes);
app.use('/api/analytics', authMiddleware, rlsTenantMiddleware, requireActivePlan, analyticsRoutes);
// IMPORTANT: /api/flows/templates MUST be mounted before /api/flows, otherwise
// GET /api/flows/templates would be captured by GET /:id in flowsRoutes (id="templates")
// and return 404 'Flow not found' instead of the templates list.
app.use('/api/flows/templates', authMiddleware, rlsTenantMiddleware, requireActivePlan, flowTemplatesRoutes);
app.use('/api/flows', authMiddleware, rlsTenantMiddleware, requireActivePlan, flowsRoutes);
app.use('/api/kb', authMiddleware, rlsTenantMiddleware, requireActivePlan, knowledgeBaseRoutes);
app.use('/api/ai-training', authMiddleware, rlsTenantMiddleware, requireActivePlan, aiTrainingRoutes); // PR #106.1
// Iza Ajuda (Fase 2): ajuda de plataforma disponivel a qualquer cliente logado,
// inclusive trial/vencido (sem requireActivePlan de proposito).
app.use('/api/iza-ajuda', authMiddleware, rlsTenantMiddleware, izaAjudaRoutes);
app.use('/api/templates', authMiddleware, rlsTenantMiddleware, requireActivePlan, templatesRoutes);
app.use('/api/deals', authMiddleware, rlsTenantMiddleware, requireActivePlan, dealsRoutes);
app.use('/api/crm', authMiddleware, rlsTenantMiddleware, requireActivePlan, crmRoutes); // PR #217 CRM 3a — métricas executivas
app.use('/api/appointments', authMiddleware, rlsTenantMiddleware, requireActivePlan, appointmentsRoutes); // Agendamento — agenda interna (hub)
// Integração Google: auth aplicada por-rota (o /callback é público — redirect do
// browser sem nosso token, validado por state assinado).
app.use('/api/integrations/google', integrationsGoogleRoutes);
app.use('/api/tasks', authMiddleware, rlsTenantMiddleware, requireActivePlan, tasksRoutes); // FEATURE 5b.5 — tela de Tarefas / follow-ups da IA
app.use('/api/billing', authMiddleware, rlsTenantMiddleware, billingRoutes); // SEM gate: paywall precisa ser acessível
app.use('/api/settings', authMiddleware, rlsTenantMiddleware, requireActivePlan, settingsRoutes);
app.use('/api/audit-logs', authMiddleware, rlsTenantMiddleware, requireActivePlan, auditLogsRoutes);
app.use('/api/embedded-signup', authMiddleware, rlsTenantMiddleware, requireActivePlan, embeddedSignupRoutes); // #273/#274

// DSR — POST público (titular não é usuário); demais exigem auth + RLS.
// Rate-limit dedicado e agressivo nos endpoints públicos (sem auth): protege
// contra abuso já que não há sessão para atribuir a cota.
const dsrPublicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas solicitações. Tente novamente mais tarde.' },
});
const DSR_PUBLIC_PATHS = new Set(['/', '/public']);
app.use('/api/dsr', (req, res, next) => {
  const isPublicPost = req.method === 'POST' && DSR_PUBLIC_PATHS.has(req.path);
  // Consulta pública de protocolo (titular acompanha status sem login).
  const isProtocolLookup = req.method === 'GET' && req.path.startsWith('/protocol/');
  if (isPublicPost || isProtocolLookup) {
    return dsrPublicLimiter(req, res, next);
  }
  authMiddleware(req, res, (err?: any) => {
    if (err) return next(err);
    rlsTenantMiddleware(req, res, next);
  });
}, dsrRoutes);

// ── LGPD retention job ──────────────────────────
initRetentionJob().catch((err) => {
  logger.error('[Server] Failed to initialize retention job:', err);
});

// ── PR #149: H10 unit economics (03:10 UTC) — estava órfão, wire-up agora ──
initTenantUsageJob().catch((err) => {
  logger.error('[Server] Failed to initialize tenant usage job:', err);
});

// ── PR #149: Quota Mgmt #6 reconciliação (04:00 UTC, audit-only Fase 1) ──
initUsageReconciliationJob().catch((err) => {
  logger.error('[Server] Failed to initialize usage reconciliation job:', err);
});

// ── FASE 1.B #240: trial onboarding journey D+1/D+3/D+7 (14:00 UTC daily) ──
initTrialFollowupJob().catch((err) => {
  logger.error('[Server] Failed to initialize trial followup job:', err);
});

// ── FASE 2 / V5 #241: agent eval cron diário + Slack alert (04:30 UTC daily) ──
initAgentEvalCronJob().catch((err) => {
  logger.error('[Server] Failed to initialize agent eval cron job:', err);
});

// ── Analytics "Pulso" cron diário (03:20 UTC) — insight narrado por org ──
initAnalyticsPulseCronJob().catch((err) => {
  logger.error('[Server] Failed to initialize analytics pulse cron job:', err);
});

// ── Área Clientes Fase 1: expiração de trial + recompute lifecycle (03:40 UTC) ──
initTrialExpirationCronJob().catch((err) => {
  logger.error('[Server] Failed to initialize trial expiration cron job:', err);
});

// ── W2.4: sweep de campanhas agendadas (a cada minuto) — dispara SCHEDULED ──
initCampaignSchedulerCronJob().catch((err) => {
  logger.error('[Server] Failed to initialize campaign scheduler cron job:', err);
});

// ── Trial Enforcement: digest diário ao superadmin (13:00 UTC) — e-mail + Slack ──
initSuperadminTrialDigestJob().catch((err) => {
  logger.error('[Server] Failed to initialize superadmin trial digest cron job:', err);
});

// ── Error Handler (must be last) ────────────────
app.use(errorHandler);

// ── Start Server ────────────────────────────────
// Auto-seed flow_templates se vazia (bootstrap idempotente)
bootstrapFlowTemplatesIfEmpty().catch((err) => console.error('[bootstrap] error:', err));

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

    // 3b) Fecha workers/queues PR #149 (tenant usage + reconciliação)
    try {
      const { closeTenantUsageJob } = await import('./services/tenantUsageService.js');
      const { closeUsageReconciliationJob } = await import('./services/usageReconciliationService.js');
      await Promise.all([closeTenantUsageJob(), closeUsageReconciliationJob()]);
      logger.info('[Server] PR #149 jobs closed');
    } catch (err) {
      logger.warn('[Server] PR #149 jobs close error:', err);
    }

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
