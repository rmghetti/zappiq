/**
 * Integração Google Calendar — OAuth por organização (self-service).
 *
 * Fluxo: cliente clica "Conectar" no dashboard → /connect (auth) devolve a URL
 * de consentimento com um `state` assinado (carrega o orgId) → Google redireciona
 * o browser pra /callback (SEM nosso token) → validamos o state, trocamos o
 * código e salvamos os tokens na conexão DAQUELA org.
 *
 * O callback é público de propósito (redirect do browser), mas só aceita um
 * state assinado por nós (JWT curto), então ninguém liga a agenda de outra org.
 */
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  isGoogleConfigured, buildAuthUrl, exchangeCode, saveConnection,
  hasActiveConnection, disconnect,
} from '../services/googleCalendar.js';
import { prisma } from '@zappiq/database';

const router = Router();

const APP_URL = env.NEXT_PUBLIC_APP_URL || 'https://zappiq.com.br';

// GET /connect — devolve a URL de consentimento (org autenticada).
router.get('/connect', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isGoogleConfigured()) {
      res.status(503).json({ error: 'google_nao_configurado', message: 'Integração Google indisponível no momento.' });
      return;
    }
    const orgId = req.user!.organizationId;
    // state assinado (10 min) carrega o orgId — impede ligar agenda em org alheia.
    const state = jwt.sign({ orgId, kind: 'gcal' }, env.JWT_SECRET, { expiresIn: '10m' });
    res.json({ authUrl: buildAuthUrl(state) });
  } catch (err) {
    next(err);
  }
});

// GET /callback — Google redireciona o browser pra cá (sem nosso token).
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
  const redirect = (ok: boolean, reason?: string) =>
    res.redirect(`${APP_URL}/ai-training#scheduling${ok ? '?gcal=ok' : `?gcal=erro${reason ? `_${reason}` : ''}`}`);

  if (error) return redirect(false, 'negado');
  if (!code || !state) return redirect(false, 'sem_codigo');

  let orgId: string;
  try {
    const decoded = jwt.verify(state, env.JWT_SECRET) as { orgId: string; kind: string };
    if (decoded.kind !== 'gcal' || !decoded.orgId) throw new Error('state inválido');
    orgId = decoded.orgId;
  } catch {
    return redirect(false, 'state');
  }

  try {
    const tokens = await exchangeCode(code);
    await saveConnection(orgId, tokens);
    logger.info(`[integrationsGoogle] agenda conectada org=${orgId}`);
    return redirect(true);
  } catch (err: any) {
    logger.warn(`[integrationsGoogle] callback falhou org=${orgId}: ${err.message}`);
    return redirect(false, 'troca');
  }
});

// GET /status — a org tem agenda Google conectada?
router.get('/status', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const conn = await (prisma as any).calendarConnection.findFirst({
      where: { organizationId: orgId, provider: 'google' },
      select: { status: true, externalAccountEmail: true, updatedAt: true },
    });
    res.json({
      configured: isGoogleConfigured(),
      connected: conn?.status === 'active',
      status: conn?.status || null,
      email: conn?.externalAccountEmail || null,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE / — desconecta a agenda Google da org.
router.delete('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await disconnect(req.user!.organizationId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
