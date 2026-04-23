import { Router, Request, Response } from 'express';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * Admin diagnostic endpoints para debug do webhook WhatsApp.
 * Protegidos por header X-Admin-Secret == META_APP_SECRET.
 *
 * Usados para verificar/forcar a subscricao do app na WhatsApp Business
 * Account (WABA) — sem isso, webhooks de mensagens reais nao chegam,
 * mesmo com o field "messages" assinado no dashboard.
 */

function requireAdminAuth(req: Request, res: Response): boolean {
  const provided = req.header('x-admin-secret');
  const expected = env.META_APP_SECRET;
  if (!expected) {
    res.status(500).json({ error: 'META_APP_SECRET nao configurado no servidor' });
    return false;
  }
  if (!provided || provided !== expected) {
    res.status(403).json({ error: 'X-Admin-Secret invalido ou ausente' });
    return false;
  }
  return true;
}

function graphUrl(path: string): string {
  const v = env.WHATSAPP_API_VERSION || 'v21.0';
  return `https://graph.facebook.com/${v}${path}`;
}

// ── GET /api/admin/whatsapp/env-check ──
// Retorna status das envs criticas (sem expor valores sensiveis).
router.get('/env-check', (req: Request, res: Response) => {
  if (!requireAdminAuth(req, res)) return;
  res.json({
    META_APP_SECRET: env.META_APP_SECRET ? 'set' : 'MISSING',
    WHATSAPP_ACCESS_TOKEN: env.WHATSAPP_ACCESS_TOKEN ? 'set' : 'MISSING',
    WHATSAPP_PHONE_NUMBER_ID: env.WHATSAPP_PHONE_NUMBER_ID || 'MISSING',
    WHATSAPP_BUSINESS_ACCOUNT_ID: env.WHATSAPP_BUSINESS_ACCOUNT_ID || 'MISSING',
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? 'set' : 'MISSING',
    WHATSAPP_API_VERSION: env.WHATSAPP_API_VERSION || 'v21.0',
  });
});

// ── GET /api/admin/whatsapp/subscribed-apps ──
// Lista apps subscritos a WABA. Vazio = ninguem recebendo webhooks.
router.get('/subscribed-apps', async (req: Request, res: Response) => {
  if (!requireAdminAuth(req, res)) return;
  const wabaId = env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const token = env.WHATSAPP_ACCESS_TOKEN;
  if (!wabaId || !token) {
    return res.status(500).json({ error: 'WABA_ID ou ACCESS_TOKEN ausente' });
  }
  try {
    const url = graphUrl(`/${wabaId}/subscribed_apps`);
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await r.text();
    let parsed: unknown = body;
    try { parsed = JSON.parse(body); } catch { /* keep text */ }
    return res.status(r.status).json({ status: r.status, body: parsed, url });
  } catch (err: any) {
    logger.error('[admin/whatsapp] subscribed-apps failed', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// ── POST /api/admin/whatsapp/subscribe ──
// Registra ESTE app como subscriber da WABA. Idempotente.
router.post('/subscribe', async (req: Request, res: Response) => {
  if (!requireAdminAuth(req, res)) return;
  const wabaId = env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const token = env.WHATSAPP_ACCESS_TOKEN;
  if (!wabaId || !token) {
    return res.status(500).json({ error: 'WABA_ID ou ACCESS_TOKEN ausente' });
  }
  try {
    const url = graphUrl(`/${wabaId}/subscribed_apps`);
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await r.text();
    let parsed: unknown = body;
    try { parsed = JSON.parse(body); } catch { /* keep text */ }
    logger.info('[admin/whatsapp] subscribe result', { status: r.status, body: parsed });
    return res.status(r.status).json({ status: r.status, body: parsed, url });
  } catch (err: any) {
    logger.error('[admin/whatsapp] subscribe failed', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// ── GET /api/admin/whatsapp/phone-info ──
// Verifica se o numero esta ativo, com qual WABA esta amarrado, e display_phone_number.
router.get('/phone-info', async (req: Request, res: Response) => {
  if (!requireAdminAuth(req, res)) return;
  const phoneId = env.WHATSAPP_PHONE_NUMBER_ID;
  const token = env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) {
    return res.status(500).json({ error: 'PHONE_NUMBER_ID ou ACCESS_TOKEN ausente' });
  }
  try {
    const url = graphUrl(`/${phoneId}?fields=verified_name,display_phone_number,quality_rating,code_verification_status,name_status,status,messaging_limit_tier,platform_type`);
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await r.text();
    let parsed: unknown = body;
    try { parsed = JSON.parse(body); } catch { /* keep text */ }
    return res.status(r.status).json({ status: r.status, body: parsed, url });
  } catch (err: any) {
    logger.error('[admin/whatsapp] phone-info failed', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

export default router;
