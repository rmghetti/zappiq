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

// O limite real de upload é 20 MB. Mandar 20 MB por loopback só para ver um
// 413 é lento e escorregadio (o multer corta o fluxo no meio do envio), então
// o teste aperta o limite para 1 MB antes de o router ser importado. Em
// produção a variável não existe e vale o default de 20 MB.
process.env.AI_TRAINING_MAX_UPLOAD_MB = '1';

// ── Mocks: tudo que a rota toca fora do processo ────────────────────────────
const ORG = 'org-do-teste';

const findFirst = vi.fn();
const update = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: {
    kBDocument: {
      findFirst: (...a: any[]) => findFirst(...a),
      update: (...a: any[]) => update(...a),
      // A rota consulta os outros documentos da org para saber quem divide
      // cada source antigo antes de apagar qualquer coisa no vetor.
      findMany: vi.fn().mockResolvedValue([]),
      // Título repetido na mesma org é 409. Nenhum documento repetido aqui.
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(async () => ({
        id: 'doc-novo',
        title: 'novo',
        sourceType: 'url',
        sourceUrl: 'https://site.exemplo.com.br/manual',
        status: 'processando',
        createdAt: new Date('2026-09-14'),
      })),
      delete: vi.fn(),
    },
    // A rota de URL passa por ensureKnowledgeBase antes de ingerir.
    knowledgeBase: {
      findFirst: vi.fn(async () => ({ id: 'kb-1' })),
      create: vi.fn(async () => ({ id: 'kb-1' })),
    },
    organization: { findUnique: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

const ingestDocument = vi.fn().mockResolvedValue(undefined);
const deleteDocument = vi.fn().mockResolvedValue(undefined);
const ingestUrl = vi.fn().mockResolvedValue(undefined);
// O módulo real entra por baixo: a rota usa dele o `falhaDeIngestao`, que
// traduz o erro da ingestão no status e na frase que o cliente lê. Só as
// funções que saem do processo são substituídas.
vi.mock('../services/ragService.js', async () => {
  const real = await vi.importActual<any>('../services/ragService.js');
  return {
    ...real,
    ingestDocument: (...a: any[]) => ingestDocument(...a),
    deleteDocument: (...a: any[]) => deleteDocument(...a),
    ingestUrl: (...a: any[]) => ingestUrl(...a),
    search: vi.fn(),
    searchWithSources: vi.fn(),
  };
});

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
  const { errorHandler } = await import('../middleware/errorHandler.js');
  const app = express();
  app.use(express.json());
  app.use('/api/ai-training', router);
  // O errorHandler de produção entra aqui porque é ele que traduz o erro do
  // multer em 413/415. Sem ele, o teste mediria o handler padrão do Express.
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
  findFirst.mockReset();
  update.mockReset();
  ingestDocument.mockClear();
  deleteDocument.mockClear();
  ingestUrl.mockReset();
  ingestUrl.mockResolvedValue(undefined);
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
    // O texto novo e o estado 'processando' entram juntos, ANTES da
    // reingestão: o 'pronto' só vem depois que o vetor aceitou. Marcar
    // 'pronto' de saída deixava o documento verde na tela mesmo quando a
    // reingestão falhava, com zero trecho no vetor (revisão PI-3).
    expect(update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: {
          title: 'Política de troca',
          content: 'Trocas em até 30 dias corridos, com nota fiscal e produto sem uso.',
          status: 'processando',
          motivo: null,
        },
      }),
    );
    // Edição bem-sucedida devolve o documento ao estado 'pronto': se a
    // ingestão anterior tinha falhado, a lista não pode continuar mostrando o
    // erro antigo (achado A142).
    expect(update.mock.calls.at(-1)![0].data).toEqual({ status: 'pronto', motivo: null });
    expect(ingestDocument).toHaveBeenCalledTimes(1);
    const [org, payload] = ingestDocument.mock.calls[0];
    expect(org).toBe(ORG);
    // O source é doc-<id>, não mais o título: dois documentos com o mesmo
    // título deixaram de dividir o mesmo lugar no vetor (achado A001).
    expect(payload.source).toBe('doc-doc-1');
    expect(payload.content.toString('utf-8')).toContain('30 dias');
    // O source ANTIGO (o título) sai junto: ele guarda a versão anterior deste
    // mesmo texto enquanto o reprocessamento do RAG não roda.
    expect(deleteDocument).toHaveBeenCalledWith(ORG, 'Política de troca');
  });

  it('título alterado: remove os chunks do título antigo antes de ingerir o novo', async () => {
    findFirst.mockResolvedValue(TEXT_DOC);
    update.mockResolvedValue({ ...TEXT_DOC, title: 'Política de troca e devolução' });

    await put('doc-1', {
      title: 'Política de troca e devolução',
      content: 'Trocas em até 30 dias corridos, com nota fiscal e produto sem uso.',
    });

    expect(deleteDocument).toHaveBeenCalledWith(ORG, 'Política de troca');
    expect(ingestDocument.mock.calls[0][1].source).toBe('doc-doc-1');
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

  it('falha do RAG salva o texto, mas diz que não indexou e marca o documento', async () => {
    // Era "best-effort": respondia 200 e a lista mostrava o documento pronto
    // com o conteúdo velho (ou nenhum) no vetor. O texto continua salvo no
    // Postgres, mas o cliente precisa saber que a IA ainda não sabe disso.
    findFirst.mockResolvedValue(TEXT_DOC);
    update.mockResolvedValue(TEXT_DOC);
    ingestDocument.mockRejectedValueOnce(new Error('vector store fora do ar'));

    const res = await put('doc-1', {
      title: 'Política de troca',
      content: 'Trocas em até 30 dias corridos, com nota fiscal e produto sem uso.',
    });
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toBe('Não consegui indexar este conteúdo agora. Tente de novo em alguns minutos.');
    expect(update.mock.calls.at(-1)![0].data.status).toBe('falhou');
    expect(deleteDocument).not.toHaveBeenCalled();
  });
});

// ── POST /documents (upload) ────────────────────────────────────────────────
// O upload é a porta mais exposta do Treinar IA: qualquer conta com plano
// ativo chega nela. Os dois casos abaixo provam que ela recusa em português,
// com o status certo, e sem tocar no vector store.
describe('POST /api/ai-training/documents, recusas de upload', () => {
  const enviar = (nome: string, tipo: string, bytes: Uint8Array) => {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: tipo }), nome);
    return fetch(`${base}/api/ai-training/documents`, { method: 'POST', body: form });
  };

  it('arquivo executável é recusado com 415 e mensagem em português', async () => {
    const res = await enviar('malware.exe', 'application/x-msdownload', new Uint8Array([77, 90]));
    const body = await res.json();

    expect(res.status).toBe(415);
    expect(body.error).toBe(
      'Tipo de arquivo não aceito: envie PDF, Word (.docx), Excel (.xlsx), texto, Markdown ou CSV.',
    );
    expect(ingestDocument).not.toHaveBeenCalled();
  });

  it('planilha .xlsx PASSA pelo filtro desde que a extração existe', async () => {
    // Word e Excel voltaram à lista em 14/09/2026, com os conversores de
    // services/rag/extractors.py (mammoth e openpyxl). Aqui só provamos que o
    // arquivo atravessa o filtro; o que o handler faz depois é outro teste.
    const res = await enviar(
      'tabela.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      new Uint8Array([80, 75]),
    );

    expect(res.status).not.toBe(415);
  });

  it('o .xls do Office 97 continua recusado com 415', async () => {
    // Nenhuma biblioteca livre lê o binário antigo com confiança: recusar na
    // porta é mais honesto do que aceitar o upload e falhar depois.
    const res = await enviar('planilha.xls', 'application/vnd.ms-excel', new Uint8Array([208, 207]));

    expect(res.status).toBe(415);
    expect(ingestDocument).not.toHaveBeenCalled();
  });

  it('.csv que o Windows rotula como Excel PASSA pelo filtro', async () => {
    // O navegador manda o mime do programa que abre a extensão, não o do
    // conteúdo: no Windows um .csv chega como application/vnd.ms-excel. Antes
    // de 14/09/2026 o filtro recusava, e o cliente que mandou o arquivo certo
    // levava 415 sem ter como entender o motivo. Aqui só provamos que ele
    // atravessa o filtro; o que o handler faz depois é outro teste.
    const res = await enviar(
      'tabela-de-precos.csv',
      'application/vnd.ms-excel',
      new Uint8Array([110, 111, 109, 101, 10]),
    );

    expect(res.status).not.toBe(415);
  });

  it('arquivo acima do limite é recusado com 413, com o limite REAL na mensagem', async () => {
    const grande = new Uint8Array(1024 * 1024 + 4096); // 1 MB + folga, acima do limite do teste
    const res = await enviar('contrato.pdf', 'application/pdf', grande);
    const body = await res.json();

    expect(res.status).toBe(413);
    // O limite aqui é 1 MB (a variável de ambiente lá em cima). A mensagem tem
    // de dizer 1 MB, e não 20: até 14/09/2026 o número estava escrito à mão no
    // errorHandler, então quem apertasse o limite por variável de ambiente
    // mandava o cliente procurar um problema que não existia.
    expect(body.error).toBe('Arquivo maior que 1 MB. Divida o arquivo ou envie um menor.');
    expect(ingestDocument).not.toHaveBeenCalled();
  });
});

// ── POST /documents/url ─────────────────────────────────────────────────────
describe('POST /api/ai-training/documents/url (P4 da revisão do PR #369)', () => {
  const postUrl = (url: string) =>
    fetch(`${base}/api/ai-training/documents/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

  it('endereço interno responde 422 com a frase em português', async () => {
    // Aqui a ingestão de VERDADE entra: o portão de destino (urlSegura.ts)
    // recusa o endereço interno sem tocar em DNS nem em rede, o ingestUrl
    // traduz para a frase que o cliente lê, e a rota responde com ela. Se
    // qualquer elo dessa corrente cair, o cliente volta a ver 500 ou "tente de
    // novo em alguns minutos" para um endereço que nunca vai funcionar.
    const real = await vi.importActual<any>('../services/ragService.js');
    ingestUrl.mockImplementation((...a: any[]) => real.ingestUrl(...a));
    // A rota marca o documento como falho antes de responder.
    update.mockResolvedValue({ id: 'doc-novo', status: 'falhou' });

    const res = await postUrl('http://10.0.0.7/segredo');
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toBe(real.MENSAGEM_URL_NAO_PUBLICA);
  });

  it('URL pública segue criando o documento', async () => {
    ingestUrl.mockResolvedValue(undefined);
    update.mockResolvedValue({ id: 'doc-novo', status: 'pronto' });
    const res = await postUrl('https://site.exemplo.com.br/manual');
    expect(res.status).toBe(201);
    expect(ingestUrl).toHaveBeenCalledWith(
      ORG,
      'https://site.exemplo.com.br/manual',
      expect.any(Object),
    );
  });
});
