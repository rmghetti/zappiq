import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { requireRole } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { trainingFieldsChanged } from '../services/trainingChange.js';
import { refreshAIReadiness } from '../services/aiReadinessService.js';
import { logAuditEvent } from '../services/auditService.js';
import { env } from '../config/env.js';
import { randomBytes } from 'node:crypto';
import { checkResourceLimit, resourceLimitBody } from '../middleware/planLimits.js';
import { updateSettingsSchema, redactOrgSecrets, impulsoIntegrationSchema } from './settings.schema.js';
import { encryptSecret } from '../utils/crypto.js';
import { applyImpulsoIntegration, readImpulsoIntegrationStatus } from '../services/impulsoIntegrations.js';
import {
  isDisconnectableChannel,
  buildDisconnectData,
  buildDisconnectSettings,
  deriveChannelHealth,
  type Channel,
  type ChannelHealth,
} from './settings.channels.js';

const router = Router();

const GRAPH_VERSION = env.WHATSAPP_API_VERSION || 'v21.0';

/**
 * Busca quality_rating/status do número WhatsApp na Graph API (best-effort).
 * Nunca lança: qualquer falha (token expirado, número inválido, rede) devolve
 * null e o caller cai no indicador base (conectado/desconectado). É isso que
 * evita o "morre em silêncio" — o cliente vê o estado real do número quando dá,
 * e conectado/desconectado quando não dá.
 */
async function fetchWhatsappNumberHealth(
  phoneNumberId: string,
  accessToken: string,
): Promise<{ qualityRating: string | null; numberStatus: string | null }> {
  try {
    const url =
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}` +
      `?fields=quality_rating,status`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) return { qualityRating: null, numberStatus: null };
    const body = (await r.json().catch(() => ({}))) as any;
    return {
      qualityRating: body?.quality_rating ?? null,
      numberStatus: body?.status ?? null,
    };
  } catch {
    return { qualityRating: null, numberStatus: null };
  }
}

// ── Organization Settings ───────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.organizationId! } });
    if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
    // W1.3: nunca vazar segredos de canal (whatsapp/instagram token, metaAppSecret).
    res.json({ success: true, data: redactOrgSecrets(org) });
  } catch (err) { next(err); }
});

router.put('/', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    // W1.3: whitelist .strict() — bloqueia mass assignment de plan/trial/
    // subscription/stripe*/quota. Campo desconhecido → 400 (nunca ignora em
    // silêncio, pra o cliente não achar que "funcionou").
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid settings payload', details: parsed.error.flatten() });
      return;
    }
    const data = parsed.data;
    const before = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
    const org = await prisma.organization.update({
      where: { id: orgId },
      data,
    });
    // Maestro reativo: identidade/treino mudou → marca os fluxos como desatualizados
    const newSettings = data.settings;
    if (newSettings && trainingFieldsChanged((before?.settings as any) || {}, newSettings)) {
      await refreshAIReadiness(orgId).catch(() => null);
    }
    // Consistência com o GET: resposta também sem segredos.
    res.json({ success: true, data: redactOrgSecrets(org) });
  } catch (err) { next(err); }
});

// ── Zap Impulso — integrações (Meta CAPI + Asaas Pix) ───────────────
// O cliente configura, no próprio dashboard, as credenciais do Loop de Receita:
// dataset id + access token do Meta CAPI e a API key do Asaas para Pix na
// conversa. Os segredos são CIFRADOS no servidor (encryptSecret) antes de ir pro
// banco — nunca trafegam nem repousam em claro, e o GET só devolve booleanos de
// status + o dataset id (público) + o token de webhook (que o cliente cola no
// painel do Asaas). Regra: segredo não passa em claro em lugar nenhum.

// GET /api/settings/integrations/zap-impulso — status (sem vazar segredo).
router.get('/integrations/zap-impulso', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId! },
      select: { settings: true },
    });
    res.json({ success: true, data: readImpulsoIntegrationStatus(org?.settings) });
  } catch (err) { next(err); }
});

// PUT /api/settings/integrations/zap-impulso — grava/atualiza credenciais.
// Recebe texto puro; cifra no servidor; mescla em settings; devolve só status.
router.put('/integrations/zap-impulso', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const parsed = impulsoIntegrationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Payload de integração inválido', details: parsed.error.flatten() });
      return;
    }
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
    const nextSettings = applyImpulsoIntegration(org?.settings as any, parsed.data, {
      encrypt: encryptSecret,
      genToken: () => randomBytes(24).toString('hex'),
    });
    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: { settings: nextSettings },
      select: { settings: true },
    });
    logger.info(`[Impulso] integrações atualizadas org=${orgId}`);
    res.json({ success: true, data: readImpulsoIntegrationStatus(updated.settings) });
  } catch (err) { next(err); }
});

// ── Channel Health + Disconnect (FEATURE 5b.3) ──────────────
// GET /api/settings/channels/health — indicador de saúde por canal.
// Base: presença de credencial na org (conectado/desconectado). Enriquecimento:
// pro WhatsApp, tenta buscar quality_rating/status do número na Graph API
// (best-effort; se falhar, fica só o base).
router.get('/channels/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.organizationId! } });
    if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
    const health = deriveChannelHealth(org as any);

    // Enriquecimento ao vivo só do WhatsApp (Graph expõe quality_rating do número).
    const o = org as any;
    if (health.whatsapp.connected && o.whatsappPhoneNumberId && o.whatsappAccessToken) {
      const live = await fetchWhatsappNumberHealth(o.whatsappPhoneNumberId, o.whatsappAccessToken);
      health.whatsapp.qualityRating = live.qualityRating;
      health.whatsapp.numberStatus = live.numberStatus;
    }

    const list: ChannelHealth[] = [health.whatsapp, health.instagram];
    res.json({ success: true, data: list });
  } catch (err) { next(err); }
});

// POST /api/settings/channels/:channel/disconnect — revoga (zera) as credenciais
// do canal na org. LGPD/troca-de-número: sem token, a ZappIQ para de usar o
// canal na hora. Só ADMIN. Idempotente: desconectar já-desconectado é 200.
router.post('/channels/:channel/disconnect', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = String(req.params.channel || '').toLowerCase();
    if (!isDisconnectableChannel(raw)) {
      res.status(400).json({ error: `Canal inválido: ${req.params.channel}. Use 'whatsapp' ou 'instagram'.` });
      return;
    }
    const channel: Channel = raw;
    const orgId = req.organizationId!;

    const current = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!current) { res.status(404).json({ error: 'Organization not found' }); return; }

    const now = new Date().toISOString();
    const clearedCreds = buildDisconnectData(channel);
    const newSettings = buildDisconnectSettings(channel, (current.settings as any) || {}, now);

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: { ...clearedCreds, settings: newSettings } as any,
    });

    // Trilha de auditoria: revogação de credencial é evento relevante (LGPD/segurança).
    // Nunca logamos o token — só o fato + qual canal.
    await logAuditEvent(req, {
      action: 'channel.disconnect',
      resource: 'organization',
      resourceId: orgId,
      details: { channel },
    }).catch(() => null);

    // Canal desconectado muda o AI Readiness (score de canais conectados).
    await refreshAIReadiness(orgId).catch(() => null);

    logger.info('[settings/channels] desconectado', { orgId, channel });
    res.json({ success: true, channel, data: redactOrgSecrets(org) });
  } catch (err) { next(err); }
});

// ── Team Management ─────────────────────────────
router.get('/team', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.organizationId! },
      select: { id: true, email: true, name: true, role: true, avatar: true, isOnline: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

router.post('/team', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name, role, password } = req.body;
    if (!email || !name || !password) {
      res.status(400).json({ error: 'email, name, and password are required' });
      return;
    }

    // Camada 2 — limite de atendentes/seats (plano + addon AGENT_SEAT). audit default.
    const seatCount = await prisma.user.count({ where: { organizationId: req.organizationId! } });
    const seatDec = await checkResourceLimit(req.organizationId!, 'agents', seatCount);
    if (!seatDec.allowed) {
      res.status(429).json(resourceLimitBody('agents', seatDec));
      return;
    }

    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        role: role || 'AGENT',
        passwordHash,
        organizationId: req.organizationId!,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    res.status(201).json({ success: true, data: user });
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ error: 'Email already exists' }); return; }
    next(err);
  }
});

router.put('/team/:userId', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, role } = req.body;
    const user = await prisma.user.updateMany({
      where: { id: req.params.userId, organizationId: req.organizationId! },
      data: { ...(name && { name }), ...(role && { role }) },
    });
    if (user.count === 0) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/team/:userId', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.userId === req.user!.userId) {
      res.status(400).json({ error: 'Cannot delete yourself' });
      return;
    }
    const result = await prisma.user.deleteMany({ where: { id: req.params.userId, organizationId: req.organizationId! } });
    if (result.count === 0) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ success: true, message: 'User removed' });
  } catch (err) { next(err); }
});

export default router;
