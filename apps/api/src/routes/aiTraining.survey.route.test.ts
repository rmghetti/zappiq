/**
 * GET/PUT /api/ai-training/survey — teste de ROTA.
 *
 * Prova o que a lógica pura não alcança: que o salvamento do questionário
 * NÃO ingere nada dentro da requisição (A007) e que a tela recebe o estado
 * da sincronização em vez de um "salvo" que não quer dizer nada (A008).
 *
 * Mesmo desenho dos outros testes de rota daqui: router num Express nu,
 * prisma, RAG e auth mockados, HTTP de verdade por fetch.
 */
import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

const ORG = 'org-do-teste';

const findUnique = vi.fn();
const update = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: {
      findUnique: (...a: any[]) => findUnique(...a),
      update: (...a: any[]) => update(...a),
    },
    kBDocument: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    knowledgeBase: { findFirst: vi.fn(), create: vi.fn() },
    auditLog: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

// O vetor não pode ser tocado pelo salvamento: é isso que o teste prova.
const ingestDocument = vi.fn().mockResolvedValue(undefined);
const deleteDocument = vi.fn().mockResolvedValue(undefined);
vi.mock('../services/ragService.js', async () => {
  const real = await vi.importActual<any>('../services/ragService.js');
  return {
    ...real,
    ingestDocument: (...a: any[]) => ingestDocument(...a),
    deleteDocument: (...a: any[]) => deleteDocument(...a),
    ingestUrl: vi.fn(),
    search: vi.fn(),
    searchWithSources: vi.fn(),
  };
});

const agendar = vi.fn().mockResolvedValue({ jobId: 'survey-reingest:org-do-teste', acao: 'criado' });
const marcarPendente = vi.fn(async (_org: string, opts: any) => ({
  status: 'pendente',
  at: '2026-09-14T12:00:00.000Z',
  sources: opts?.sources,
}));
vi.mock('../services/surveyReingest.js', () => ({
  agendarReingestaoDoQuestionario: (...a: any[]) => agendar(...a),
  marcarSincronizacaoPendente: (...a: any[]) => (marcarPendente as any)(...a),
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { organizationId: ORG, id: 'user-1', email: 'teste@zappiq.com.br', role: 'ADMIN' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../services/aiReadinessService.js', () => ({
  refreshAIReadiness: vi.fn().mockResolvedValue({ score: 42 }),
  computeAIReadiness: vi.fn().mockResolvedValue({ score: 42 }),
}));
vi.mock('../services/auditService.js', () => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../agents/agentOrchestrator.js', () => ({
  buildSystemPromptForContact: vi.fn(),
  pickTierAndOverride: vi.fn(),
}));
vi.mock('../services/llm/izaTurnRouter.js', () => ({ routeIzaTurn: vi.fn() }));
vi.mock('../services/llm/tools.js', () => ({ getToolsForContext: vi.fn(() => []) }));
vi.mock('../services/agentIdentitySync.js', () => ({ syncAgentIdentity: vi.fn() }));

let server: Server;
let base: string;

beforeAll(async () => {
  const { default: router } = await import('./aiTraining.js');
  const { errorHandler } = await import('../middleware/errorHandler.js');
  const app = express();
  app.use(express.json());
  app.use('/api/ai-training', router);
  app.use(errorHandler);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as any).port}`;
      resolve();
    });
  });
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
  update.mockResolvedValue({});
  ingestDocument.mockClear();
  deleteDocument.mockClear();
  agendar.mockClear();
  marcarPendente.mockClear();
});

const RESPOSTAS = {
  identidade_empresa: { ide_endereco_principal: 'Rua das Flores, 10' },
};

describe('PUT /api/ai-training/survey', () => {
  it('salva, agenda a reingestão e NÃO ingere nada na própria requisição', async () => {
    findUnique.mockResolvedValue({ settings: { niche: 'padaria' }, name: 'Padaria' });

    const res = await fetch(`${base}/api/ai-training/survey`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surveyAnswers: RESPOSTAS }),
    });
    const corpo = await res.json();

    expect(res.status).toBe(200);
    expect(ingestDocument).not.toHaveBeenCalled();
    expect(agendar).toHaveBeenCalledWith(ORG);
    expect(corpo.reingestaoAgendada).toBe(true);
    expect(corpo.surveySync.status).toBe('pendente');
    expect(update).toHaveBeenCalledTimes(1);
    const gravado = update.mock.calls[0][0].data.settings;
    expect(gravado.surveyAnswers).toEqual(RESPOSTAS);
    // O estado da sincronização é gravado POR CHAVE, fora do JSON inteiro.
    expect(gravado.surveySync).toBeUndefined();
    expect(marcarPendente).toHaveBeenCalledTimes(1);
    // Não pode apagar o que já está no ar: até o job rodar, a IA continua
    // com a versão anterior do questionário.
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it('dez salvamentos em rajada agendam, nunca ingerem', async () => {
    findUnique.mockResolvedValue({ settings: { niche: 'padaria' }, name: 'Padaria' });

    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${base}/api/ai-training/survey`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surveyAnswers: { ...RESPOSTAS, contador: String(i) } }),
      });
      expect(res.status).toBe(200);
    }

    expect(ingestDocument).not.toHaveBeenCalled();
    expect(agendar).toHaveBeenCalledTimes(10);
  });

  it('guarda os sources que a IA já tem, para a tela dizer o que está no ar', async () => {
    findUnique.mockResolvedValue({
      settings: {
        niche: 'padaria',
        surveySync: { status: 'ok', at: '2026-09-13T10:00:00.000Z', sources: ['survey-identidade_empresa'] },
      },
      name: 'Padaria',
    });

    await fetch(`${base}/api/ai-training/survey`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surveyAnswers: RESPOSTAS }),
    });

    expect(marcarPendente.mock.calls[0][1]).toEqual({ sources: ['survey-identidade_empresa'] });
  });

  it('agendamento que falha não derruba o salvamento do cliente', async () => {
    findUnique.mockResolvedValue({ settings: { niche: 'padaria' }, name: 'Padaria' });
    agendar.mockRejectedValueOnce(new Error('Redis fora do ar'));

    const res = await fetch(`${base}/api/ai-training/survey`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surveyAnswers: RESPOSTAS }),
    });
    const corpo = await res.json();

    expect(res.status).toBe(200);
    expect(corpo.reingestaoAgendada).toBe(false);
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/ai-training/survey', () => {
  it('devolve o estado da sincronização junto das respostas', async () => {
    findUnique.mockResolvedValue({
      settings: {
        niche: 'padaria',
        segmento: 'padaria',
        subsegmentos: ['padaria_artesanal'],
        surveyAnswers: RESPOSTAS,
        surveySync: { status: 'falhou', at: '2026-09-14T10:00:00.000Z', motivo: 'RAG fora do ar' },
      },
    });

    const res = await fetch(`${base}/api/ai-training/survey`);
    const corpo = await res.json();

    expect(res.status).toBe(200);
    expect(corpo.surveySync).toEqual({
      status: 'falhou',
      at: '2026-09-14T10:00:00.000Z',
      motivo: 'RAG fora do ar',
    });
    expect(corpo.segmento).toBe('padaria');
    expect(corpo.subsegmentos).toEqual(['padaria_artesanal']);
    expect(corpo.answeredCount).toBe(1);
  });

  it('organização que nunca sincronizou devolve null, não um estado inventado', async () => {
    findUnique.mockResolvedValue({ settings: { niche: 'padaria', surveyAnswers: {} } });
    const corpo = await (await fetch(`${base}/api/ai-training/survey`)).json();
    expect(corpo.surveySync).toBeNull();
  });
});
