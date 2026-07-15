/**
 * Mira Prospects — busca pública (índice web) para descoberta e enriquecimento.
 *
 * Fundação da colheita de PEGADA PÚBLICA: lê apenas o que os buscadores já
 * indexaram publicamente (título + snippet do resultado) e páginas públicas.
 * NUNCA usa sessão logada, conta de rede social nem credencial de terceiro:
 * é isso que protege a conta da ZappIQ de banimento e mantém a base legal de
 * legítimo interesse defensável (doc 08 + regras LGPD do produto).
 *
 * Provedores pluggáveis: Google Programmable Search, Brave Search API,
 * Firecrawl Search. Sem nenhum configurado, `buscaPublicaDisponivel()` é
 * false e o chamador devolve "fonte_indisponivel" (honestidade de fonte:
 * nunca inventa resultado).
 *
 * CASCATA (14-15/07/2026): a escolha antiga era por CHAVE EXISTIR, não por
 * FUNCIONAR — com o Google CSE 403 (API nunca habilitada no GCP) e forçado
 * como único provedor, toda busca do Mira morria calada: Mapear decisores
 * "achava" 0 sem nunca ter buscado nada. Agora `webSearch` tenta, em ordem,
 * todos os provedores CONFIGURADOS; um que falhar em runtime cai para o
 * próximo antes de desistir. MIRA_SEARCH_PROVIDER continua existindo, mas
 * como PREFERÊNCIA de primeira tentativa, não mais como exclusividade — do
 * contrário o Google morto travaria a cascata de novo assim que alguém
 * setasse a env errada.
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

/**
 * Ordem padrão quando não há preferência (ou ela não está configurada).
 * Brave primeiro: é a assinatura paga e confirmada funcionando (15/07/2026).
 * Google fica no meio, de graça SE um dia alguém habilitar a Custom Search
 * API no GCP (hoje é 403 permanente, ver docs/mira/campanha-zero-alvos-status.md).
 * Firecrawl por último: escala, mas é pago por chamada.
 */
const ORDEM_PADRAO: SearchProvider[] = ['brave', 'google_cse', 'firecrawl'];

function provedorConfigurado(p: SearchProvider): boolean {
  if (p === 'google_cse') return Boolean(env.GOOGLE_CSE_KEY && env.GOOGLE_CSE_CX);
  if (p === 'brave') return Boolean(env.BRAVE_API_KEY);
  return Boolean(env.FIRECRAWL_API_KEY);
}

/**
 * Ordem de tentativa desta chamada: a preferência (MIRA_SEARCH_PROVIDER),
 * se configurada, entra primeiro; os demais provedores configurados seguem
 * na ordem padrão, como reserva. `off` desliga a busca inteira (ninguém
 * tenta nada) — único jeito de zerar a cascata de propósito.
 */
function ordemDeTentativa(): SearchProvider[] {
  const preferido = env.MIRA_SEARCH_PROVIDER;
  if (preferido === 'off') return [];
  const ordem: SearchProvider[] = [];
  if (preferido && preferido !== 'auto' && provedorConfigurado(preferido)) ordem.push(preferido);
  for (const p of ORDEM_PADRAO) {
    if (!ordem.includes(p) && provedorConfigurado(p)) ordem.push(p);
  }
  return ordem;
}

/** Primeiro provedor que a cascata tentaria agora (para status/telemetria). */
export function buscaPublicaProvider(): SearchProvider | null {
  return ordemDeTentativa()[0] ?? null;
}

export function buscaPublicaDisponivel(): boolean {
  return ordemDeTentativa().length > 0;
}

async function logBusca(
  organizationId: string,
  alvoId: string | null,
  provedor: SearchProvider,
  resultado: 'valido' | 'nao_encontrado' | 'erro',
  latenciaMs: number
): Promise<void> {
  try {
    await prisma.miraEnriquecimentoLog.create({
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

async function tentarProvedor(provider: SearchProvider, query: string, limit: number): Promise<SerpResult[]> {
  const { signal, done } = withTimeout();
  try {
    if (provider === 'google_cse') return await searchGoogleCse(query, limit, signal);
    if (provider === 'brave') return await searchBrave(query, limit, signal);
    return await searchFirecrawl(query, limit, signal);
  } finally {
    done();
  }
}

/**
 * Busca no índice público. Retorna [] quando um provedor respondeu e não
 * achou nada — mercado vazio é um resultado legítimo. LANÇA quando NENHUM
 * provedor configurado conseguiu responder (14-15/07/2026: antes, "todos os
 * provedores falharam" e "não configurei nenhum" se confundiam, e um 403 do
 * Google virava silenciosamente "0 resultados" — Mapear decisores dizia que
 * não achou ninguém sem nunca ter buscado de verdade).
 *
 *   - Nenhum provedor configurado → `fonte_indisponivel` (501).
 *   - Um ou mais configurados, mas TODOS falharam nesta chamada →
 *     `fonte_falhou` (502), com `.detail` listando o motivo de cada um.
 *
 * Antes de lançar, cai em cascata por todo provedor configurado (ver
 * `ordemDeTentativa`): o timeout/erro de um não impede os demais.
 */
export async function webSearch(
  organizationId: string,
  query: string,
  opts: { limit?: number; alvoId?: string | null } = {}
): Promise<SerpResult[]> {
  const ordem = ordemDeTentativa();
  if (ordem.length === 0) {
    const err: any = new Error('fonte_indisponivel');
    err.status = 501;
    throw err;
  }
  const limit = opts.limit ?? 8;
  const falhas: string[] = [];

  for (const provider of ordem) {
    const t0 = Date.now();
    try {
      const hits = await tentarProvedor(provider, query, limit);
      const clean = hits.filter((h) => h.url && h.title);
      await logBusca(organizationId, opts.alvoId ?? null, provider, clean.length ? 'valido' : 'nao_encontrado', Date.now() - t0);
      return clean;
    } catch (err: any) {
      await logBusca(organizationId, opts.alvoId ?? null, provider, 'erro', Date.now() - t0);
      const motivo = err?.name === 'AbortError' ? 'timeout' : String(err?.message ?? err);
      falhas.push(`${provider}: ${motivo}${err?.detail ? ` (${err.detail})` : ''}`);
      logger.warn(`[MiraBusca] falha provider=${provider} q="${query.slice(0, 60)}": ${motivo}`);
      // cai para o próximo da ordem em vez de desistir aqui
    }
  }

  const err: any = new Error('fonte_falhou');
  err.status = 502;
  err.detail = falhas.join(' | ');
  throw err;
}
