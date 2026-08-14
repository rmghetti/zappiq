/**
 * instagramWebhookSetup — diagnóstico e auto-reparo da assinatura de webhook
 * do Instagram (13/08, incidente da DM sem resposta).
 *
 * A DM real chegou na conta @zappiq.machia e NENHUM evento chegou ao nosso
 * webhook (zero conversas IG no banco de prod). Para o Direct falar com a
 * gente são necessárias DUAS assinaturas, e nenhuma era verificável/reparável
 * pelo produto:
 *
 *   1. APP-level — o app Meta precisa ter o objeto `instagram` assinado com a
 *      Callback URL da nossa API (POST /{APP_ID}/subscriptions, com o token
 *      de app `id|secret`). A Meta verifica a URL na hora com um GET, que o
 *      nosso webhook aceita via token derivado por org.
 *   2. PAGE-level — o app precisa estar inscrito na Página vinculada ao IG
 *      (POST /{pageId}/subscribed_apps, com Page token). O token salvo pelo
 *      caminho manual pode não ter `pages_manage_metadata`; nesse caso
 *      tentamos derivar um Page token do system token global
 *      (GET /{pageId}?fields=access_token) antes de desistir com dica.
 *
 * Tudo que sai daqui é sanitizado: token NUNCA aparece em resposta nem log.
 */
import { prisma } from '@zappiq/database';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { buildOrgWebhookVerifyToken } from './webhookVerifyToken.js';
import { redis } from '../utils/redis.js';

const GRAPH_VERSION = env.WHATSAPP_API_VERSION || 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const SUBSCRIBED_FIELDS = 'messages,messaging_postbacks';

/** Remove qualquer coisa com cara de token de string/objeto serializado. */
function sanitize(value: unknown): string {
  return JSON.stringify(value ?? null).replace(/[A-Za-z0-9_-]*(EAA|IGQV)[A-Za-z0-9_-]{8,}/g, '[TOKEN]');
}

function graphMessage(body: any): string {
  return sanitize(body?.error?.message || body?.error || body).slice(0, 300);
}

interface OrgIgCreds {
  id: string;
  instagramAccountId: string | null;
  instagramPageId: string | null;
  instagramAccessToken: string | null;
}

async function loadOrg(orgId: string): Promise<OrgIgCreds | null> {
  return prisma.organization.findFirst({
    where: { id: orgId },
    select: { id: true, instagramAccountId: true, instagramPageId: true, instagramAccessToken: true },
  }) as Promise<OrgIgCreds | null>;
}

export interface IgWebhookStatus {
  app: {
    configured: boolean;
    callbackUrl?: string;
    fields?: string[];
    active?: boolean;
    error?: string;
  };
  page: {
    /** true/false quando conseguimos ler; null quando a Graph negou a leitura. */
    subscribed: boolean | null;
    subscribedFields?: string[];
    error?: string;
  };
  org: { instagramAccountId: string | null; instagramPageId: string | null; hasToken: boolean };
  /** 14/08 — últimas chegadas de POST no webhook (marcador em Redis), aceitas
   *  ou rejeitadas por assinatura. Vazio = a Meta não entregou nada. */
  recentHits?: Array<{ at: string; ok: boolean; object?: string; entryId?: string | null; note?: string }>;
}

/** Lê o estado das duas assinaturas, sem alterar nada. */
export async function getInstagramWebhookStatus(orgId: string): Promise<IgWebhookStatus> {
  const org = await loadOrg(orgId);
  const out: IgWebhookStatus = {
    app: { configured: false },
    page: { subscribed: null },
    org: {
      instagramAccountId: org?.instagramAccountId ?? null,
      instagramPageId: org?.instagramPageId ?? null,
      hasToken: !!org?.instagramAccessToken,
    },
  };

  // APP-level (token de app id|secret — só existe no servidor).
  if (!env.META_APP_SECRET) {
    out.app.error = 'META_APP_SECRET não configurado no servidor';
  } else {
    try {
      const r = await fetch(
        `${GRAPH}/${env.META_APP_ID}/subscriptions?access_token=${env.META_APP_ID}|${env.META_APP_SECRET}`,
      );
      const body: any = await r.json().catch(() => null);
      if (!r.ok) {
        out.app.error = graphMessage(body);
      } else {
        const ig = (body?.data || []).find((s: any) => s?.object === 'instagram');
        if (ig) {
          out.app.configured = true;
          out.app.callbackUrl = ig.callback_url;
          out.app.active = ig.active;
          out.app.fields = (ig.fields || []).map((f: any) => (typeof f === 'string' ? f : f?.name)).filter(Boolean);
        }
      }
    } catch (err) {
      out.app.error = err instanceof Error ? err.message : String(err);
    }
  }

  // PAGE-level (token da org).
  if (org?.instagramPageId && org.instagramAccessToken) {
    try {
      const r = await fetch(
        `${GRAPH}/${org.instagramPageId}/subscribed_apps?access_token=${encodeURIComponent(org.instagramAccessToken)}`,
      );
      const body: any = await r.json().catch(() => null);
      if (!r.ok) {
        out.page.error = graphMessage(body);
      } else {
        const apps: any[] = body?.data || [];
        const mine = apps.find((a) => String(a?.id) === String(env.META_APP_ID));
        out.page.subscribed = !!mine;
        if (mine) out.page.subscribedFields = mine.subscribed_fields || [];
      }
    } catch (err) {
      out.page.error = err instanceof Error ? err.message : String(err);
    }
  } else {
    out.page.error = 'Org sem instagramPageId/instagramAccessToken salvos';
  }

  // Marcador de entregas (14/08): últimas chegadas de POST no webhook.
  try {
    const raw = await redis.lrange('ig:webhook:hits', 0, 9);
    out.recentHits = raw
      .map((r) => {
        try {
          return JSON.parse(r);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    out.recentHits = [];
  }

  return out;
}

export interface IgSubscribeResult {
  app: { ok: boolean; error?: string; hint?: string };
  page: { ok: boolean; viaFallback?: boolean; error?: string; hint?: string };
}

async function postSubscribePage(pageId: string, pageToken: string): Promise<{ ok: boolean; body: any; status: number }> {
  const r = await fetch(
    `${GRAPH}/${pageId}/subscribed_apps?subscribed_fields=${encodeURIComponent(SUBSCRIBED_FIELDS)}&access_token=${encodeURIComponent(pageToken)}`,
    { method: 'POST' },
  );
  const body: any = await r.json().catch(() => null);
  return { ok: r.ok && body?.success !== false, body, status: r.status };
}

/**
 * Repara as duas assinaturas. Idempotente: a Graph trata re-assinatura como
 * atualização. Nunca lança; erros voltam sanitizados com dica.
 */
export async function subscribeInstagramWebhooks(orgId: string): Promise<IgSubscribeResult> {
  const org = await loadOrg(orgId);
  const result: IgSubscribeResult = { app: { ok: false }, page: { ok: false } };

  if (!org?.instagramPageId || !org.instagramAccountId) {
    const hint = 'Conecte o Instagram primeiro (1 clique ou manual) para ter Página e conta salvas.';
    result.app = { ok: false, error: 'org_sem_instagram', hint };
    result.page = { ok: false, error: 'org_sem_instagram', hint };
    return result;
  }

  // ── 1. APP-level: objeto instagram → nossa Callback URL ──────────────
  if (!env.META_APP_SECRET) {
    result.app = {
      ok: false,
      error: 'META_APP_SECRET não configurado no servidor',
      hint: 'Configurar o secret do app Meta no ambiente da API (Fly).',
    };
  } else {
    try {
      const callbackUrl = `${(env.API_PUBLIC_URL || 'https://api.zappiq.com.br').replace(/\/+$/, '')}/api/webhook/instagram`;
      const verifyToken = buildOrgWebhookVerifyToken(orgId);
      const params = new URLSearchParams({
        object: 'instagram',
        callback_url: callbackUrl,
        fields: SUBSCRIBED_FIELDS,
        verify_token: verifyToken,
        access_token: `${env.META_APP_ID}|${env.META_APP_SECRET}`,
      });
      const r = await fetch(`${GRAPH}/${env.META_APP_ID}/subscriptions?${params.toString()}`, { method: 'POST' });
      const body: any = await r.json().catch(() => null);
      if (r.ok && body?.success !== false) {
        result.app = { ok: true };
      } else {
        result.app = {
          ok: false,
          error: graphMessage(body),
          hint: 'A Meta verificou a Callback URL na hora — confira se a API está no ar e o token derivado é aceito.',
        };
      }
    } catch (err) {
      result.app = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── 2. PAGE-level: subscribed_apps com o token da org ────────────────
  if (!org.instagramAccessToken) {
    result.page = { ok: false, error: 'org_sem_token', hint: 'Conecte o Instagram para salvar o Page token.' };
    return result;
  }
  try {
    const direct = await postSubscribePage(org.instagramPageId, org.instagramAccessToken);
    if (direct.ok) {
      result.page = { ok: true };
      logger.info('[IGWebhookSetup] página assinada com o token da org', { orgId, pageId: org.instagramPageId });
      return result;
    }

    const code = direct.body?.error?.code;
    const scopeProblem = code === 200 || code === 10;
    if (scopeProblem && env.WHATSAPP_ACCESS_TOKEN) {
      // Fallback: deriva um Page token do system token global (se o system
      // user tiver a Página como asset + pages_manage_metadata).
      const rt = await fetch(
        `${GRAPH}/${org.instagramPageId}?fields=access_token&access_token=${encodeURIComponent(env.WHATSAPP_ACCESS_TOKEN)}`,
      );
      const tb: any = await rt.json().catch(() => null);
      const derived = tb?.access_token;
      if (rt.ok && derived) {
        const viaSystem = await postSubscribePage(org.instagramPageId, derived);
        if (viaSystem.ok) {
          result.page = { ok: true, viaFallback: true };
          logger.info('[IGWebhookSetup] página assinada via system token (fallback)', { orgId, pageId: org.instagramPageId });
          return result;
        }
        result.page = {
          ok: false,
          error: graphMessage(viaSystem.body),
          hint: 'Reconecte o Instagram pelo botão de 1 clique em Canais — o token salvo não tem as permissões de webhook (pages_manage_metadata).',
        };
        return result;
      }
    }

    result.page = {
      ok: false,
      error: graphMessage(direct.body),
      hint: scopeProblem
        ? 'Reconecte o Instagram pelo botão de 1 clique em Canais — o token salvo não tem as permissões de webhook (pages_manage_metadata).'
        : 'Confira se a Página vinculada está correta e tente de novo.',
    };
  } catch (err) {
    result.page = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  return result;
}
