/**
 * GET/PUT /api/ai-training/documents/:id — teste de ROTA.
 *
 * O repo não tem harness supertest (server.ts puxa Redis/OTel/BullMQ), então
 * aqui montamos só o router de ai-training num Express nu, com prisma, RAG e
 * auth mockados, e batemos HTTP de verdade via fetch. Cobre o que a lógica pura
 * (aiTraining.text.util.test.ts) não alcança: tenant scoping, o gate de
 * sourceType e os argumentos exatos das chamadas ao vector store.
 */
import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// ── Mocks: tudo que a rota toca fora do processo ────────────────────────────
const ORG = 'org-do-teste';

const findFirst = vi.fn();
const update = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: {
    kBDocument: {
      findFirst: (...a: any[]) => findFirst(...a),
      update: (...a: any[]) => update(...a),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    organization: { findUnique: vi.fn() },
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
  searchWithSources: vi.fn(),
  namespaceFor: (o: string) => `org_${o}`,
}));

// Auth: injeta a org do teste, sem JWT.
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { organizationId: ORG, id: 'user-1', email: 'teste@zappiq.com.br', role: 'ADMIN' };
    next();
  },
}));

// Colaterais que a rota chama mas não são o alvo do teste.
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
  findFirst.mockReset();
  update.mockReset();
  ingestDocument.mockClear();
  deleteDocument.mockClear();
});

const TEXT_DOC = {
  id: 'doc-1',
  title: 'Política de troca',
  sourceType: 'text',
  sourceUrl: null,
  content: 'Aceitamos trocas em até 7 dias corridos, com nota fiscal e produto sem uso.',
  createdAt: new Date('2026-07-01'),
};

const put = (id: string, body: unknown) =>
  fetch(`${base}/api/ai-training/documents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// ── GET /documents/:id ──────────────────────────────────────────────────────
describe('GET /api/ai-training/documents/:id', () => {
  it('devolve o conteúdo e marca texto colado como editável', async () => {
    findFirst.mockResolvedValue(TEXT_DOC);
    const res = await fetch(`${base}/api/ai-training/documents/doc-1`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.document.content).toBe(TEXT_DOC.content);
    expect(body.document.editable).toBe(true);
  });

  it('arquivo vem como NÃO editável (conteúdo é derivado da fonte)', async () => {
    findFirst.mockResolvedValue({ ...TEXT_DOC, sourceType: 'application/pdf', content: '' });
    const body = await (await fetch(`${base}/api/ai-training/documents/doc-1`)).json();
    expect(body.document.editable).toBe(false);
  });

  it('404 quando o doc é de outra org (tenant scoping)', async () => {
    findFirst.mockResolvedValue(null); // where inclui organizationId → não acha
    const res = await fetch(`${base}/api/ai-training/documents/doc-de-outro`);
    expect(res.status).toBe(404);
  });

  it('consulta sempre escopada pela org do usuário autenticado', async () => {
    findFirst.mockResolvedValue(TEXT_DOC);
    await fetch(`${base}/api/ai-training/documents/doc-1`);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1', knowledgeBase: { organizationId: ORG } },
      }),
    );
  });
});

// ── PUT /documents/:id ──────────────────────────────────────────────────────
describe('PUT /api/ai-training/documents/:id', () => {
  it('salva a edição e reingere no RAG sob o mesmo título', async () => {
    findFirst.mockResolvedValue(TEXT_DOC);
    update.mockResolvedValue({ ...TEXT_DOC, content: 'novo' });

    const res = await put('doc-1', {
      title: 'Política de troca',
      content: 'Trocas em até 30 dias corridos, com nota fiscal e produto sem uso.',
    });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: {
          title: 'Política de troca',
          content: 'Trocas em até 30 dias corridos, com nota fiscal e produto sem uso.',
        },
      }),
    );
    // Título igual → replace-on-ingest cobre, sem delete.
    expect(deleteDocument).not.toHaveBeenCalled();
    expect(ingestDocument).toHaveBeenCalledTimes(1);
    const [org, payload] = ingestDocument.mock.calls[0];
    expect(org).toBe(ORG);
    expect(payload.filename).toBe('Política de troca');
    expect(payload.content.toString('utf-8')).toContain('30 dias');
  });

  it('título alterado: remove os chunks do título antigo antes de ingerir o novo', async () => {
    findFirst.mockResolvedValue(TEXT_DOC);
    update.mockResolvedValue({ ...TEXT_DOC, title: 'Política de troca e devolução' });

    await put('doc-1', {
      title: 'Política de troca e devolução',
      content: 'Trocas em até 30 dias corridos, com nota fiscal e produto sem uso.',
    });

    expect(deleteDocument).toHaveBeenCalledWith(ORG, 'Política de troca');
    expect(ingestDocument.mock.calls[0][1].filename).toBe('Política de troca e devolução');
  });

  it('REJEITA edição de URL e de arquivo (400, sem tocar no banco nem no RAG)', async () => {
    for (const sourceType of ['url', 'application/pdf']) {
      findFirst.mockResolvedValue({ ...TEXT_DOC, sourceType });
      const res = await put('doc-1', {
        title: 'Tentando editar',
        content: 'Conteúdo qualquer com tamanho suficiente para passar no schema.',
      });
      expect(res.status).toBe(400);
      expect(update).not.toHaveBeenCalled();
      expect(ingestDocument).not.toHaveBeenCalled();
    }
  });

  it('404 quando o doc é de outra org — não edita nem sincroniza', async () => {
    findFirst.mockResolvedValue(null);
    const res = await put('doc-de-outro', {
      title: 'Invasão',
      content: 'Conteúdo qualquer com tamanho suficiente para passar no schema.',
    });
    expect(res.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
    expect(ingestDocument).not.toHaveBeenCalled();
  });

  it('rejeita payload inválido antes de chegar ao handler', async () => {
    findFirst.mockResolvedValue(TEXT_DOC);
    const res = await put('doc-1', { title: 'ok', content: 'curto' }); // < 20 chars
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('falha do RAG não derruba a edição (best-effort, igual ao Q&A)', async () => {
    findFirst.mockResolvedValue(TEXT_DOC);
    update.mockResolvedValue(TEXT_DOC);
    ingestDocument.mockRejectedValueOnce(new Error('vector store fora do ar'));

    const res = await put('doc-1', {
      title: 'Política de troca',
      content: 'Trocas em até 30 dias corridos, com nota fiscal e produto sem uso.',
    });

    expect(res.status).toBe(200); // conteúdo salvo no banco; RAG reconcilia depois
  });
});
