/**
 * instagramWebhookSetup.test.ts — auto-reparo da assinatura de webhook do IG
 * ============================================================================
 * Incidente 13/08 (DM real): a DM chegou na conta @zappiq.machia e NENHUM
 * evento chegou ao nosso webhook (zero conversas IG no banco de prod). Causa
 * mais provável na cadeia: app não assinado na Página (o token salvo pelo
 * caminho manual não tem pages_manage_metadata nem consegue LER subscribed_apps).
 *
 * subscribeInstagramWebhooks fecha as duas pontas por API:
 *   1. APP-level: POST /{APP_ID}/subscriptions (object=instagram, callback da
 *      nossa API, verify_token derivado da org — o webhook aceita).
 *   2. PAGE-level: POST /{pageId}/subscribed_apps com o token da org; se o
 *      token não tem escopo, tenta derivar um Page token do system token
 *      global (GET /{pageId}?fields=access_token) antes de desistir.
 * Erros voltam sanitizados (nunca vazar token) e com dica acionável.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const orgFindFirstMock = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: { organization: { findFirst: orgFindFirstMock } },
}));

vi.mock('../config/env.js', () => ({
  env: {
    WHATSAPP_API_VERSION: 'v21.0',
    META_APP_ID: '1603310040738671',
    META_APP_SECRET: 'segredo-do-app-meta-16',
    WHATSAPP_ACCESS_TOKEN: 'EAASYSTEMTOKEN'.padEnd(40, 'x'),
    API_PUBLIC_URL: 'https://api.zappiq.com.br',
    JWT_SECRET: 'segredo-jwt-de-teste-com-32-chars!!!',
  },
}));

// 14/08 — marcador de entregas: Redis mockado (lista vazia) pra teste não abrir conexão real.
vi.mock('../utils/redis.js', () => ({
  redis: { lrange: vi.fn().mockResolvedValue([]), lpush: vi.fn(), ltrim: vi.fn() },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { subscribeInstagramWebhooks, getInstagramWebhookStatus } = await import(
  './instagramWebhookSetup.js'
);

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status < 400, json: async () => body } as Response;
}

const ORG = {
  id: 'org_ig1',
  instagramAccountId: '17841417325567565',
  instagramPageId: '1018075661397028',
  instagramAccessToken: 'EAAPAGETOKEN'.padEnd(60, 'p'),
};

beforeEach(() => {
  vi.clearAllMocks();
  orgFindFirstMock.mockResolvedValue(ORG);
});

describe('subscribeInstagramWebhooks', () => {
  it('caminho feliz: assina app (object instagram) e página, com verify_token derivado', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true }));

    const r = await subscribeInstagramWebhooks('org_ig1');

    expect(r.app.ok).toBe(true);
    expect(r.page.ok).toBe(true);

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    const appCall = urls.find((u) => u.includes('/1603310040738671/subscriptions'));
    expect(appCall).toBeTruthy();
    expect(appCall).toContain('object=instagram');
    expect(appCall).toContain(encodeURIComponent('https://api.zappiq.com.br/api/webhook/instagram'));
    // verify_token derivado da org (zpq1.org_ig1.<hmac>) — o GET do webhook aceita.
    expect(decodeURIComponent(appCall!)).toContain('zpq1.org_ig1.');

    const pageCall = urls.find((u) => u.includes('/1018075661397028/subscribed_apps'));
    expect(pageCall).toBeTruthy();
    expect(pageCall).toContain('subscribed_fields=');
  });

  it('token da org sem pages_manage_metadata cai no fallback do system token e assina', async () => {
    fetchMock.mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/subscriptions')) return jsonResponse(200, { success: true });
      if (u.includes('/subscribed_apps') && u.includes('EAAPAGETOKEN')) {
        return jsonResponse(403, { error: { code: 200, message: '(#200) Requires pages_manage_metadata permission' } });
      }
      if (u.includes('fields=access_token')) {
        return jsonResponse(200, { access_token: 'EAADERIVEDPAGETOKEN'.padEnd(40, 'd') });
      }
      if (u.includes('/subscribed_apps')) return jsonResponse(200, { success: true });
      return jsonResponse(500, { error: { message: 'inesperado ' + u } });
    });

    const r = await subscribeInstagramWebhooks('org_ig1');

    expect(r.page.ok).toBe(true);
    expect(r.page.viaFallback).toBe(true);
  });

  it('sem escopo em NENHUM token: page.ok=false com dica de reconectar, sem vazar token', async () => {
    fetchMock.mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/subscriptions')) return jsonResponse(200, { success: true });
      if (u.includes('fields=access_token')) {
        return jsonResponse(403, { error: { code: 200, message: '(#200) no perms' } });
      }
      return jsonResponse(403, { error: { code: 200, message: '(#200) Requires pages_manage_metadata permission' } });
    });

    const r = await subscribeInstagramWebhooks('org_ig1');

    expect(r.page.ok).toBe(false);
    expect(r.page.hint).toMatch(/1 clique|reconect/i);
    expect(JSON.stringify(r)).not.toContain('PAGETOKEN');
  });

  it('org sem credenciais de IG devolve erro claro, sem chamada à Graph', async () => {
    orgFindFirstMock.mockResolvedValue({ id: 'org_x', instagramAccountId: null, instagramPageId: null, instagramAccessToken: null });
    const r = await subscribeInstagramWebhooks('org_x');
    expect(r.page.ok).toBe(false);
    expect(r.app.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('getInstagramWebhookStatus', () => {
  it('lê a assinatura do app e reporta o objeto instagram', async () => {
    fetchMock.mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/subscriptions')) {
        return jsonResponse(200, {
          data: [{ object: 'instagram', callback_url: 'https://api.zappiq.com.br/api/webhook/instagram', active: true, fields: [{ name: 'messages', version: 'v21.0' }] }],
        });
      }
      return jsonResponse(200, { data: [{ id: '1603310040738671', subscribed_fields: ['messages'] }] });
    });

    const s = await getInstagramWebhookStatus('org_ig1');

    expect(s.app.configured).toBe(true);
    expect(s.app.callbackUrl).toContain('/api/webhook/instagram');
    expect(s.page.subscribed).toBe(true);
  });

  it('página ilegível por falta de escopo vira subscribed=null com a mensagem da Graph', async () => {
    fetchMock.mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/subscriptions')) return jsonResponse(200, { data: [] });
      return jsonResponse(403, { error: { code: 200, message: '(#200) Requires pages_manage_metadata permission' } });
    });

    const s = await getInstagramWebhookStatus('org_ig1');

    expect(s.app.configured).toBe(false);
    expect(s.page.subscribed).toBeNull();
    expect(s.page.error).toContain('pages_manage_metadata');
  });
});
