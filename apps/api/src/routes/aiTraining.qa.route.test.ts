/**
 * POST/PUT /api/ai-training/qa (teste de ROTA).
 *
 * A009: a prioridade (0 a 10) do Q&A era gravada em qa_pairs e usada só para
 * ordenar a lista na tela. O texto ingerido era "Pergunta: ... Resposta: ..."
 * sem prioridade nenhuma, e o re-rank do serviço aplicava o mesmo fator a todo
 * source qa-*. O guia promete "elas ganham preferência quando a IA busca
 * contexto".
 *
 * A011: a resposta pode ter 4.000 caracteres e o chunk é de 512 tokens, então
 * um Q&A longo virava 2 ou 3 trechos e só o primeiro carregava "Pergunta:".
 *
 * Mesmo harness do aiTraining.documents.route.test.ts: router num Express nu,
 * prisma/RAG/auth mockados, HTTP de verdade.
 */
import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

const ORG = 'org-do-teste';

const qaCreate = vi.fn();
const qaUpdate = vi.fn();
const qaFindFirst = vi.fn();
const qaDelete = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: {
    QAPair: {
      create: (...a: any[]) => qaCreate(...a),
      update: (...a: any[]) => qaUpdate(...a),
      findFirst: (...a: any[]) => qaFindFirst(...a),
      findMany: vi.fn().mockResolvedValue([]),
      delete: (...a: any[]) => qaDelete(...a),
    },
    kBDocument: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    organization: { findUnique: vi.fn(), update: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

const ingestDocument = vi.fn().mockResolvedValue(undefined);
const deleteDocument = vi.fn().mockResolvedValue(undefined);
vi.mock('../services/ragService.js', () => ({
  ingestDocument: (...a: any[]) => ingestDocument(...a),
  deleteDocument: (...a: any[]) => deleteDocument(...a),
  ingestUrl: vi.fn(),
  urlToSource: (u: string) => u,
  search: vi.fn(),
  searchDetailed: vi.fn(),
  searchWithSources: vi.fn(),
  namespaceFor: (o: string) => `org_${o}`,
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { organizationId: ORG, id: 'user-1', email: 'teste@zappiq.com.br', role: 'ADMIN' };
    next();
  },
}));

vi.mock('../services/aiReadinessService.js', () => ({
  refreshAIReadiness: vi.fn().mockResolvedValue({ score: 42 }),
  computeAIReadiness: vi.fn().mockResolvedValue({ score: 42 }),
}));
vi.mock('../services/auditService.js', () => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/knowledgeBaseBuilder.js', () => ({
  buildKnowledgeBase: vi.fn(),
  surveyDocFilename: vi.fn(() => 'survey.txt'),
  countAnsweredQuestions: vi.fn(() => 0),
}));
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
  const app = express();
  app.use(express.json());
  app.use('/api/ai-training', router);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as any).port}`;
      resolve();
    });
  });
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  qaCreate.mockReset();
  qaUpdate.mockReset();
  qaFindFirst.mockReset();
  ingestDocument.mockClear();
  deleteDocument.mockClear();
});

const post = (body: unknown) =>
  fetch(`${base}/api/ai-training/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const put = (id: string, body: unknown) =>
  fetch(`${base}/api/ai-training/qa/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/** Terceiro argumento de ingestDocument: as opções (metadata + singleChunk). */
const opcoesDaIngestao = () => ingestDocument.mock.calls[0][2];

describe('POST /qa: prioridade e categoria viram metadata (A009)', () => {
  it('manda priority e category na metadata do trecho', async () => {
    qaCreate.mockResolvedValue({
      id: 'qa-1',
      question: 'voces entregam no interior?',
      answer: 'sim, entregamos em todo o estado.',
      category: 'entrega',
      priority: 8,
      isActive: true,
    });

    const res = await post({
      question: 'voces entregam no interior?',
      answer: 'sim, entregamos em todo o estado.',
      category: 'entrega',
      priority: 8,
    });

    expect(res.status).toBe(201);
    expect(ingestDocument).toHaveBeenCalledTimes(1);
    expect(opcoesDaIngestao().metadata).toMatchObject({
      kind: 'qa',
      priority: 8,
      category: 'entrega',
    });
  });

  it('Q&A vai para o RAG como UM trecho só (A011)', async () => {
    qaCreate.mockResolvedValue({
      id: 'qa-2',
      question: 'qual a politica de troca?',
      answer: 'x'.repeat(3900),
      category: null,
      priority: 0,
      isActive: true,
    });

    await post({ question: 'qual a politica de troca?', answer: 'x'.repeat(3900) });

    expect(opcoesDaIngestao().singleChunk).toBe(true);
  });

  it('sem categoria, a metadata sai com category nula e não quebra', async () => {
    qaCreate.mockResolvedValue({
      id: 'qa-3',
      question: 'tem estacionamento?',
      answer: 'sim, gratuito.',
      category: null,
      priority: 0,
      isActive: true,
    });

    await post({ question: 'tem estacionamento?', answer: 'sim, gratuito.' });

    expect(opcoesDaIngestao().metadata).toMatchObject({ kind: 'qa', priority: 0, category: null });
  });
});

describe('PUT /qa/:id: a prioridade editada chega na busca', () => {
  it('reingere com a prioridade NOVA', async () => {
    qaFindFirst.mockResolvedValue({
      id: 'qa-1',
      question: 'voces entregam no interior?',
      answer: 'sim',
      priority: 0,
      category: 'entrega',
      isActive: true,
    });
    qaUpdate.mockResolvedValue({
      id: 'qa-1',
      question: 'voces entregam no interior?',
      answer: 'sim, entregamos em todo o estado.',
      category: 'entrega',
      priority: 10,
      isActive: true,
    });

    const res = await put('qa-1', { priority: 10 });

    expect(res.status).toBe(200);
    expect(opcoesDaIngestao().metadata).toMatchObject({ priority: 10, category: 'entrega' });
    expect(opcoesDaIngestao().singleChunk).toBe(true);
  });

  it('desativar continua REMOVENDO o Q&A do vetor, sem reingerir', async () => {
    qaFindFirst.mockResolvedValue({
      id: 'qa-1',
      question: 'pergunta',
      answer: 'resposta',
      priority: 3,
      category: null,
      isActive: true,
    });
    qaUpdate.mockResolvedValue({
      id: 'qa-1',
      question: 'pergunta',
      answer: 'resposta',
      category: null,
      priority: 3,
      isActive: false,
    });

    const res = await put('qa-1', { isActive: false });

    expect(res.status).toBe(200);
    expect(deleteDocument).toHaveBeenCalledWith(ORG, 'qa-qa-1.txt');
    expect(ingestDocument).not.toHaveBeenCalled();
  });
});
