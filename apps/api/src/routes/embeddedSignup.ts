/**
 * embeddedSignup — callbacks OAuth do WhatsApp/Instagram Embedded Signup (#273/#274).
 *
 * Fluxo (Tech Provider / On-Behalf-Of):
 *   1. No dashboard, o cliente clica "Conectar WhatsApp" (ou Instagram). O popup
 *      do Facebook Login for Business roda o Embedded Signup e devolve um `code`
 *      de curta duração (+ ids selecionados) pro frontend via callback do SDK.
 *   2. O frontend POSTa esse `code` (autenticado, JWT da org) pra cá.
 *   3. Aqui trocamos `code` -> business token (oauth/access_token usando
 *      META_APP_ID + META_APP_SECRET), assinamos o app na conta do cliente
 *      (subscribed_apps) e registramos o número (Cloud API /register com PIN).
 *   4. Persistimos as credenciais na organization do cliente.
 *
 * IMPORTANTE: o token resultante pertence à conta do CLIENTE (multi-tenant),
 * nunca ao número global da ZappIQ. Cada org guarda o seu.
 *
 * Pré-condição de produção: o App Meta da ZappIQ precisa de Advanced Access
 * aprovado pras permissões (whatsapp_business_*, instagram_business_manage_messages).
 * Ver GUIA_APP_REVIEW_META_EMBEDDED_SIGNUP.md. Enquanto não aprovar, só funciona
 * pra usuários com role no app (dev/test).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const router = Router();

const GRAPH_VERSION = env.WHATSAPP_API_VERSION || 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** GET helper com tratamento de erro Graph uniforme. */
async function graphGet(path: string, accessToken: string): Promise<any> {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${GRAPH}${path}${sep}access_token=${encodeURIComponent(accessToken)}`;
  const r = await fetch(url);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = body?.error?.message || `Graph GET ${path} falhou (${r.status})`;
    throw new GraphError(msg, r.status, body?.error);
  }
  return body;
}

/** POST helper (form-urlencoded ou JSON-body via querystring no Graph). */
async function graphPost(path: string, accessToken: string, params: Record<string, string> = {}): Promise<any> {
  const url = `${GRAPH}${path}`;
  const form = new URLSearchParams({ ...params, access_token: accessToken });
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = body?.error?.message || `Graph POST ${path} falhou (${r.status})`;
    throw new GraphError(msg, r.status, body?.error);
  }
  return body;
}

class GraphError extends Error {
  status: number;
  graph?: any;
  constructor(message: string, status: number, graph?: any) {
    super(message);
    this.name = 'GraphError';
    this.status = status;
    this.graph = graph;
  }
}

/**
 * Troca o `code` do Embedded Signup por um business access token.
 * Endpoint: GET /oauth/access_token (sem token de bearer — usa client_secret).
 */
async function exchangeCodeForToken(code: string): Promise<string> {
  const appId = env.META_APP_ID;
  const appSecret = env.META_APP_SECRET;
  if (!appSecret) throw new GraphError('META_APP_SECRET não configurado no servidor', 500);

  const qs = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
  });
  const r = await fetch(`${GRAPH}/oauth/access_token?${qs.toString()}`);
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body?.access_token) {
    const msg = body?.error?.message || `Troca de code falhou (${r.status})`;
    throw new GraphError(msg, r.status, body?.error);
  }
  return body.access_token as string;
}

/** PIN de 6 dígitos pro 2FA do número (Cloud API /register). Aleatório por número. */
function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/embedded-signup/whatsapp
// body: { code, wabaId, phoneNumberId }
// ─────────────────────────────────────────────────────────────────────────────
const whatsappSchema = z.object({
  code: z.string().min(10),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
});

router.post(
  '/whatsapp',
  requireRole('ADMIN'),
  validate(whatsappSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const orgId = req.organizationId!;
    const { code, wabaId, phoneNumberId } = req.body as z.infer<typeof whatsappSchema>;
    try {
      // 1. code -> business token (pertence à conta do cliente)
      const accessToken = await exchangeCodeForToken(code);

      // 2. Assina o app da ZappIQ na WABA do cliente -> habilita webhooks
      await graphPost(`/${wabaId}/subscribed_apps`, accessToken);

      // 3. Registra o número na Cloud API com PIN (2FA). Idempotente: se já
      //    registrado, a Meta devolve erro tratável — não bloqueia o vínculo.
      const pin = generatePin();
      let registered = false;
      try {
        await graphPost(`/${phoneNumberId}/register`, accessToken, {
          messaging_product: 'whatsapp',
          pin,
        });
        registered = true;
      } catch (regErr: any) {
        // Códigos comuns: 133005 (PIN já setado), 100/parâmetro — número já ativo.
        logger.warn('[EmbeddedSignup/WA] /register não-fatal', {
          orgId,
          message: regErr?.message,
          code: regErr?.graph?.code,
        });
      }

      // 4. Persiste credenciais na org do cliente
      const current = await prisma.organization.findUnique({ where: { id: orgId } });
      const settings = (current?.settings as Record<string, any>) || {};
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          whatsappBusinessAccountId: wabaId,
          whatsappPhoneNumberId: phoneNumberId,
          whatsappAccessToken: accessToken,
          settings: {
            ...settings,
            whatsapp: {
              ...(settings.whatsapp || {}),
              pin,
              connectedAt: new Date().toISOString(),
              registered,
            },
          },
        } as any,
      });

      logger.info('[EmbeddedSignup/WA] conectado', { orgId, wabaId, phoneNumberId, registered });
      res.status(200).json({
        success: true,
        channel: 'whatsapp',
        wabaId,
        phoneNumberId,
        registered,
      });
    } catch (err: any) {
      if (err instanceof GraphError) {
        logger.error('[EmbeddedSignup/WA] falhou', { orgId, status: err.status, message: err.message });
        res.status(err.status >= 400 && err.status < 500 ? 400 : 502).json({
          success: false,
          error: err.message,
          meta: err.graph || null,
        });
        return;
      }
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/embedded-signup/instagram
// body: { code }  (resolvemos page + IG business account a partir do token)
// ─────────────────────────────────────────────────────────────────────────────
const instagramSchema = z.object({
  code: z.string().min(10),
  pageId: z.string().optional(), // opcional: se o cliente tem várias páginas, frontend escolhe
});

router.post(
  '/instagram',
  requireRole('ADMIN'),
  validate(instagramSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const orgId = req.organizationId!;
    const { code, pageId: preferredPageId } = req.body as z.infer<typeof instagramSchema>;
    try {
      // 1. code -> user token
      const userToken = await exchangeCodeForToken(code);

      // 2. Lista as páginas do cliente (com page access token de cada uma)
      const pagesResp = await graphGet('/me/accounts?fields=id,name,access_token', userToken);
      const pages: Array<{ id: string; name: string; access_token: string }> = pagesResp?.data || [];
      if (pages.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Nenhuma Página do Facebook encontrada na conta. O Instagram precisa estar vinculado a uma Página.',
        });
        return;
      }

      // 3. Escolhe a página (preferida pelo frontend, ou a primeira com IG vinculado)
      let chosen: { id: string; name: string; access_token: string } | null = null;
      let igAccountId: string | null = null;

      const candidates = preferredPageId
        ? pages.filter((p) => p.id === preferredPageId)
        : pages;

      for (const page of candidates.length ? candidates : pages) {
        const info = await graphGet(`/${page.id}?fields=instagram_business_account`, page.access_token);
        if (info?.instagram_business_account?.id) {
          chosen = page;
          igAccountId = info.instagram_business_account.id;
          break;
        }
      }

      if (!chosen || !igAccountId) {
        res.status(400).json({
          success: false,
          error: 'Nenhuma conta Instagram Business vinculada a uma Página foi encontrada. Vincule o Instagram à Página do Facebook e tente de novo.',
          pages: pages.map((p) => ({ id: p.id, name: p.name })),
        });
        return;
      }

      // 4. Assina o app na Página -> habilita webhooks de DM
      await graphPost(`/${chosen.id}/subscribed_apps`, chosen.access_token, {
        subscribed_fields: 'messages,messaging_postbacks',
      });

      // 5. Persiste credenciais na org do cliente
      const current = await prisma.organization.findUnique({ where: { id: orgId } });
      const settings = (current?.settings as Record<string, any>) || {};
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          instagramAccountId: igAccountId,
          instagramPageId: chosen.id,
          instagramAccessToken: chosen.access_token,
          settings: {
            ...settings,
            instagram: {
              ...(settings.instagram || {}),
              pageName: chosen.name,
              connectedAt: new Date().toISOString(),
            },
          },
        } as any,
      });

      logger.info('[EmbeddedSignup/IG] conectado', { orgId, pageId: chosen.id, igAccountId });
      res.status(200).json({
        success: true,
        channel: 'instagram',
        pageId: chosen.id,
        pageName: chosen.name,
        instagramAccountId: igAccountId,
      });
    } catch (err: any) {
      if (err instanceof GraphError) {
        logger.error('[EmbeddedSignup/IG] falhou', { orgId, status: err.status, message: err.message });
        res.status(err.status >= 400 && err.status < 500 ? 400 : 502).json({
          success: false,
          error: err.message,
          meta: err.graph || null,
        });
        return;
      }
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/embedded-signup/status — estado de conexão dos canais da org.
// Usado pelo dashboard pra mostrar "Conectado"/"Conectar" sem expor tokens.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.organizationId! } });
    if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
    const settings = (org.settings as Record<string, any>) || {};
    // Cast: campos instagram_* são @map-eados no schema; o client local pode estar
    // defasado (regenera no build Fly). `as any` evita falso-positivo de tsc local.
    const o = org as any;
    res.json({
      success: true,
      whatsapp: {
        connected: !!o.whatsappAccessToken && !!o.whatsappPhoneNumberId,
        phoneNumberId: o.whatsappPhoneNumberId || null,
        wabaId: o.whatsappBusinessAccountId || null,
        connectedAt: settings.whatsapp?.connectedAt || null,
      },
      instagram: {
        connected: !!o.instagramAccessToken && !!o.instagramAccountId,
        instagramAccountId: o.instagramAccountId || null,
        pageName: settings.instagram?.pageName || null,
        connectedAt: settings.instagram?.connectedAt || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
