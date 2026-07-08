import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
// PR #V4-005.1: migrado de import direto de Redis para abstração cloud-agnostic.
// Comportamento idêntico (RedisCacheProvider wrappa o mesmo ioredis), mas agora
// passa por ICache — habilita troca de backend via env CLOUD_CACHE_PROVIDER.
import { cache } from './cloud/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Contrato REAL do serviço Python (services/rag/main.py)
//
// O serviço zappiq-rag NÃO conhece `tenant_id`. Ele isola multi-tenancy por
// `namespace`, sempre no formato `org_<uuid>` (ver docstring do lifespan e do
// endpoint /ingest em services/rag/main.py). Endpoints existentes:
//
//   POST /query    {query, namespace, top_k, min_similarity}
//                  -> {results: [{id, text, similarity, source, chunk_idx}], latency_ms}
//   POST /ingest   multipart: file, namespace, source?, metadata?
//                  -> {namespace, source, chunks_ingested, tokens_embedded, latency_ms}
//   DELETE /ingest/{namespace}/{source}
//                  -> {namespace, source, deleted}
//   GET  /ready    readiness (Postgres + provider de embedding)
//   GET  /health   liveness
//
// O código antigo chamava POST /search com tenant_id e POST /ingest com
// tenant_id no form — nenhum dos dois existe/é aceito, causando 422/500 e a Iza
// respondendo sem docs. Este arquivo alinha o cliente ao contrato acima.
// ─────────────────────────────────────────────────────────────────────────────

const ragClient = axios.create({
  baseURL: env.RAG_SERVICE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Secret': env.RAG_SERVICE_SECRET || '',
  },
  timeout: 30_000,
});

/**
 * Namespace por organização. O serviço Python espera SEMPRE `org_<uuid>`
 * (ver docstring de services/rag/main.py). Idempotente: se já vier prefixado,
 * não duplica o prefixo.
 */
export function namespaceFor(organizationId: string): string {
  return organizationId.startsWith('org_') ? organizationId : `org_${organizationId}`;
}

// ── Shapes do contrato /query ────────────────────────────────────────────────

export interface QueryRequestBody {
  query: string;
  namespace: string;
  top_k: number;
  min_similarity?: number;
}

export interface RagQueryResult {
  id: string;
  text: string;
  similarity: number;
  source: string | null;
  chunk_idx: number;
}

/**
 * Builder puro da request de retrieval. Isolado para teste sem tocar axios.
 * Rota real: POST /query. Campo real: `namespace` (não `tenant_id`).
 */
export function buildQueryRequest(
  organizationId: string,
  query: string,
  topK: number,
): { path: string; body: QueryRequestBody } {
  return {
    path: '/query',
    body: {
      query,
      namespace: namespaceFor(organizationId),
      top_k: topK,
      // Sem esse piso o serviço devolve os top_k SEMPRE, mesmo com similaridade
      // irrelevante — chunk aleatório de crawl entrava no prompt em toda resposta.
      min_similarity: Number(env.RAG_MIN_SIMILARITY ?? 0.25),
    },
  };
}

/**
 * Extrai o contexto textual da response do /query. O serviço retorna cada
 * chunk no campo `text` (não `content`, que era o parsing errado do código
 * antigo — sempre resultava em contexto vazio mesmo com resultados válidos).
 */
export function parseQueryContext(data: unknown): string {
  const results = (data as { results?: RagQueryResult[] } | null)?.results ?? [];
  return results
    .map((r) => r?.text)
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .join('\n\n---\n\n');
}

/**
 * Fonte de contexto normalizada para exibição (playground "Testar minha IA").
 * `source` é o filename/URL usado na ingestão; `similarity` ajuda o dono do
 * negócio a ver o quão relevante foi o trecho recuperado.
 */
export interface RagSource {
  source: string;
  similarity: number;
  snippet: string;
}

/**
 * Extrai as fontes distintas da response do /query, ordenadas por similaridade
 * desc. Puro (sem axios) para teste. Dedupe por `source`: mantém o trecho de
 * maior similaridade por documento — o dono do negócio quer ver QUAIS docs a IA
 * usou, não cada chunk. `snippet` é um recorte curto pra prévia na UI.
 */
export function parseQuerySources(data: unknown, maxSnippet = 160): RagSource[] {
  const results = (data as { results?: RagQueryResult[] } | null)?.results ?? [];
  const bySource = new Map<string, RagSource>();
  for (const r of results) {
    const source = (r?.source ?? '').trim() || '(sem origem)';
    const similarity = typeof r?.similarity === 'number' ? r.similarity : 0;
    const text = typeof r?.text === 'string' ? r.text.trim() : '';
    const existing = bySource.get(source);
    if (!existing || similarity > existing.similarity) {
      bySource.set(source, {
        source,
        similarity,
        snippet: text.length > maxSnippet ? `${text.slice(0, maxSnippet)}…` : text,
      });
    }
  }
  return [...bySource.values()].sort((a, b) => b.similarity - a.similarity);
}

/**
 * Igual a `search`, mas devolve o contexto textual JUNTO com as fontes
 * estruturadas. Usado pelo playground "Testar minha IA" (/ai-training) para
 * mostrar ao dono do negócio QUAIS documentos foram usados. Não usa cache
 * (queremos sempre o retrieval fresco no teste) e é fail-soft: em erro devolve
 * contexto vazio e lista de fontes vazia.
 */
export async function searchWithSources(
  organizationId: string,
  query: string,
  topK = 5,
): Promise<{ context: string; sources: RagSource[] }> {
  try {
    const { path, body } = buildQueryRequest(organizationId, query, topK);
    const { data } = await ragClient.post(path, body);
    return {
      context: parseQueryContext(data),
      sources: parseQuerySources(data),
    };
  } catch (err: any) {
    logger.warn('[RAG] searchWithSources failed:', err.message);
    return { context: '', sources: [] };
  }
}

export async function search(organizationId: string, query: string, topK = 5): Promise<string> {
  const namespace = namespaceFor(organizationId);
  const cacheKey = `rag:${namespace}:${Buffer.from(query).toString('base64').slice(0, 40)}`;

  // cache.get() é fail-soft por contrato (retorna null em erro, não throw),
  // então não precisamos do try/catch defensivo do código antigo.
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { path, body } = buildQueryRequest(organizationId, query, topK);
    const { data } = await ragClient.post(path, body);

    const context = parseQueryContext(data);

    // cache.set() é fail-soft (retorna false em erro, não throw). TTL em segundos.
    await cache.set(cacheKey, context, 120);

    return context;
  } catch (err: any) {
    // error, não warn: a IA vai responder SEM nada do treinamento do cliente.
    logger.error('[RAG] Query failed — respondendo sem contexto treinado:', err.message);
    return '';
  }
}

// ── Ingestão ─────────────────────────────────────────────────────────────────

/**
 * Builder puro do form de ingestão. Isolado para teste sem tocar axios.
 * Rota real: POST /ingest. Campos reais: file, namespace, source?, metadata?.
 * O campo `tenant_id` do código antigo NÃO existe no serviço e causava 422.
 */
export function buildIngestForm(
  organizationId: string,
  file: { filename: string; content: Buffer; mimeType: string },
): { path: string; form: FormData } {
  const form = new FormData();
  form.append('namespace', namespaceFor(organizationId));
  form.append('source', file.filename);
  // `Buffer` is no longer assignable to `BlobPart` under newer @types/node
  // (SharedArrayBuffer / ArrayBuffer divergence). Wrap in Uint8Array, which is.
  form.append('file', new Blob([new Uint8Array(file.content)], { type: file.mimeType }), file.filename);
  return { path: '/ingest', form };
}

export async function ingestDocument(
  organizationId: string,
  file: { filename: string; content: Buffer; mimeType: string },
) {
  const { path, form } = buildIngestForm(organizationId, file);
  // IMPORTANTE: NAO usar o ragClient (axios) aqui — a instancia forca
  // Content-Type: application/json em toda request, o que quebra o multipart
  // do /ingest (o servico Python recebe o form com header errado -> 422).
  // fetch/undici serializa o FormData+Blob com o boundary multipart correto.
  const res = await fetch(`${env.RAG_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: { 'X-Service-Secret': env.RAG_SERVICE_SECRET || '' },
    body: form as any,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`RAG ingest ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

// Block SSRF: reject internal/private network URLs
function assertPublicUrl(url: string): void {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Invalid URL'); }

  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http/https URLs allowed');

  const hostname = parsed.hostname.toLowerCase();
  const blocked = [
    'localhost', '127.0.0.1', '0.0.0.0', '[::1]',
    '169.254.169.254',   // cloud metadata
    'metadata.google.internal',
  ];
  if (blocked.includes(hostname)) throw new Error('Internal URLs are not allowed');

  // Block RFC 1918 private ranges
  const parts = hostname.split('.').map(Number);
  if (parts.length === 4 && parts.every(p => !isNaN(p))) {
    if (parts[0] === 10) throw new Error('Private IP not allowed');
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) throw new Error('Private IP not allowed');
    if (parts[0] === 192 && parts[1] === 168) throw new Error('Private IP not allowed');
  }
}

/**
 * Ingestão a partir de uma URL pública.
 *
 * NOTA DE CONTRATO: o serviço Python (services/rag/main.py) NÃO expõe rota de
 * ingestão por URL — só `POST /ingest` (multipart com arquivo). O código antigo
 * chamava `POST /ingest-url` (inexistente) com `tenant_id`, o que retornava
 * 404/422. Aqui fazemos o fetch da URL e reaproveitamos `ingestDocument`,
 * respeitando o contrato real. O guard anti-SSRF continua valendo.
 */
/**
 * HTML → texto legível. Sem isso, páginas eram ingeridas com markup/JS cru —
 * uma única página do YouTube gerou 1.532 chunks de lixo que competiam no
 * retrieval com o conteúdo curado do cliente.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/**
 * Nome de `source` estável derivado da URL (hostname+pathname, sem protocolo).
 * Usado na ingestão E na reconciliação de chunks por documento — precisa ser
 * a MESMA derivação nos dois lados.
 */
export function urlToSource(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.replace(/\/+$/, '') || u.hostname;
  } catch {
    return url;
  }
}

export async function ingestUrl(organizationId: string, url: string) {
  assertPublicUrl(url);

  const resp = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30_000,
    maxContentLength: 20 * 1024 * 1024, // alinhado ao MAX_UPLOAD_MB do serviço
  });

  const mimeType =
    (resp.headers['content-type'] as string | undefined)?.split(';')[0]?.trim() ||
    'text/plain';

  const filename = urlToSource(url);

  let content = Buffer.from(resp.data);
  let effectiveMime = mimeType;
  if (mimeType === 'text/html' || mimeType === 'application/xhtml+xml') {
    const text = htmlToPlainText(content.toString('utf-8'));
    if (!text) throw new Error('Página sem texto extraível após limpeza de HTML');
    content = Buffer.from(text, 'utf-8');
    effectiveMime = 'text/plain';
  }

  return ingestDocument(organizationId, {
    filename,
    content,
    mimeType: effectiveMime,
  });
}

/**
 * Remove um documento (source) do namespace da organização.
 * Rota real: DELETE /ingest/{namespace}/{source}. O `source` é o identificador
 * usado na ingestão (por padrão o filename), NÃO um id do Postgres.
 */
export async function deleteDocument(organizationId: string, source: string) {
  const namespace = namespaceFor(organizationId);
  const { data } = await ragClient.delete(
    `/ingest/${encodeURIComponent(namespace)}/${encodeURIComponent(source)}`,
  );
  return data;
}

/**
 * Readiness do serviço RAG. Rota real: GET /ready.
 * Retorna { status: 'ready' | 'not_ready', checks: {...} }.
 */
export async function ready() {
  const { data } = await ragClient.get('/ready');
  return data;
}
