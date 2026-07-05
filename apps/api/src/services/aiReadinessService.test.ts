/**
 * W3.8 — aiReadinessScore e o "teatro" dos 45 pontos.
 *
 * Bug: 25 (docs) + 20 (Q&A) = 45 dos 100 pontos contavam LINHAS em
 * kb_documents / qa_pairs no Postgres, sem validar que aquele conteúdo virou
 * chunks recuperáveis no serviço RAG. Com o RAG antes morto, esses pontos eram
 * "teatro" — o cliente via score alto, mas a IA não conseguia usar nada.
 *
 * Fix: gate por chunks REAIS por namespace (rag_chunks, source qa-* separa Q&A
 * de documento). Estes testes provam:
 *   - as funções puras de score zeram sem chunks e pontuam com chunks;
 *   - computeAIReadiness só concede docs/Q&A quando há chunks no namespace;
 *   - fail-soft: rag_chunks inexistente → 0 chunks → 0 pontos, sem crash.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// namespaceFor é puro; mockamos o módulo ragService inteiro pra NÃO carregar
// axios/cache/env no unit test.
vi.mock('./ragService.js', () => ({
  namespaceFor: (id: string) => (id.startsWith('org_') ? id : `org_${id}`),
}));

const orgFindUnique = vi.fn();
const orgUpdate = vi.fn();
const kbCount = vi.fn();
const qaCount = vi.fn();
const msgCount = vi.fn();
const queryRaw = vi.fn();

vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: {
      findUnique: (...a: unknown[]) => orgFindUnique(...a),
      update: (...a: unknown[]) => orgUpdate(...a),
    },
    kBDocument: { count: (...a: unknown[]) => kbCount(...a) },
    QAPair: { count: (...a: unknown[]) => qaCount(...a) },
    message: { count: (...a: unknown[]) => msgCount(...a) },
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
  },
}));

const {
  documentsScoreFor,
  qaScoreFor,
  countRagChunksByNamespace,
  computeAIReadiness,
} = await import('./aiReadinessService.js');

beforeEach(() => {
  vi.clearAllMocks();
});

// ── funções puras de score (o coração do gate) ─────────────────────────────
describe('documentsScoreFor — gate de chunks reais', () => {
  it('zera quando não há chunks de documento, mesmo com docs no Postgres', () => {
    expect(documentsScoreFor(10, 0)).toBe(0);
  });

  it('pontua normalmente quando há chunks (>=1)', () => {
    expect(documentsScoreFor(1, 3)).toBe(10);   // 1 doc = 10
    expect(documentsScoreFor(2, 5)).toBe(15);   // 2 docs = 10 + 5
    expect(documentsScoreFor(4, 20)).toBe(25);  // teto 25
  });

  it('chunks negativos/zero tratados como sem indexação', () => {
    expect(documentsScoreFor(3, -1)).toBe(0);
  });
});

describe('qaScoreFor — gate de chunks reais', () => {
  it('zera quando não há chunks de Q&A, mesmo com pares no Postgres', () => {
    expect(qaScoreFor(30, 0)).toBe(0);
  });

  it('pontua 4pt a cada 3 pares quando há chunks', () => {
    expect(qaScoreFor(3, 2)).toBe(4);
    expect(qaScoreFor(9, 6)).toBe(12);
    expect(qaScoreFor(100, 50)).toBe(20); // teto 20
  });

  it('menos de 3 pares não pontua mesmo com chunks', () => {
    expect(qaScoreFor(2, 5)).toBe(0);
  });
});

// ── countRagChunksByNamespace ──────────────────────────────────────────────
describe('countRagChunksByNamespace', () => {
  it('separa docChunks de qaChunks pelo flag is_qa (source qa-*)', async () => {
    queryRaw.mockResolvedValueOnce([
      { is_qa: false, n: 12 },
      { is_qa: true, n: 7 },
    ]);
    const res = await countRagChunksByNamespace('abc');
    expect(res).toEqual({ docChunks: 12, qaChunks: 7 });
  });

  it('lida com bigint vindo do COUNT do Postgres', async () => {
    queryRaw.mockResolvedValueOnce([{ is_qa: false, n: BigInt(5) }]);
    const res = await countRagChunksByNamespace('abc');
    expect(res).toEqual({ docChunks: 5, qaChunks: 0 });
  });

  it('fail-soft: tabela inexistente → 0/0, sem throw', async () => {
    queryRaw.mockRejectedValueOnce(new Error('relation "rag_chunks" does not exist'));
    const res = await countRagChunksByNamespace('abc');
    expect(res).toEqual({ docChunks: 0, qaChunks: 0 });
  });
});

// ── computeAIReadiness: gate ponta a ponta ─────────────────────────────────
function stubOrg(settings: Record<string, unknown> = {}) {
  orgFindUnique.mockResolvedValue({
    id: 'org-1',
    settings,
    whatsappPhoneNumberId: null,
    whatsappAccessToken: null,
    instagramAccountId: null,
    instagramAccessToken: null,
  });
}

describe('computeAIReadiness — o teatro dos 45 pontos', () => {
  it('NÃO concede docs/Q&A quando não há chunks reais (teatro eliminado)', async () => {
    stubOrg({});
    kbCount.mockResolvedValue(8);   // 8 docs no Postgres
    qaCount.mockResolvedValue(30);  // 30 Q&A no Postgres
    msgCount.mockResolvedValue(0);
    queryRaw.mockResolvedValue([]); // ZERO chunks no RAG

    const r = await computeAIReadiness('org-1');

    expect(r.breakdown.documents).toBe(0);
    expect(r.breakdown.qaPairs).toBe(0);
    expect(r.stats.documentsCount).toBe(8);   // stats do Postgres preservados
    expect(r.stats.qaPairsCount).toBe(30);
    expect(r.stats.docChunks).toBe(0);
    expect(r.stats.qaChunks).toBe(0);
  });

  it('concede docs/Q&A quando há chunks reais no namespace', async () => {
    stubOrg({});
    kbCount.mockResolvedValue(8);
    qaCount.mockResolvedValue(30);
    msgCount.mockResolvedValue(0);
    queryRaw.mockResolvedValue([
      { is_qa: false, n: 40 },
      { is_qa: true, n: 25 },
    ]);

    const r = await computeAIReadiness('org-1');

    expect(r.breakdown.documents).toBe(25); // 8 docs, com chunks → teto
    expect(r.breakdown.qaPairs).toBe(20);   // 30 pares, com chunks → teto
    expect(r.stats.docChunks).toBe(40);
    expect(r.stats.qaChunks).toBe(25);
  });

  it('gate independente: docs indexados mas Q&A não → só docs pontuam', async () => {
    stubOrg({});
    kbCount.mockResolvedValue(3);
    qaCount.mockResolvedValue(9);
    msgCount.mockResolvedValue(0);
    queryRaw.mockResolvedValue([{ is_qa: false, n: 10 }]); // só chunks de doc

    const r = await computeAIReadiness('org-1');

    expect(r.breakdown.documents).toBeGreaterThan(0);
    expect(r.breakdown.qaPairs).toBe(0);
  });

  it('nextActions sinaliza reprocessamento quando há conteúdo mas sem chunks', async () => {
    stubOrg({});
    kbCount.mockResolvedValue(5);
    qaCount.mockResolvedValue(12);
    msgCount.mockResolvedValue(0);
    queryRaw.mockResolvedValue([]); // nada indexado

    const r = await computeAIReadiness('org-1');

    const docAction = r.nextActions.find((a) => a.id === 'upload_documents');
    const qaAction = r.nextActions.find((a) => a.id === 'add_qa_pairs');
    expect(docAction?.cta).toBe('Reprocessar documentos');
    expect(qaAction?.cta).toBe('Reprocessar Q&A');
  });

  it('fail-soft do RAG não derruba o readiness (survey/identidade ainda pontuam)', async () => {
    stubOrg({ niche: 'clinica', agentName: 'Ana', tone: 'amigavel' });
    kbCount.mockResolvedValue(2);
    qaCount.mockResolvedValue(6);
    msgCount.mockResolvedValue(0);
    queryRaw.mockRejectedValue(new Error('rag down'));

    const r = await computeAIReadiness('org-1');

    // docs/Q&A zerados pelo fail-soft, mas o score não quebra e survey pontua.
    expect(r.breakdown.documents).toBe(0);
    expect(r.breakdown.qaPairs).toBe(0);
    expect(r.breakdown.survey).toBeGreaterThan(0);
    expect(r.score).toBeGreaterThan(0);
  });
});
