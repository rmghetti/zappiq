/**
 * GET/PUT /api/ai-training/survey: teste de ROTA.
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
const executeRaw = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: {
      findUnique: (...a: any[]) => findUnique(...a),
      update: (...a: any[]) => update(...a),
    },
    $executeRaw: (...a: any[]) => executeRaw(...a),
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
  // Mesmo teto do server.ts, senão o body-parser devolve 413 antes da rota.
  app.use(express.json({ limit: '10mb' }));
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
  executeRaw.mockReset();
  executeRaw.mockResolvedValue(1);
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
    // A gravação é por CHAVE (jsonb_set), nunca o JSON inteiro de settings.
    expect(update).not.toHaveBeenCalled();
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const [sql, json, orgGravada] = executeRaw.mock.calls[0];
    expect(sql.join('?')).toContain("jsonb_set");
    expect(sql.join('?')).toContain("'{surveyAnswers}'");
    expect(JSON.parse(json)).toEqual(RESPOSTAS);
    expect(orgGravada).toBe(ORG);
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
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });
});

describe('a gravação não pode apagar o que outra requisição escreveu', () => {
  it('chave gravada por fora, entre a leitura e a escrita, sobrevive', () => {
    // Banco de mentira com settings de verdade. A leitura da rota dispara a
    // escrita concorrente: é exatamente a janela do defeito (A155, A156).
    let noBanco: Record<string, any> = { niche: 'padaria', surveyAnswers: { antigo: 'x' } };

    findUnique.mockImplementation(async () => {
      const lido = { settings: { ...noBanco }, name: 'Padaria' };
      noBanco = {
        ...noBanco,
        businessHoursConfig: { timezone: 'America/Sao_Paulo' },
        llm_routing: { tier: 'premium' },
      };
      return lido;
    });
    // Regravar o JSON inteiro é o defeito: deixamos o caminho aberto para o
    // teste falhar de verdade se alguém voltar a usá-lo.
    update.mockImplementation(async ({ data }: any) => {
      noBanco = data.settings;
      return {};
    });
    executeRaw.mockImplementation(async (_sql: any, json: string) => {
      noBanco = { ...noBanco, surveyAnswers: JSON.parse(json) };
      return 1;
    });

    return fetch(`${base}/api/ai-training/survey`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surveyAnswers: RESPOSTAS }),
    }).then(async (res) => {
      expect(res.status).toBe(200);
      expect(noBanco.surveyAnswers).toEqual(RESPOSTAS);
      expect(noBanco.businessHoursConfig).toEqual({ timezone: 'America/Sao_Paulo' });
      expect(noBanco.llm_routing).toEqual({ tier: 'premium' });
    });
  });

  it('os sources que a tela mostra vêm de leitura FRESCA, depois da escrita', async () => {
    findUnique
      .mockResolvedValueOnce({
        settings: {
          niche: 'padaria',
          surveySync: { status: 'ok', at: '2026-09-13T10:00:00.000Z', sources: ['survey-velho'] },
        },
        name: 'Padaria',
      })
      // O job da fila gravou surveySync no meio do caminho.
      .mockResolvedValueOnce({
        settings: {
          niche: 'padaria',
          surveySync: {
            status: 'ok',
            at: '2026-09-14T11:00:00.000Z',
            sources: ['survey-identidade_empresa', 'survey-precos_condicoes'],
          },
        },
      });

    await fetch(`${base}/api/ai-training/survey`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surveyAnswers: RESPOSTAS }),
    });

    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(marcarPendente.mock.calls[0][1]).toEqual({
      sources: ['survey-identidade_empresa', 'survey-precos_condicoes'],
    });
  });
});

describe('tetos de tamanho do questionário (A118)', () => {
  beforeEach(() => {
    findUnique.mockResolvedValue({ settings: { niche: 'padaria' }, name: 'Padaria' });
  });

  async function salvar(surveyAnswers: any) {
    const res = await fetch(`${base}/api/ai-training/survey`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surveyAnswers }),
    });
    return { res, corpo: await res.json() };
  }

  it('resposta acima de 8.000 caracteres é recusada com 422 em português', async () => {
    const { res, corpo } = await salvar({
      precos_condicoes: { pre_desconto_maximo: 'a'.repeat(8001) },
    });

    expect(res.status).toBe(422);
    expect(corpo.error).toBe('resposta_longa_demais');
    expect(corpo.message).toContain('8.000 caracteres');
    expect(corpo.campo).toBe('pre_desconto_maximo');
    expect(executeRaw).not.toHaveBeenCalled();
    expect(agendar).not.toHaveBeenCalled();
  });

  it('resposta de exatamente 8.000 caracteres passa', async () => {
    const { res } = await salvar({ precos_condicoes: { pre_desconto_maximo: 'a'.repeat(8000) } });
    expect(res.status).toBe(200);
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('o teto vale em qualquer profundidade do JSON', async () => {
    const { res, corpo } = await salvar({
      subsegmentos: { consultoria: { reg_nao_pode_prometer: 'b'.repeat(9000) } },
    });
    expect(res.status).toBe(422);
    expect(corpo.campo).toBe('reg_nao_pode_prometer');
  });

  it('questionário inteiro acima de 200 KB é recusado com 422 em português', async () => {
    // 40 respostas de 7.000 caracteres: cada uma cabe, o conjunto não.
    const grandes: Record<string, string> = {};
    for (let i = 0; i < 40; i++) grandes[`campo_${i}`] = 'c'.repeat(7000);

    const { res, corpo } = await salvar({ precos_condicoes: grandes });

    expect(res.status).toBe(422);
    expect(corpo.error).toBe('questionario_grande_demais');
    expect(corpo.message).toContain('200 KB');
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('questionário de tamanho normal passa sem reclamar', async () => {
    const { res } = await salvar(RESPOSTAS);
    expect(res.status).toBe(200);
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
