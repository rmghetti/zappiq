/**
 * webChat.honeypot.test.ts — Resposta Meta out/2026 (PR-E)
 * ============================================================================
 * Defesas do webchat público:
 *   ✓ HONEYPOT: campo `website` preenchido devolve 200 genérico SEM tocar o
 *     pipeline de LLM (nas duas rotas: /iza-message e /org/:id/message)
 *   ✓ Rate limit por ORG (300/h) pra org em regime TRIAL/NOVO: 429 sem LLM
 *   ✓ Org pagante: limitador por org nem é consultado (comportamento intocado)
 *
 * Mesmo padrão de appointments.test.ts: sem supertest (server.ts puxa
 * Redis/OTel/BullMQ). Mockamos as deps, importamos o router e invocamos o
 * handler final direto do router.stack (o rate-limit por IP fica de fora).
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const { webChatServiceMock, planLimitsMock } = vi.hoisted(() => ({
  webChatServiceMock: {
    processWebChatTurn: vi.fn(),
    getWebChatOrgConfig: vi.fn(),
    MAX_HISTORY_TURNS: 20,
    MAX_MESSAGE_LENGTH: 2000,
  },
  planLimitsMock: {
    getTrialLlmStage: vi.fn(),
    consumeWebChatOrgReplyBudget: vi.fn(),
  },
}));

vi.mock('../services/webChatService.js', () => webChatServiceMock);
vi.mock('../middleware/planLimits.js', () => planLimitsMock);
vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { default: router } = await import('./webChat.js');

/** Pega o handler final (depois do rate-limit por IP) de uma rota do router. */
function getHandler(method: string, path: string) {
  const stack = (router as unknown as { stack: any[] }).stack;
  for (const layer of stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method]) {
      const handlers = layer.route.stack;
      return handlers[handlers.length - 1].handle as (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => Promise<void>;
    }
  }
  throw new Error(`handler não encontrado: ${method.toUpperCase()} ${path}`);
}

function mockRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: unknown) => {
    res.body = payload;
    return res;
  });
  return res as Response & { statusCode: number; body: any };
}

const orgHandler = getHandler('post', '/org/:organizationId/message');
const izaHandler = getHandler('post', '/iza-message');

function bodyBase(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'sessao-1',
    message: 'oi, quero saber mais',
    history: [],
    ...overrides,
  };
}

async function invokeOrg(body: Record<string, unknown>, organizationId = 'org-1') {
  const req = { params: { organizationId }, body } as unknown as Request;
  const res = mockRes();
  await orgHandler(req, res, vi.fn() as unknown as NextFunction);
  return res;
}

async function invokeIza(body: Record<string, unknown>) {
  const req = { params: {}, body } as unknown as Request;
  const res = mockRes();
  await izaHandler(req, res, vi.fn() as unknown as NextFunction);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  webChatServiceMock.getWebChatOrgConfig.mockResolvedValue({ exists: true, enabled: true });
  webChatServiceMock.processWebChatTurn.mockResolvedValue({
    reply: 'Olá! Como posso ajudar?',
    provider: 'google-gemini-flash',
    model: 'gemini-2.5-flash',
    latencyMs: 150,
  });
  planLimitsMock.getTrialLlmStage.mockResolvedValue({ capped: false, stage: 'OTHER', capUsd: 0 });
  planLimitsMock.consumeWebChatOrgReplyBudget.mockResolvedValue({ allowed: true, count: 1 });
});

describe('HONEYPOT — campo `website` preenchido é bot', () => {
  it('POST /org/:id/message com website preenchido: 200 genérico sem processar LLM', async () => {
    const res = await invokeOrg(bodyBase({ website: 'https://spam.example' }));

    expect(res.statusCode).toBe(200);
    expect(res.body.reply).toContain('Recebi sua mensagem');
    expect(webChatServiceMock.processWebChatTurn).not.toHaveBeenCalled();
    // Curto-circuito total: nem o estágio da org é consultado.
    expect(planLimitsMock.getTrialLlmStage).not.toHaveBeenCalled();
  });

  it('POST /iza-message com website preenchido: 200 genérico sem processar LLM', async () => {
    const res = await invokeIza(bodyBase({ website: 'x' }));

    expect(res.statusCode).toBe(200);
    expect(res.body.reply).toContain('Recebi sua mensagem');
    expect(webChatServiceMock.processWebChatTurn).not.toHaveBeenCalled();
  });

  it('website vazio ou ausente NÃO dispara o honeypot (humano segue normal)', async () => {
    const semCampo = await invokeOrg(bodyBase());
    const vazio = await invokeOrg(bodyBase({ website: '   ' }));

    expect(semCampo.statusCode).toBe(200);
    expect(semCampo.body.reply).toBe('Olá! Como posso ajudar?');
    expect(vazio.body.reply).toBe('Olá! Como posso ajudar?');
    expect(webChatServiceMock.processWebChatTurn).toHaveBeenCalledTimes(2);
  });
});

describe('rate limit por ORG (300/h) — só pra org em regime TRIAL/NOVO', () => {
  it('org em TRIAL acima do teto: 429 sem processar LLM', async () => {
    planLimitsMock.getTrialLlmStage.mockResolvedValue({ capped: true, stage: 'TRIAL', capUsd: 15 });
    planLimitsMock.consumeWebChatOrgReplyBudget.mockResolvedValue({ allowed: false, count: 301 });

    const res = await invokeOrg(bodyBase());

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toBe('rate_limited');
    expect(webChatServiceMock.processWebChatTurn).not.toHaveBeenCalled();
  });

  it('org em TRIAL dentro do teto: processa normal', async () => {
    planLimitsMock.getTrialLlmStage.mockResolvedValue({ capped: true, stage: 'NOVO', capUsd: 15 });

    const res = await invokeOrg(bodyBase());

    expect(res.statusCode).toBe(200);
    expect(planLimitsMock.consumeWebChatOrgReplyBudget).toHaveBeenCalledWith('org-1');
    expect(webChatServiceMock.processWebChatTurn).toHaveBeenCalledTimes(1);
  });

  it('org PAGANTE: limitador por org nem é consultado', async () => {
    const res = await invokeOrg(bodyBase());

    expect(res.statusCode).toBe(200);
    expect(res.body.reply).toBe('Olá! Como posso ajudar?');
    expect(planLimitsMock.consumeWebChatOrgReplyBudget).not.toHaveBeenCalled();
  });

  it('org sem webchat habilitado continua 404 (opt-in preservado)', async () => {
    webChatServiceMock.getWebChatOrgConfig.mockResolvedValue({ exists: true, enabled: false });

    const res = await invokeOrg(bodyBase());

    expect(res.statusCode).toBe(404);
    expect(webChatServiceMock.processWebChatTurn).not.toHaveBeenCalled();
  });
});
