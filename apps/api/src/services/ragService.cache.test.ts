/**
 * ragService.cache.test.ts — B4 (busca que acha o que foi treinado)
 * ============================================================================
 * Cobre os três defeitos do caminho da busca na API:
 *
 *   A025  A chave do cache era `rag:<ns>:base64(mensagem).slice(0,40)`, ou seja,
 *         os 30 PRIMEIROS BYTES da mensagem. "Quanto custa o tratamento de
 *         canal?" e "Quanto custa o tratamento de clareamento?" recebiam o
 *         MESMO contexto por 120 s, para qualquer contato da organização.
 *         A chave também ignorava top_k (Modo Econômico x turno normal).
 *
 *   A010  Desativar um Q&A não invalidava nada: a resposta desativada seguia
 *         saindo por até 2 minutos.
 *   A033  O playground buscava sem cache e o WhatsApp com cache: o dono
 *         editava, testava e via certo, o cliente recebia o antigo.
 *
 *   A028  'sem resultado' e 'serviço fora do ar' eram a mesma string vazia.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/env.js', () => ({
  env: {
    RAG_SERVICE_URL: 'http://rag.local',
    RAG_SERVICE_SECRET: 'segredo',
    RAG_MIN_SIMILARITY: 0.35,
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── cache em memória, com contador de versão de verdade ──────────────────
const store = new Map<string, string>();
const counters = new Map<string, number>();
const cacheGet = vi.fn(async (k: string) => store.get(k) ?? null);
const cacheSet = vi.fn(async (k: string, v: string) => {
  store.set(k, v);
  return true;
});
const cacheIncrby = vi.fn(async (k: string, amount = 1) => {
  const next = (counters.get(k) ?? 0) + amount;
  counters.set(k, next);
  store.set(k, String(next));
  return next;
});
vi.mock('./cloud/index.js', () => ({
  cache: {
    get: (...a: any[]) => cacheGet(...(a as [string])),
    set: (...a: any[]) => cacheSet(...(a as [string, string])),
    incrby: (...a: any[]) => cacheIncrby(...(a as [string, number])),
    del: vi.fn(async () => true),
  },
}));

// ── serviço RAG falso ────────────────────────────────────────────────────
const post = vi.fn();
vi.mock('axios', () => ({
  default: {
    create: () => ({ post: (...a: any[]) => post(...a), delete: vi.fn(), get: vi.fn() }),
    get: vi.fn(),
  },
}));

const {
  buildCacheKey,
  normalizeQuery,
  configVersionKey,
  readConfigVersion,
  bumpConfigVersion,
  searchDetailed,
  search,
  searchWithSources,
} = await import('./ragService.js');

function resposta(...textos: string[]) {
  return {
    data: {
      results: textos.map((text, i) => ({
        id: String(i),
        text,
        similarity: 0.8 - i * 0.01,
        source: `doc-${i}.txt`,
        chunk_idx: 0,
      })),
      latency_ms: 10,
    },
  };
}

beforeEach(() => {
  store.clear();
  counters.clear();
  post.mockReset();
  cacheGet.mockClear();
  cacheSet.mockClear();
  cacheIncrby.mockClear();
});

// ─────────────────────────────────────────────────────────────────────────
// A025 — chave de cache
// ─────────────────────────────────────────────────────────────────────────

describe('buildCacheKey (A025)', () => {
  const base = { organizationId: 'org-1', topK: 5, minSimilarity: 0.35, configVersion: 0 };

  it('mensagens com os mesmos 30 primeiros caracteres recebem chaves DIFERENTES', () => {
    const a = buildCacheKey({ ...base, query: 'Quanto custa o tratamento de canal?' });
    const b = buildCacheKey({ ...base, query: 'Quanto custa o tratamento de clareamento?' });
    expect(a).not.toBe(b);
  });

  it('outro par real da auditoria também separa', () => {
    const a = buildCacheKey({ ...base, query: 'Qual o valor da consulta com o Dr. Fulano?' });
    const b = buildCacheKey({ ...base, query: 'Qual o valor da consulta com o Dr. Beltrano?' });
    expect(a).not.toBe(b);
  });

  it('top_k faz parte da chave (Modo Econômico usa 3, turno normal usa 5)', () => {
    const normal = buildCacheKey({ ...base, query: 'quanto custa?', topK: 5 });
    const economico = buildCacheKey({ ...base, query: 'quanto custa?', topK: 3 });
    expect(normal).not.toBe(economico);
  });

  it('a versão da configuração da organização faz parte da chave', () => {
    const v0 = buildCacheKey({ ...base, query: 'quanto custa?', configVersion: 0 });
    const v1 = buildCacheKey({ ...base, query: 'quanto custa?', configVersion: 1 });
    expect(v0).not.toBe(v1);
  });

  it('o corte de similaridade faz parte da chave', () => {
    const a = buildCacheKey({ ...base, query: 'quanto custa?', minSimilarity: 0.25 });
    const b = buildCacheKey({ ...base, query: 'quanto custa?', minSimilarity: 0.35 });
    expect(a).not.toBe(b);
  });

  it('mesma pergunta com espaço e caixa diferentes reaproveita a mesma chave', () => {
    const a = buildCacheKey({ ...base, query: '  Quanto   CUSTA o plano? ' });
    const b = buildCacheKey({ ...base, query: 'quanto custa o plano?' });
    expect(a).toBe(b);
  });

  it('a chave continua isolada por organização', () => {
    const a = buildCacheKey({ ...base, query: 'quanto custa?' });
    const b = buildCacheKey({ ...base, organizationId: 'org-2', query: 'quanto custa?' });
    expect(a).not.toBe(b);
    expect(a).toContain('org_org-1');
    expect(b).toContain('org_org-2');
  });

  it('não carrega a mensagem do cliente em claro na chave', () => {
    const chave = buildCacheKey({ ...base, query: 'meu CPF é 123.456.789-00' });
    expect(chave).not.toContain('123.456');
    expect(chave).not.toContain('CPF');
  });
});

describe('normalizeQuery', () => {
  it('colapsa espaço, tira as pontas e baixa a caixa', () => {
    expect(normalizeQuery('  Quanto\n  CUSTA  ? ')).toBe('quanto custa ?');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// A010 / A033 — versão da configuração
// ─────────────────────────────────────────────────────────────────────────

describe('versão da configuração da organização', () => {
  it('a chave do contador segue o padrão zappiq:rag:version:<org>', () => {
    expect(configVersionKey('abc')).toBe('zappiq:rag:version:org_abc');
  });

  it('sem contador gravado a versão é 0 (cache só por mensagem)', async () => {
    expect(await readConfigVersion('org-1')).toBe(0);
  });

  it('cada escrita de treino incrementa a versão', async () => {
    expect(await bumpConfigVersion('org-1')).toBe(1);
    expect(await bumpConfigVersion('org-1')).toBe(2);
    expect(await readConfigVersion('org-1')).toBe(2);
  });

  it('sem Redis (incrby devolve null) a versão volta a 0 e nada quebra', async () => {
    cacheIncrby.mockResolvedValueOnce(null as any);
    expect(await bumpConfigVersion('org-1')).toBe(0);
  });

  it('valor corrompido no Redis não derruba a busca', async () => {
    store.set(configVersionKey('org-1'), 'nao-e-numero');
    expect(await readConfigVersion('org-1')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Comportamento do cache na busca
// ─────────────────────────────────────────────────────────────────────────

describe('searchDetailed — cache', () => {
  it('segunda busca igual não chama o serviço', async () => {
    post.mockResolvedValue(resposta('preço do plano é 100'));
    const a = await searchDetailed('org-1', 'quanto custa o plano?', 5);
    const b = await searchDetailed('org-1', 'quanto custa o plano?', 5);
    expect(post).toHaveBeenCalledTimes(1);
    expect(b.context).toBe(a.context);
    expect(b.fromCache).toBe(true);
  });

  it('duas perguntas com os mesmos 30 primeiros caracteres recebem contextos diferentes', async () => {
    post.mockResolvedValueOnce(resposta('canal custa 800'));
    post.mockResolvedValueOnce(resposta('clareamento custa 1200'));

    const canal = await searchDetailed('org-1', 'Quanto custa o tratamento de canal?', 5);
    const clareamento = await searchDetailed(
      'org-1',
      'Quanto custa o tratamento de clareamento?',
      5,
    );

    expect(post).toHaveBeenCalledTimes(2);
    expect(canal.context).toBe('canal custa 800');
    expect(clareamento.context).toBe('clareamento custa 1200');
  });

  it('desativar um Q&A (bump de versão) invalida o cache na hora — A010', async () => {
    post.mockResolvedValueOnce(resposta('resposta antiga do Q&A'));
    const antes = await searchDetailed('org-1', 'voces entregam no interior?', 5);
    expect(antes.context).toBe('resposta antiga do Q&A');

    await bumpConfigVersion('org-1');

    post.mockResolvedValueOnce(resposta('sem o Q&A desativado'));
    const depois = await searchDetailed('org-1', 'voces entregam no interior?', 5);
    expect(post).toHaveBeenCalledTimes(2);
    expect(depois.context).toBe('sem o Q&A desativado');
  });

  it('o bump de uma organização não invalida o cache de outra', async () => {
    post.mockResolvedValue(resposta('contexto da org 2'));
    await searchDetailed('org-2', 'pergunta qualquer', 5);
    await bumpConfigVersion('org-1');
    await searchDetailed('org-2', 'pergunta qualquer', 5);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('playground e produção compartilham o mesmo cache versionado — A033', async () => {
    post.mockResolvedValue(resposta('mesma coisa nos dois'));
    const producao = await search('org-1', 'qual o horário?', 5);
    const playground = await searchWithSources('org-1', 'qual o horário?', 5);
    expect(post).toHaveBeenCalledTimes(1);
    expect(playground.context).toBe(producao);
    expect(playground.sources).toHaveLength(1);
  });

  it('as fontes sobrevivem ao cache (o playground continua mostrando de onde veio)', async () => {
    post.mockResolvedValue(resposta('trecho A', 'trecho B'));
    await searchWithSources('org-1', 'pergunta', 5);
    const doCache = await searchWithSources('org-1', 'pergunta', 5);
    expect(post).toHaveBeenCalledTimes(1);
    expect(doCache.sources.map((s) => s.source)).toEqual(['doc-0.txt', 'doc-1.txt']);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// A028 — sem resultado x serviço fora
// ─────────────────────────────────────────────────────────────────────────

describe('searchDetailed — status (A028)', () => {
  it('com resultados: ok', async () => {
    post.mockResolvedValue(resposta('achou'));
    const out = await searchDetailed('org-1', 'pergunta', 5);
    expect(out.status).toBe('ok');
  });

  it('serviço respondeu e nada passou do corte: sem_resultado', async () => {
    post.mockResolvedValue({ data: { results: [], latency_ms: 5 } });
    const out = await searchDetailed('org-1', 'pergunta', 5);
    expect(out.status).toBe('sem_resultado');
    expect(out.context).toBe('');
  });

  it('timeout ou 5xx: servico_fora, nunca confundido com sem_resultado', async () => {
    post.mockRejectedValue(new Error('timeout of 30000ms exceeded'));
    const out = await searchDetailed('org-1', 'pergunta', 5);
    expect(out.status).toBe('servico_fora');
    expect(out.context).toBe('');
  });

  it('resultado vazio é cacheado (não repete a busca cara por 120 s) — A032', async () => {
    post.mockResolvedValue({ data: { results: [], latency_ms: 5 } });
    await searchDetailed('org-1', 'oi', 5);
    const segundo = await searchDetailed('org-1', 'oi', 5);
    expect(post).toHaveBeenCalledTimes(1);
    expect(segundo.status).toBe('sem_resultado');
  });

  it('serviço fora NUNCA é cacheado: a busca seguinte tenta de novo', async () => {
    post.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const caiu = await searchDetailed('org-1', 'pergunta', 5);
    expect(caiu.status).toBe('servico_fora');

    post.mockResolvedValueOnce(resposta('voltou'));
    const voltou = await searchDetailed('org-1', 'pergunta', 5);
    expect(voltou.status).toBe('ok');
    expect(voltou.context).toBe('voltou');
  });

  it('search() continua devolvendo só o texto (contrato antigo preservado)', async () => {
    post.mockResolvedValue(resposta('contexto'));
    expect(await search('org-1', 'pergunta', 5)).toBe('contexto');
  });
});
