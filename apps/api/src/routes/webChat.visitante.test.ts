/* ══════════════════════════════════════════════════════════════════════
 * Rotas públicas que o widget lê (C1b, Passos 3 e 4).
 * --------------------------------------------------------------------
 * Mesmo padrão de webChat.honeypot.test.ts: sem supertest, o handler final
 * de cada rota é chamado direto do router.stack.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { webChatServiceMock, visitanteMock } = vi.hoisted(() => ({
  webChatServiceMock: {
    processWebChatTurn: vi.fn(),
    getWebChatOrgConfig: vi.fn(),
    MAX_HISTORY_TURNS: 20,
    MAX_MESSAGE_LENGTH: 2000,
  },
  visitanteMock: {
    mensagensDaEquipe: vi.fn(),
    configDoWidget: vi.fn(),
  },
}));

vi.mock('../services/webChatService.js', () => webChatServiceMock);
vi.mock('../services/webChatVisitante.js', () => visitanteMock);
vi.mock('../middleware/planLimits.js', () => ({
  getTrialLlmStage: vi.fn(async () => ({ capped: false })),
  consumeWebChatOrgReplyBudget: vi.fn(),
}));
vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { default: router } = await import('./webChat.js');

function getHandler(method: string, path: string) {
  const stack = (router as unknown as { stack: any[] }).stack;
  for (const layer of stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method]) {
      const handlers = layer.route.stack;
      return handlers[handlers.length - 1].handle as (req: any, res: any, next: any) => Promise<void>;
    }
  }
  throw new Error(`handler não encontrado: ${method.toUpperCase()} ${path}`);
}

function mockRes() {
  const res: any = { statusCode: 200, body: undefined, headers: {} as Record<string, string> };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: unknown) => {
    res.body = payload;
    return res;
  });
  res.set = vi.fn((k: string, v: string) => {
    res.headers[k] = v;
    return res;
  });
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  webChatServiceMock.getWebChatOrgConfig.mockResolvedValue({ exists: true, enabled: true });
});

describe('GET mensagens da equipe (Passo 3)', () => {
  const handler = getHandler('get', '/org/:organizationId/sessao/:sessionId/mensagens-da-equipe');

  it('devolve as mensagens da equipe para a sessão, sem cache', async () => {
    visitanteMock.mensagensDaEquipe.mockResolvedValue([
      { id: 'm1', content: 'Oi! Aqui é a Ana.', createdAt: '2026-09-14T15:01:00.000Z' },
    ]);
    const res = mockRes();
    await handler({ params: { organizationId: 'org-1', sessionId: 'sessao-1' } }, res, vi.fn());

    expect(visitanteMock.mensagensDaEquipe).toHaveBeenCalledWith('org-1', 'sessao-1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ mensagens: [{ id: 'm1', content: 'Oi! Aqui é a Ana.', createdAt: '2026-09-14T15:01:00.000Z' }] });
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('organização com o chat desligado: 404, sem ler mensagem nenhuma', async () => {
    webChatServiceMock.getWebChatOrgConfig.mockResolvedValue({ exists: true, enabled: false });
    const res = mockRes();
    await handler({ params: { organizationId: 'org-1', sessionId: 'sessao-1' } }, res, vi.fn());
    expect(res.statusCode).toBe(404);
    expect(visitanteMock.mensagensDaEquipe).not.toHaveBeenCalled();
  });

  it('sessão vazia ou id de organização absurdo: 404', async () => {
    for (const params of [
      { organizationId: 'org-1', sessionId: '   ' },
      { organizationId: 'x'.repeat(41), sessionId: 's' },
    ]) {
      const res = mockRes();
      await handler({ params }, res, vi.fn());
      expect(res.statusCode).toBe(404);
    }
    expect(visitanteMock.mensagensDaEquipe).not.toHaveBeenCalled();
  });

  it('banco fora na leitura da configuração: 503, sem lançar', async () => {
    webChatServiceMock.getWebChatOrgConfig.mockRejectedValue(new Error('db down'));
    const res = mockRes();
    await handler({ params: { organizationId: 'org-1', sessionId: 'sessao-1' } }, res, vi.fn());
    expect(res.statusCode).toBe(503);
  });
});

describe('POST do chat: o transbordo volta para o widget (Passo 3)', () => {
  const handler = getHandler('post', '/org/:organizationId/message');

  it('a resposta leva transbordo: true quando a conversa passou para a equipe', async () => {
    webChatServiceMock.processWebChatTurn.mockResolvedValue({ reply: 'Vou chamar alguém.', transbordo: true, latencyMs: 1 });
    const res = mockRes();
    await handler({ params: { organizationId: 'org-1' }, body: { sessionId: 's', message: 'atendente' } }, res, vi.fn());
    expect(res.body).toMatchObject({ reply: 'Vou chamar alguém.', transbordo: true, paused: false });
    // O widget por organização escuta a equipe: o serviço é avisado disso.
    expect(webChatServiceMock.processWebChatTurn.mock.calls[0][0]).toMatchObject({ canalDeVolta: true });
  });
});

describe('GET configuração do widget (Passo 4, A247)', () => {
  const handler = getHandler('get', '/org/:organizationId/config');

  it('devolve nome e saudação do Treinar IA, com cache curto', async () => {
    visitanteMock.configDoWidget.mockResolvedValue({ nome: 'Vera', saudacao: 'Olá! Aqui é a Vera, da CMJ.' });
    const res = mockRes();
    await handler({ params: { organizationId: 'org-1' } }, res, vi.fn());

    expect(visitanteMock.configDoWidget).toHaveBeenCalledWith('org-1');
    expect(res.body).toEqual({ nome: 'Vera', saudacao: 'Olá! Aqui é a Vera, da CMJ.' });
    expect(res.headers['Cache-Control']).toBe('public, max-age=60');
  });

  it('organização com o chat do site desligado: 404 genérico', async () => {
    webChatServiceMock.getWebChatOrgConfig.mockResolvedValue({ exists: false, enabled: false });
    const res = mockRes();
    await handler({ params: { organizationId: 'org-x' } }, res, vi.fn());
    expect(res.statusCode).toBe(404);
    expect(visitanteMock.configDoWidget).not.toHaveBeenCalled();
  });

  it('banco fora: devolve nulos (o widget usa os atributos da tag), nunca 500', async () => {
    webChatServiceMock.getWebChatOrgConfig.mockRejectedValue(new Error('db down'));
    const res = mockRes();
    await handler({ params: { organizationId: 'org-1' } }, res, vi.fn());
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ nome: null, saudacao: null });
  });
});
