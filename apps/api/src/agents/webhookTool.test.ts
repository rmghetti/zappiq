import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildWebhookToolDef, executeWebhook, type WebhookToolConfig } from './webhookTool.js';

const cfg: WebhookToolConfig = {
  type: 'webhook', name: 'consultar_pedido', description: 'Consulta o status de um pedido pelo número.',
  url: 'https://api.cliente.com/pedido', method: 'POST',
  headers: { 'X-Token': 'abc' },
  paramsSchema: { type: 'object', properties: { numero: { type: 'string' } }, required: ['numero'] },
};

describe('buildWebhookToolDef', () => {
  it('vira ToolDefinition com name/description/inputSchema', () => {
    const def = buildWebhookToolDef(cfg);
    expect(def.name).toBe('consultar_pedido');
    expect(def.description).toContain('Consulta');
    expect(def.inputSchema).toMatchObject({ type: 'object' });
  });
  it('sem paramsSchema → inputSchema objeto livre', () => {
    const def = buildWebhookToolDef({ ...cfg, paramsSchema: undefined });
    expect(def.inputSchema.type).toBe('object');
  });
});

describe('executeWebhook', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('POST: envia input no body, retorna body truncado (ok)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{"status":"enviado"}' });
    vi.stubGlobal('fetch', fetchMock);
    const r = await executeWebhook(cfg, { numero: '123' });
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.body).toContain('enviado');
    // body do fetch deve conter o input
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe('https://api.cliente.com/pedido');
    expect(JSON.parse(call[1].body)).toMatchObject({ numero: '123' });
    expect(call[1].headers['X-Token']).toBe('abc');
  });

  it('GET: input vira query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' });
    vi.stubGlobal('fetch', fetchMock);
    await executeWebhook({ ...cfg, method: 'GET' }, { numero: '9' });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('numero=9');
  });

  it('URL interna (SSRF) → ok:false, NÃO chama fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await executeWebhook({ ...cfg, url: 'http://169.254.169.254/latest' }, {});
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('erro de rede → ok:false com mensagem (fail-soft, não lança)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    const r = await executeWebhook(cfg, {});
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('resposta gigante é truncada (<=32KB)', async () => {
    const big = 'x'.repeat(100_000);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => big }));
    const r = await executeWebhook(cfg, {});
    expect((r.body || '').length).toBeLessThanOrEqual(32_768);
  });
});
