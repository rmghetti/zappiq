/**
 * settings.route.test.ts (A156)
 * ============================================================================
 * PUT /api/settings trocava o JSON `settings` inteiro. Duas consequências
 * reais, as duas provadas aqui:
 *
 *   1. O ADMIN de qualquer organização se dava add-on pago (`addons`) e forçava
 *      o roteamento de modelo (`llm_routing`) só mandando a chave no corpo.
 *   2. A tela reenviava o retrato lido no GET, que vem sem os segredos. Salvar
 *      o horário comercial apagava o que o servidor tinha gravado depois que a
 *      tela abriu (questionário, agendamento, add-on do Stripe).
 *
 * O contrato novo: o corpo é mesclado por chave (primeiro nível, e raso dentro
 * de `surveyAnswers`) e chave que só o servidor grava responde 400.
 *
 * Sem supertest (server.ts puxa Redis, OTel e BullMQ): mocamos o I/O, importamos
 * o router e chamamos o handler real, mesmo padrão de agentQuality.runAsync.test.ts.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Linha de organizations que o banco falso devolve e recebe. */
let organizacaoNoBanco: any = null;
/** `data` que a rota mandou para o prisma.organization.update. */
let dadosGravados: any = null;

const prismaMock: any = {
  organization: {
    findUnique: vi.fn(async () => organizacaoNoBanco),
    update: vi.fn(async ({ data }: any) => {
      dadosGravados = data;
      organizacaoNoBanco = {
        ...organizacaoNoBanco,
        ...data,
        settings: data.settings ?? organizacaoNoBanco.settings,
      };
      return organizacaoNoBanco;
    }),
  },
  user: { findMany: vi.fn(async () => []) },
};

vi.mock('@zappiq/database', () => ({ prisma: prismaMock, Prisma: {} }));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/planLimits.js', () => ({
  checkResourceLimit: () => (_req: any, _res: any, next: any) => next(),
  resourceLimitBody: vi.fn(() => ({})),
}));

vi.mock('../services/aiReadinessService.js', () => ({
  refreshAIReadiness: vi.fn(async () => null),
}));

vi.mock('../services/auditService.js', () => ({ logAuditEvent: vi.fn(async () => null) }));

vi.mock('../services/impulsoIntegrations.js', () => ({
  applyImpulsoIntegration: vi.fn(),
  readImpulsoIntegrationStatus: vi.fn(() => ({})),
}));

vi.mock('../services/channelCredentialCheck.js', () => ({
  checkWhatsappCredentials: vi.fn(),
  checkInstagramCredentials: vi.fn(),
}));

vi.mock('../services/instagramWebhookSetup.js', () => ({
  getInstagramWebhookStatus: vi.fn(),
  subscribeInstagramWebhooks: vi.fn(),
}));

vi.mock('../services/webhookVerifyToken.js', () => ({
  buildOrgWebhookVerifyToken: vi.fn(() => 'token-falso'),
}));

const { default: router } = await import('./settings.js');

type RouteLayer = {
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: any }> };
};

function pegaHandler(metodo: string, caminho: string) {
  const stack = (router as unknown as { stack: RouteLayer[] }).stack;
  const camada = stack.find(
    (l) => l.route?.path === caminho && !!l.route?.methods?.[metodo.toLowerCase()],
  );
  if (!camada || !camada.route) throw new Error(`rota ${metodo} ${caminho} não encontrada`);
  const rs = camada.route.stack;
  return rs[rs.length - 1].handle as (req: any, res: any, next?: any) => Promise<void>;
}

function fazRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn((b: any) => {
    res.body = b;
    return res;
  });
  return res;
}

/** Retrato de settings parecido com o de uma organização real. */
function settingsDeVerdade() {
  return {
    agentName: 'Vera',
    tone: 'consultivo',
    addons: ['agendamento'],
    llm_routing: { tier: 'sonnet' },
    flags: { consolidarBaloes: true },
    capiAccessTokenEnc: 'cifrado:abc',
    businessHoursConfig: { seg: '09:00-18:00' },
    surveyAnswers: {
      identidade_empresa: 'Consultoria jurídica em São Paulo',
      oferta_principal: 'Assessoria mensal',
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  dadosGravados = null;
  organizacaoNoBanco = {
    id: 'org-1',
    name: 'Cliente Teste',
    settings: settingsDeVerdade(),
  };
});

describe('PUT /api/settings — merge por chave (A156)', () => {
  it('PUT sem addons NÃO altera settings.addons nem apaga o segredo do servidor', async () => {
    const handler = pegaHandler('put', '/');
    const res = fazRes();
    // A tela do horário comercial manda só o que mudou.
    await handler(
      { organizationId: 'org-1', body: { settings: { businessHoursConfig: { seg: '08:00-17:00' } } } },
      res,
      vi.fn(),
    );

    expect(res.statusCode).toBe(200);
    expect(dadosGravados.settings.addons).toEqual(['agendamento']);
    expect(dadosGravados.settings.llm_routing).toEqual({ tier: 'sonnet' });
    expect(dadosGravados.settings.capiAccessTokenEnc).toBe('cifrado:abc');
    expect(dadosGravados.settings.businessHoursConfig).toEqual({ seg: '08:00-17:00' });
    expect(dadosGravados.settings.agentName).toBe('Vera');
  });

  it('PUT com addons responde 400 e não grava nada', async () => {
    const handler = pegaHandler('put', '/');
    const res = fazRes();
    await handler(
      { organizationId: 'org-1', body: { settings: { addons: ['mira', 'impulso'] } } },
      res,
      vi.fn(),
    );

    expect(res.statusCode).toBe(400);
    expect(prismaMock.organization.update).not.toHaveBeenCalled();
    expect(String(res.body?.error || '')).toMatch(/servidor/i);
    expect(res.body?.chaves).toContain('addons');
  });

  it('recusa também llm_routing, flags, stripe*, trial*, whatsapp*, instagram* e meta*', async () => {
    const handler = pegaHandler('put', '/');
    for (const chave of [
      'llm_routing',
      'flags',
      'consolidarBaloes',
      'miraAlpha',
      'stripeCustomerId',
      'trialEndsAt',
      'whatsappAccessToken',
      'instagramAccountId',
      'metaAppSecret',
    ]) {
      const res = fazRes();
      await handler({ organizationId: 'org-1', body: { settings: { [chave]: 'x' } } }, res, vi.fn());
      expect(res.statusCode, `${chave} deveria ser recusada`).toBe(400);
    }
    expect(prismaMock.organization.update).not.toHaveBeenCalled();
  });

  it('merge por chave preserva surveyAnswers.identidade_empresa ao gravar outra seção', async () => {
    const handler = pegaHandler('put', '/');
    const res = fazRes();
    await handler(
      {
        organizationId: 'org-1',
        body: { settings: { surveyAnswers: { oferta_principal: 'Assessoria trimestral' } } },
      },
      res,
      vi.fn(),
    );

    expect(res.statusCode).toBe(200);
    expect(dadosGravados.settings.surveyAnswers).toEqual({
      identidade_empresa: 'Consultoria jurídica em São Paulo',
      oferta_principal: 'Assessoria trimestral',
    });
  });

  it('PUT só com name não toca em settings', async () => {
    const handler = pegaHandler('put', '/');
    const res = fazRes();
    await handler({ organizationId: 'org-1', body: { name: 'Outro Nome' } }, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(dadosGravados.name).toBe('Outro Nome');
    expect(dadosGravados.settings).toBeUndefined();
  });
});
