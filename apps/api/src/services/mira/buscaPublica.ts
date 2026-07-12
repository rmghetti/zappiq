/**
 * Mira Prospects — busca pública (índice web) para descoberta e enriquecimento.
 *
 * Fundação da colheita de PEGADA PÚBLICA: lê apenas o que os buscadores já
 * indexaram publicamente (título + snippet do resultado) e páginas públicas.
 * NUNCA usa sessão logada, conta de rede social nem credencial de terceiro:
 * é isso que protege a conta da ZappIQ de banimento e mantém a base legal de
 * legítimo interesse defensável (doc 08 + regras LGPD do produto).
 *
 * Provedores pluggáveis, escolhidos pela chave presente (env), em cascata:
 *   1. Google Programmable Search (Custom Search JSON API) — 100 buscas/dia
 *      grátis, sem cartão. Recomendado.
 *   2. Brave Search API — 2.000/mês grátis.
 *   3. Firecrawl Search — pago (escala).
 * Sem nenhuma chave, `buscaPublicaDisponivel()` é false e o chamador devolve
 * "fonte_indisponivel" (honestidade de fonte: nunca inventa resultado).
 */
import { prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';

const TIMEOUT_MS = 12_000;

export type SearchProvider = 'google_cse' | 'brave' | 'firecrawl';

export interface SerpResult {
  title: string;
  url: string;
  snippet: string;
}

/** Provedor ativo, resolvido do env (respeita MIRA_SEARCH_PROVIDER). */
export function buscaPublicaProvider(): SearchProvider | null {
  const forced = env.MIRA_SEARCH_PROVIDER;
  if (forced === 'off') return null;
  const temGoogle = Boolean(env.GOOGLE_CSE_KEY && env.GOOGLE_CSE_CX);
  const temBrave = Boolean(env.BRAVE_API_KEY);
  const temFire = Boolean(env.FIRECRAWL_API_KEY);
  if (forced === 'google_cse') return temGoogle ? 'google_cse' : null;
  if (forced === 'brave') return temBrave ? 'brave' : null;
  if (forced === 'firecrawl') return temFire ? 'firecrawl' : null;
  // auto: prioriza o gratuito/recomendado
  if (temGoogle) return 'google_cse';
  if (temBrave) return 'brave';
  if (temFire) return 'firecrawl';
  return null;
}

export function buscaPublicaDisponivel(): boolean {
  return buscaPublicaProvider() !== null;
}

async function logBusca(
  organizationId: string,
  alvoId: string | null,
  provedor: SearchProvider,
  resultado: 'valido' | 'nao_encontrado' | 'erro',
  latenciaMs: number
): Promise<void> {
  try {
    await (prisma as any).miraEnriquecimentoLog.create({
      data: {
        organizationId,
        alvoId,
        fonte: `pegada_publica:${provedor}`,
        tipo: 'busca',
        resultado,
        custoCreditos: 0,
        latenciaMs,
      },
    });
  } catch {
    /* telemetria nunca derruba o pipeline */
  }
}

function withTimeout(): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}

async function searchGoogleCse(query: string, limit: number, signal: AbortSignal): Promise<SerpResult[]> {
  const num = Math.min(Math.max(limit, 1), 10); // CSE devolve no máximo 10 por página
  const u = new URL('https://www.googleapis.com/customsearch/v1');
  u.searchParams.set('key', env.GOOGLE_CSE_KEY as string);
  u.searchParams.set('cx', env.GOOGLE_CSE_CX as string);
  u.searchParams.set('q', query);
  u.searchParams.set('num', String(num));
  u.searchParams.set('hl', 'pt-BR');
  u.searchParams.set('gl', 'br');
  const res = await fetch(u, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err: any = new Error(`google_cse_${res.status}`);
    err.detail = body.slice(0, 200);
    throw err;
  }
  const data: any = await res.json();
  const items: any[] = Array.isArray(data.items) ? data.items : [];
  return items.map((it) => ({
    title: String(it.title ?? '').trim(),
    url: String(it.link ?? '').trim(),
    snippet: String(it.snippet ?? '').replace(/\s+/g, ' ').trim(),
  }));
}

async function searchBrave(query: string, limit: number, signal: AbortSignal): Promise<SerpResult[]> {
  const u = new URL('https://api.search.brave.com/res/v1/web/search');
  u.searchParams.set('q', query);
  u.searchParams.set('count', String(Math.min(Math.max(limit, 1), 20)));
  u.searchParams.set('country', 'br');
  u.searchParams.set('search_lang', 'pt');
  const res = await fetch(u, {
    signal,
    headers: { accept: 'application/json', 'X-Subscription-Token': env.BRAVE_API_KEY as string },
  });
  if (!res.ok) {
    const err: any = new Error(`brave_${res.status}`);
    throw err;
  }
  const data: any = await res.json();
  const results: any[] = Array.isArray(data?.web?.results) ? data.web.results : [];
  return results.map((r) => ({
    title: String(r.title ?? '').trim(),
    url: String(r.url ?? '').trim(),
    snippet: String(r.description ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
  }));
}

async function searchFirecrawl(query: string, limit: number, signal: AbortSignal): Promise<SerpResult[]> {
  const res = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.FIRECRAWL_API_KEY as string}` },
    body: JSON.stringify({ query, limit: Math.min(Math.max(limit, 1), 20) }),
  });
  if (!res.ok) {
    const err: any = new Error(`firecrawl_${res.status}`);
    throw err;
  }
  const data: any = await res.json();
  const items: any[] = Array.isArray(data?.data) ? data.data : [];
  return items.map((it) => ({
    title: String(it.title ?? '').trim(),
    url: String(it.url ?? '').trim(),
    snippet: String(it.description ?? it.snippet ?? '').replace(/\s+/g, ' ').trim(),
  }));
}

/**
 * Busca no índice público. Retorna [] quando não há resultado; lança em erro
 * de rede/provedor (o chamador decide degradar). Loga toda chamada.
 */
export async function webSearch(
  organizationId: string,
  query: string,
  opts: { limit?: number; alvoId?: string | null } = {}
): Promise<SerpResult[]> {
  const provider = buscaPublicaProvider();
  if (!provider) {
    const err: any = new Error('fonte_indisponivel');
    err.status = 501;
    throw err;
  }
  const limit = opts.limit ?? 8;
  const t0 = Date.now();
  const { signal, done } = withTimeout();
  try {
    let hits: SerpResult[];
    if (provider === 'google_cse') hits = await searchGoogleCse(query, limit, signal);
    else if (provider === 'brave') hits = await searchBrave(query, limit, signal);
    else hits = await searchFirecrawl(query, limit, signal);
    const clean = hits.filter((h) => h.url && h.title);
    await logBusca(organizationId, opts.alvoId ?? null, provider, clean.length ? 'valido' : 'nao_encontrado', Date.now() - t0);
    return clean;
  } catch (err: any) {
    await logBusca(organizationId, opts.alvoId ?? null, provider, 'erro', Date.now() - t0);
    if (err?.name === 'AbortError') {
      logger.warn(`[MiraBusca] timeout provider=${provider} q="${query.slice(0, 60)}"`);
      throw new Error('busca_timeout');
    }
    logger.warn(`[MiraBusca] falha provider=${provider}: ${err?.message ?? err}${err?.detail ? ` (${err.detail})` : ''}`);
    throw err;
  } finally {
    done();
  }
}
