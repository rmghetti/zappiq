/**
 * Documentos: source estável doc-<id>, título único e estado da ingestão.
 *
 * Os três defeitos que este arquivo tranca:
 *   A001 apagar um documento apagava os trechos de outro com o mesmo título;
 *   A002 apagar uma URL nunca apagava os trechos dela;
 *   A142 ingestão que falha não deixava rastro nenhum na tela.
 *
 * Mesmo harness do aiTraining.documents.route.test.ts: o router num Express nu,
 * com prisma, RAG e auth mockados, batendo HTTP de verdade.
 */
import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

const ORG = 'org-do-teste';

// Sequência do que aconteceu, na ordem. É o que prova que o documento nasce
// ANTES da ingestão, e não depois.
const passos: string[] = [];

const kbDoc = {
  findFirst: vi.fn(),
  findMany: vi.fn().mockResolvedValue([]),
  count: vi.fn().mockResolvedValue(0),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
const queryRaw = vi.fn().mockResolvedValue([]);

vi.mock('@zappiq/database', () => ({
  prisma: {
    kBDocument: {
      findFirst: (...a: any[]) => kbDoc.findFirst(...a),
      findMany: (...a: any[]) => kbDoc.findMany(...a),
      count: (...a: any[]) => kbDoc.count(...a),
      create: (...a: any[]) => kbDoc.create(...a),
      update: (...a: any[]) => kbDoc.update(...a),
      delete: (...a: any[]) => kbDoc.delete(...a),
    },
    knowledgeBase: {
      findFirst: vi.fn().mockResolvedValue({ id: 'kb-1' }),
      create: vi.fn().mockResolvedValue({ id: 'kb-1' }),
    },
    organization: { findUnique: vi.fn() },
    $queryRaw: (...a: any[]) => queryRaw(...a),
  },
}));

const ingestDocument = vi.fn();
const ingestUrl = vi.fn();
const deleteDocument = vi.fn().mockResolvedValue(undefined);
vi.mock('../services/ragService.js', async () => {
  const real = await vi.importActual<any>('../services/ragService.js');
  return {
    ...real,
    ingestDocument: (...a: any[]) => {
      passos.push('ingest');
      return ingestDocument(...a);
    },
    ingestUrl: (...a: any[]) => {
      passos.push('ingest-url');
      return ingestUrl(...a);
    },
    deleteDocument: (...a: any[]) => deleteDocument(...a),
    search: vi.fn(),
    searchWithSources: vi.fn(),
  };
});

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
  passos.length = 0;
  kbDoc.findFirst.mockReset().mockResolvedValue(null);
  kbDoc.findMany.mockReset().mockResolvedValue([]);
  kbDoc.count.mockReset().mockResolvedValue(0);
  kbDoc.create.mockReset().mockImplementation(async (args: any) => {
    passos.push(`create:${args.data.status}`);
    return { id: 'ckdoc1', createdAt: new Date('2026-09-14'), ...args.data };
  });
  kbDoc.update.mockReset().mockImplementation(async (args: any) => {
    passos.push(`update:${args.data.status ?? 'sem-status'}`);
    return { id: args.where.id, title: 'Proposta.pdf', sourceType: 'application/pdf', createdAt: new Date(), ...args.data };
  });
  kbDoc.delete.mockReset().mockResolvedValue({});
  queryRaw.mockReset().mockResolvedValue([]);
  ingestDocument.mockReset().mockResolvedValue({ chunks_ingested: 3 });
  ingestUrl.mockReset().mockResolvedValue({ chunks_ingested: 3 });
  deleteDocument.mockReset().mockResolvedValue(undefined);
});

const enviarArquivo = (nome: string, tipo = 'application/pdf', bytes = new Uint8Array([1, 2, 3])) => {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: tipo }), nome);
  return fetch(`${base}/api/ai-training/documents`, { method: 'POST', body: form });
};

const postJson = (caminho: string, corpo: unknown) =>
  fetch(`${base}/api/ai-training${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });

// ── Upload ──────────────────────────────────────────────────────────────────
describe('POST /documents, source estável e estado', () => {
  it('cria o documento em "processando" ANTES de mandar para o vetor', async () => {
    const res = await enviarArquivo('Proposta.pdf');

    expect(res.status).toBe(201);
    // A ordem é o ponto: até aqui o documento só nascia se a ingestão desse
    // certo, e uma falha não deixava rastro na tela (A142, A017b).
    expect(passos).toEqual(['create:processando', 'ingest', 'update:pronto']);
  });

  it('manda source doc-<id> e o título no metadata, nunca o título como source', async () => {
    await enviarArquivo('Proposta.pdf');

    const [org, payload] = ingestDocument.mock.calls[0];
    expect(org).toBe(ORG);
    expect(payload.source).toBe('doc-ckdoc1');
    expect(payload.metadata).toEqual({ titulo: 'Proposta.pdf' });
  });

  it('título repetido na mesma organização é recusado com 409, sem tocar no vetor', async () => {
    kbDoc.count.mockResolvedValue(1);

    const res = await enviarArquivo('Proposta.pdf');
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('Já existe um documento com este título. Renomeie ou apague o anterior.');
    expect(kbDoc.create).not.toHaveBeenCalled();
    expect(ingestDocument).not.toHaveBeenCalled();
  });

  it('ingestão recusada deixa o documento em "falhou" com o motivo, e repassa status e frase', async () => {
    const { RagRequestError } = await import('../services/ragService.js');
    ingestDocument.mockRejectedValue(
      new RagRequestError(415, 'Tipo de arquivo não aceito: envie PDF, Word (.docx), Excel (.xlsx), texto, Markdown ou CSV.'),
    );

    const res = await enviarArquivo('backup.zip', 'application/pdf');
    const body = await res.json();

    expect(res.status).toBe(415);
    expect(body.error).toContain('Word (.docx)');
    const falha = kbDoc.update.mock.calls.find((c: any[]) => c[0].data.status === 'falhou');
    expect(falha).toBeTruthy();
    expect(falha![0].data.motivo).toContain('Word (.docx)');
  });

  it('serviço de indexação fora do ar vira 503 em português, sem detalhe interno', async () => {
    ingestDocument.mockRejectedValue(new Error('fetch failed ECONNREFUSED 10.0.0.7'));

    const res = await enviarArquivo('Proposta.pdf');
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toBe('Não consegui indexar este conteúdo agora. Tente de novo em alguns minutos.');
    expect(body.error).not.toContain('ECONNREFUSED');
  });

  it('nome com acento chega íntegro ao título, apesar do latin1 do multer', async () => {
    // Fim a fim: o cliente escolhe "Ementa editável.pdf", o multipart viaja em
    // utf-8, o multer decodifica como latin1 e entregava "editaÌvel" para o
    // título, para o vetor e para a lista (achado A014).
    await enviarArquivo('Ementa editável.pdf');

    expect(kbDoc.create.mock.calls[0][0].data.title).toBe('Ementa editável.pdf');
  });
});

// ── Texto colado ────────────────────────────────────────────────────────────
describe('POST /documents/text', () => {
  it('usa doc-<id> como source', async () => {
    await postJson('/documents/text', {
      title: 'Política de troca',
      content: 'Aceitamos trocas em até 7 dias corridos, com nota fiscal.',
    });

    expect(ingestDocument.mock.calls[0][1].source).toBe('doc-ckdoc1');
    expect(passos).toEqual(['create:processando', 'ingest', 'update:pronto']);
  });

  it('título repetido é 409', async () => {
    kbDoc.count.mockResolvedValue(1);

    const res = await postJson('/documents/text', {
      title: 'Política de troca',
      content: 'Aceitamos trocas em até 7 dias corridos, com nota fiscal.',
    });

    expect(res.status).toBe(409);
    expect(ingestDocument).not.toHaveBeenCalled();
  });
});

// ── URL ─────────────────────────────────────────────────────────────────────
describe('POST /documents/url', () => {
  it('usa doc-<id> como source, e não hostname+caminho', async () => {
    await postJson('/documents/url', { url: 'https://cmj.com.br/cursos' });

    const [, url, opcoes] = ingestUrl.mock.calls[0];
    expect(url).toBe('https://cmj.com.br/cursos');
    expect(opcoes.source).toBe('doc-ckdoc1');
  });

  it('a mesma URL duas vezes é 409', async () => {
    kbDoc.count.mockResolvedValue(1);

    const res = await postJson('/documents/url', { url: 'https://cmj.com.br/cursos' });

    expect(res.status).toBe(409);
    expect(ingestUrl).not.toHaveBeenCalled();
  });

  it('rede social é recusada com 422 e a frase que diz o que fazer', async () => {
    const { RagRequestError, MENSAGEM_REDE_SOCIAL } = await import('../services/ragService.js');
    ingestUrl.mockRejectedValue(new RagRequestError(422, MENSAGEM_REDE_SOCIAL));

    const res = await postJson('/documents/url', { url: 'https://www.instagram.com/cmj' });
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toBe(MENSAGEM_REDE_SOCIAL);
  });
});

// ── Delete ──────────────────────────────────────────────────────────────────
describe('DELETE /documents/:id', () => {
  const DOC = {
    id: 'ckdoc1',
    title: 'Proposta.pdf',
    sourceType: 'application/pdf',
    sourceUrl: null,
  };

  it('apaga os trechos do próprio doc-<id>', async () => {
    kbDoc.findFirst.mockResolvedValue(DOC);
    kbDoc.findMany.mockResolvedValue([]); // nenhum outro documento na base

    const res = await fetch(`${base}/api/ai-training/documents/ckdoc1`, { method: 'DELETE' });

    expect(res.status).toBe(200);
    expect(deleteDocument).toHaveBeenCalledWith(ORG, 'doc-ckdoc1');
  });

  it('apaga também o source antigo enquanto este documento é o único dono dele', async () => {
    kbDoc.findFirst.mockResolvedValue(DOC);
    kbDoc.findMany.mockResolvedValue([]);

    await fetch(`${base}/api/ai-training/documents/ckdoc1`, { method: 'DELETE' });

    expect(deleteDocument).toHaveBeenCalledWith(ORG, 'Proposta.pdf');
  });

  it('NÃO apaga o source antigo quando outro documento tem o mesmo título', async () => {
    // É o defeito do CMJ em 21/08: apagar a duplicata levava junto os trechos
    // do documento que ficou, e ele passava a mostrar "não indexado".
    kbDoc.findFirst.mockResolvedValue(DOC);
    kbDoc.findMany.mockResolvedValue([
      { id: 'ckgemeo', title: 'Proposta.pdf', sourceType: 'application/pdf', sourceUrl: null },
    ]);

    await fetch(`${base}/api/ai-training/documents/ckdoc1`, { method: 'DELETE' });

    expect(deleteDocument).toHaveBeenCalledWith(ORG, 'doc-ckdoc1');
    expect(deleteDocument).not.toHaveBeenCalledWith(ORG, 'Proposta.pdf');
  });

  it('URL apaga os trechos pela derivação hostname+caminho, que é como foram gravados', async () => {
    // Antes o delete usava o título (a URL inteira), procurava um source que
    // não existe, respondia "apaguei 0" e a página continuava na base (A002).
    kbDoc.findFirst.mockResolvedValue({
      id: 'ckdoc2',
      title: 'https://cmj.com.br/cursos/',
      sourceType: 'url',
      sourceUrl: 'https://cmj.com.br/cursos/',
    });
    kbDoc.findMany.mockResolvedValue([]);

    await fetch(`${base}/api/ai-training/documents/ckdoc2`, { method: 'DELETE' });

    expect(deleteDocument).toHaveBeenCalledWith(ORG, 'doc-ckdoc2');
    expect(deleteDocument).toHaveBeenCalledWith(ORG, 'cmj.com.br/cursos');
  });
});

// ── Listagem ────────────────────────────────────────────────────────────────
describe('GET /documents', () => {
  it('conta os trechos pelo doc-<id> e mostra o estado', async () => {
    kbDoc.findMany.mockResolvedValue([
      {
        id: 'ckdoc1',
        title: 'Proposta.pdf',
        sourceType: 'application/pdf',
        sourceUrl: null,
        status: 'pronto',
        motivo: null,
        createdAt: new Date('2026-09-14'),
      },
    ]);
    queryRaw.mockResolvedValue([{ source: 'doc-ckdoc1', n: 7n }]);

    const body = await (await fetch(`${base}/api/ai-training/documents`)).json();

    expect(body.documents[0].ragChunks).toBe(7);
    expect(body.documents[0].status).toBe('pronto');
  });

  it('contagem indisponível devolve null, e não "não indexado" para a base inteira', async () => {
    kbDoc.findMany.mockResolvedValue([
      {
        id: 'ckdoc1',
        title: 'Proposta.pdf',
        sourceType: 'application/pdf',
        sourceUrl: null,
        status: 'pronto',
        motivo: null,
        createdAt: new Date('2026-09-14'),
      },
    ]);
    queryRaw.mockRejectedValue(new Error('conexão caiu'));

    const body = await (await fetch(`${base}/api/ai-training/documents`)).json();

    expect(body.documents[0].ragChunks).toBeNull();
  });
});
