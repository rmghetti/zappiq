import axios from 'axios';
import { createHash } from 'crypto';
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
      // O 0,25 original não filtrava nada: medido nos vetores REAIS de produção
      // (A022), conteúdo de outra empresa tinha mediana 0,375 e só 3,7% ficava
      // abaixo de 0,25. O default vive em config/env.ts e é ajustável por env.
      min_similarity: Number(env.RAG_MIN_SIMILARITY ?? 0.30),
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

// ── Cache da busca ───────────────────────────────────────────────────────────
//
// A chave antiga era `rag:<ns>:base64(mensagem).slice(0,40)`, ou seja, os 30
// PRIMEIROS BYTES da mensagem (A025). "Quanto custa o tratamento de canal?" e
// "Quanto custa o tratamento de clareamento?" recebiam o mesmo contexto por
// 120 s, para qualquer contato da organização. A chave também não levava o
// top_k (Modo Econômico usa 3, turno normal usa 5) e nada a invalidava: um Q&A
// desativado continuava saindo por até 2 minutos (A010) e o playground, que
// buscava sem cache, divergia do WhatsApp (A033).
//
// Agora: sha256 da mensagem INTEIRA normalizada + top_k + corte + versão da
// configuração da organização. A versão é um contador no Redis incrementado
// por qualquer escrita de treino. Sem Redis a versão é 0 e o cache continua
// valendo só por mensagem, que é o comportamento degradado aceitável.

const CACHE_TTL_SECONDS = 120;

/** Normaliza a mensagem antes do hash: caixa, espaço e forma unicode. */
export function normalizeQuery(query: string): string {
  return (query ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Contador de versão da configuração de treino da organização. */
export function configVersionKey(organizationId: string): string {
  return `zappiq:rag:version:${namespaceFor(organizationId)}`;
}

export async function readConfigVersion(organizationId: string): Promise<number> {
  const raw = await cache.get(configVersionKey(organizationId));
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * Sobe a versão da organização. Chamada por QUALQUER escrita de treino
 * (upload, texto, URL, Q&A criar/editar/desativar/apagar, questionário
 * reingerido, identidade, agendamento). Na prática, por toda ingestão e todo
 * delete deste módulo. Fail-soft: sem Redis devolve 0 e a busca segue.
 */
export async function bumpConfigVersion(organizationId: string): Promise<number> {
  const next = await cache.incrby(configVersionKey(organizationId), 1);
  return typeof next === 'number' && Number.isFinite(next) ? next : 0;
}

export function buildCacheKey(input: {
  organizationId: string;
  query: string;
  topK: number;
  minSimilarity: number;
  configVersion: number;
}): string {
  const material = [
    normalizeQuery(input.query),
    String(input.topK),
    String(input.minSimilarity),
    String(input.configVersion),
  ].join('\n');
  const digest = createHash('sha256').update(material, 'utf8').digest('base64url');
  return `rag:${namespaceFor(input.organizationId)}:${digest}`;
}

// ── Resultado da busca ───────────────────────────────────────────────────────

/**
 * A028: 'nada acima do corte' e 'o serviço caiu' geravam a MESMA string vazia,
 * e o agente recebia a mesma frase nos dois casos. Sem essa distinção a IA
 * afirma "não há essa informação" quando o que houve foi uma queda.
 */
export type RagSearchStatus = 'ok' | 'sem_resultado' | 'servico_fora';

export interface RagSearchOutcome {
  context: string;
  sources: RagSource[];
  status: RagSearchStatus;
  fromCache: boolean;
}

interface CachedOutcome {
  context: string;
  sources: RagSource[];
  status: 'ok' | 'sem_resultado';
}

function parseCached(raw: string): CachedOutcome | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.context !== 'string') return null;
    return {
      context: parsed.context,
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      status: parsed.status === 'sem_resultado' ? 'sem_resultado' : 'ok',
    };
  } catch {
    return null;
  }
}

/**
 * Busca com cache versionado, fontes estruturadas e status explícito.
 * É o caminho ÚNICO: produção (WhatsApp/Instagram/site) e playground usam esta
 * função, então não voltam a divergir depois de uma edição (A033).
 */
export async function searchDetailed(
  organizationId: string,
  query: string,
  topK = 5,
): Promise<RagSearchOutcome> {
  const minSimilarity = Number(env.RAG_MIN_SIMILARITY ?? 0.30);
  const configVersion = await readConfigVersion(organizationId);
  const cacheKey = buildCacheKey({
    organizationId,
    query,
    topK,
    minSimilarity,
    configVersion,
  });

  // cache.get() é fail-soft por contrato (retorna null em erro, não throw).
  const cached = await cache.get(cacheKey);
  if (cached) {
    const parsed = parseCached(cached);
    if (parsed) return { ...parsed, fromCache: true };
  }

  try {
    const { path, body } = buildQueryRequest(organizationId, query, topK);
    const { data } = await ragClient.post(path, body);

    const context = parseQueryContext(data);
    const sources = parseQuerySources(data);
    const status: 'ok' | 'sem_resultado' = sources.length > 0 ? 'ok' : 'sem_resultado';

    // Resultado vazio TAMBÉM é cacheado (A032): antes, toda saudação repetia a
    // busca paga porque só o resultado cheio entrava no cache.
    await cache.set(cacheKey, JSON.stringify({ context, sources, status }), CACHE_TTL_SECONDS);

    // debug, não info: é uma linha por turno de TODA conversa de TODA org.
    logger.debug('[RAG] busca concluída', {
      organizationId,
      status,
      topK,
      configVersion,
      trechos: sources.length,
    });

    return { context, sources, status, fromCache: false };
  } catch (err: any) {
    // error, não warn: a IA vai responder SEM nada do treinamento do cliente.
    // E o status NÃO é cacheado: a próxima mensagem tenta o serviço de novo.
    logger.error('[RAG] serviço fora, respondendo sem contexto treinado', {
      organizationId,
      status: 'servico_fora',
      erro: err?.message,
    });
    return { context: '', sources: [], status: 'servico_fora', fromCache: false };
  }
}

/**
 * Contexto + fontes estruturadas para o playground "Testar minha IA".
 * Mantido para não quebrar os chamadores; hoje é um atalho de searchDetailed.
 */
export async function searchWithSources(
  organizationId: string,
  query: string,
  topK = 5,
): Promise<{ context: string; sources: RagSource[] }> {
  const { context, sources } = await searchDetailed(organizationId, query, topK);
  return { context, sources };
}

/** Contrato antigo (só o texto). Prefira searchDetailed, que traz o status. */
export async function search(organizationId: string, query: string, topK = 5): Promise<string> {
  const { context } = await searchDetailed(organizationId, query, topK);
  return context;
}

// ── Ingestão ─────────────────────────────────────────────────────────────────

/**
 * Erro de ingestão que carrega o status HTTP do serviço de indexação.
 *
 * Antes o `ingestDocument` lançava `new Error('RAG ingest 415: ...')`, sem
 * statusCode: o errorHandler, em produção, transformava em 500 "Internal
 * Server Error" e a tela mostrava "Erro no upload: Internal Server Error"
 * (achados A003 e A004). A mensagem útil ficava só no log do servidor.
 */
export class RagRequestError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'RagRequestError';
    this.statusCode = statusCode;
  }
}

export const MENSAGEM_RAG_INDISPONIVEL =
  'Não consegui indexar este conteúdo agora. Tente de novo em alguns minutos.';

export const MENSAGEM_REDE_SOCIAL =
  'Redes sociais não podem ser lidas automaticamente. Cole o texto do perfil ou da publicação.';

export const MENSAGEM_PAGINA_ILEGIVEL =
  'Não consegui abrir esta página. Confira o endereço ou cole o conteúdo como texto.';

export const MENSAGEM_URL_NAO_PUBLICA =
  'Este endereço não é público. Cole o conteúdo como texto ou use um link que abra no navegador.';

const MENSAGEM_INGESTAO_GENERICA =
  'Não consegui indexar este conteúdo. Confira o arquivo e envie de novo.';

/**
 * Domínios que não entregam conteúdo a um leitor sem sessão: o que volta é
 * título com entidade HTML e menu de navegação, que entrava no vetor com selo
 * verde de indexado e competia com o conteúdo bom (achado A012). A comparação
 * é por domínio, nunca por substring: "meufacebook.com.br" não é o Facebook.
 */
const DOMINIOS_REDE_SOCIAL = new Set([
  'instagram.com',
  'facebook.com',
  'fb.com',
  'tiktok.com',
  'x.com',
  'twitter.com',
  'linkedin.com',
  'youtube.com',
  'youtu.be',
]);

export function ehRedeSocial(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const partes = host.split('.');
  for (let corte = 0; corte < partes.length - 1; corte++) {
    if (DOMINIOS_REDE_SOCIAL.has(partes.slice(corte).join('.'))) return true;
  }
  return false;
}

/**
 * Traduz a resposta de erro do serviço de indexação no erro que a rota
 * devolve. 4xx é diagnóstico sobre o conteúdo enviado e vale repassar inteiro;
 * 5xx é problema nosso e vira indisponibilidade, sem vazar detalhe interno.
 */
export function erroDaRespostaDoRag(status: number, corpo: string): RagRequestError {
  if (status >= 500) return new RagRequestError(503, MENSAGEM_RAG_INDISPONIVEL);

  let detalhe = '';
  try {
    const json = JSON.parse(corpo);
    if (typeof json?.detail === 'string') detalhe = json.detail.trim();
  } catch {
    // Corpo que não é JSON nunca vira mensagem crua para o cliente.
  }
  return new RagRequestError(status, detalhe || MENSAGEM_INGESTAO_GENERICA);
}

/** O que a rota responde quando a ingestão falha. */
export function falhaDeIngestao(err: unknown): { status: number; mensagem: string } {
  if (err instanceof RagRequestError) return { status: err.statusCode, mensagem: err.message };
  return { status: 503, mensagem: MENSAGEM_RAG_INDISPONIVEL };
}

export interface ArquivoParaIngestao {
  filename: string;
  content: Buffer;
  mimeType: string;
  /** Identificador estável no vetor. Sem ele, o serviço usa o filename. */
  source?: string;
  /** `titulo` e `pergunta` viram o cabeçalho de contexto de cada trecho. */
  metadata?: Record<string, unknown>;
  /** Origem, quando o conteúdo veio de uma página. */
  sourceUrl?: string;
}

/**
 * Opções de ingestão que o serviço grava em rag_chunks.metadata e o re-rank
 * lê de volta. `priority` e `category` vêm do Q&A (A009: a prioridade 0 a 10
 * era só ordenação de tela e não pesava nada na busca).
 */
export interface IngestOptions {
  metadata?: Record<string, unknown>;
  /** Não fatiar: o conteúdo vira UM trecho só (Q&A, A011). */
  singleChunk?: boolean;
}

/**
 * Builder puro do form de ingestão. Isolado para teste sem tocar axios.
 * Rota real: POST /ingest. Campos reais: file, namespace, source?, metadata?,
 * single_chunk?, source_url?. O campo `tenant_id` do código antigo NÃO existe
 * no serviço e causava 422.
 */
export function buildIngestForm(
  organizationId: string,
  file: ArquivoParaIngestao,
  options: IngestOptions = {},
): { path: string; form: FormData } {
  const form = new FormData();
  form.append('namespace', namespaceFor(organizationId));
  form.append('source', file.source || file.filename);
  // Duas origens de metadata: o arquivo traz título e pergunta (cabeçalho de
  // contexto do trecho) e as opções trazem prioridade e categoria do Q&A.
  const metadata = { ...(file.metadata || {}), ...(options.metadata || {}) };
  if (Object.keys(metadata).length > 0) form.append('metadata', JSON.stringify(metadata));
  if (file.sourceUrl) form.append('source_url', file.sourceUrl);
  if (options.singleChunk) form.append('single_chunk', 'true');
  // `Buffer` is no longer assignable to `BlobPart` under newer @types/node
  // (SharedArrayBuffer / ArrayBuffer divergence). Wrap in Uint8Array, which is.
  form.append('file', new Blob([new Uint8Array(file.content)], { type: file.mimeType }), file.filename);
  return { path: '/ingest', form };
}

export async function ingestDocument(
  organizationId: string,
  file: ArquivoParaIngestao,
  options: IngestOptions = {},
) {
  const { path, form } = buildIngestForm(organizationId, file, options);
  // IMPORTANTE: NAO usar o ragClient (axios) aqui: a instancia forca
  // Content-Type: application/json em toda request, o que quebra o multipart
  // do /ingest (o servico Python recebe o form com header errado -> 422).
  // fetch/undici serializa o FormData+Blob com o boundary multipart correto.
  //
  // O timeout existe porque o RAG roda com auto_stop_machines: uma maquina
  // travada segurava o upload indefinidamente, sem nada do outro lado (A019).
  const res = await fetch(`${env.RAG_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: { 'X-Service-Secret': env.RAG_SERVICE_SECRET || '' },
    body: form as any,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.warn(`[RAG] ingest ${res.status}: ${detail.slice(0, 200)}`);
    throw erroDaRespostaDoRag(res.status, detail);
  }
  // Toda escrita de treino sobe a versão da organização: o cache da busca
  // passa a errar de propósito e o conteúdo novo vale na mensagem seguinte,
  // não em até 120 s (A010, A033).
  await bumpConfigVersion(organizationId);
  return res.json();
}

/**
 * Recusa endereço interno (SSRF).
 *
 * Todas as recusas saem como RagRequestError 422. Antes era `new Error` cru:
 * a rota não reconhecia o erro, `falhaDeIngestao` devolvia 503 e o cliente lia
 * "Tente de novo em alguns minutos" para um endereço que nunca vai funcionar,
 * por mais que ele tente. A frase agora diz a verdade e o que fazer.
 */
function assertPublicUrl(url: string): void {
  const recusar = (): never => {
    throw new RagRequestError(422, MENSAGEM_URL_NAO_PUBLICA);
  };

  let parsed: URL;
  try { parsed = new URL(url); } catch { return recusar(); }

  if (!['http:', 'https:'].includes(parsed.protocol)) return recusar();

  const hostname = parsed.hostname.toLowerCase();
  const blocked = [
    'localhost', '127.0.0.1', '0.0.0.0', '[::1]',
    '169.254.169.254',   // cloud metadata
    'metadata.google.internal',
  ];
  if (blocked.includes(hostname)) return recusar();

  // Block RFC 1918 private ranges
  const parts = hostname.split('.').map(Number);
  if (parts.length === 4 && parts.every(p => !isNaN(p))) {
    if (parts[0] === 10) return recusar();
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return recusar();
    if (parts[0] === 192 && parts[1] === 168) return recusar();
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
 * HTML → texto legível, feito aqui na API.
 *
 * Isto NÃO é código morto e não foi substituído pelo Readability do serviço de
 * indexação: é o caminho de quando o RAG que está no ar ainda não sabe ler
 * HTML. Ver `ragCapabilities`. Sem ele, a página inteira (script, menu,
 * rodapé) entrava no vetor: uma única página do YouTube gerou 1.532 trechos de
 * lixo que competiam no retrieval com o conteúdo curado do cliente.
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

// ── Capacidade do serviço de indexação ───────────────────────────────────────

/**
 * O que o RAG que está no ar sabe extrair.
 *
 * A janela de deploy não é simétrica: a API sobe sozinha ao fundir na `main`,
 * o RAG só sobe depois, num `workflow_dispatch` manual. Durante esse intervalo
 * a API nova conversa com o RAG antigo, que trata `text/html` como `text/*` e
 * grava a página inteira no vetor, com selo verde de indexado na tela. Depender
 * de alguém lembrar a ordem do deploy não é correção.
 *
 * Então a API pergunta. O `/ready` do RAG novo traz
 * `extratores: ["pdf","docx","xlsx","html","texto"]`; o antigo não traz campo
 * nenhum, e a ausência é lida como "não sabe HTML", que é o caminho seguro.
 * Cache de 5 minutos em memória porque isso muda uma vez por deploy, e o custo
 * de errar por 5 minutos é usar a limpeza antiga, não indexar lixo.
 */
const CAPACIDADES_TTL_MS = 5 * 60_000;

let capacidadesDoRag: { extratores: Set<string>; expiraEm: number } | null = null;

/** Só para teste: derruba o cache entre casos. */
export function esquecerCapacidadesDoRag(): void {
  capacidadesDoRag = null;
}

export async function ragCapabilities(): Promise<Set<string>> {
  const agora = Date.now();
  if (capacidadesDoRag && capacidadesDoRag.expiraEm > agora) return capacidadesDoRag.extratores;

  let extratores = new Set<string>();
  try {
    const { data } = await ragClient.get('/ready');
    const lista = (data as { extratores?: unknown } | null)?.extratores;
    if (Array.isArray(lista)) {
      extratores = new Set(lista.filter((item): item is string => typeof item === 'string'));
    }
  } catch (err: any) {
    // Serviço fora do ar não é motivo para mandar HTML cru: fica a lista vazia,
    // que leva ao caminho antigo.
    logger.warn(`[RAG] não consegui ler as capacidades do /ready: ${err?.message}`);
  }

  capacidadesDoRag = { extratores, expiraEm: agora + CAPACIDADES_TTL_MS };
  return extratores;
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

export async function ingestUrl(
  organizationId: string,
  url: string,
  opcoes: { source?: string; titulo?: string } = {},
) {
  assertPublicUrl(url);
  // Antes de gastar uma requisição: perfil de rede social não entrega conteúdo
  // a quem não está logado, e o menu de navegação que volta ia para o vetor
  // com selo verde de indexado (achado A012).
  if (ehRedeSocial(url)) throw new RagRequestError(422, MENSAGEM_REDE_SOCIAL);

  let resp;
  try {
    resp = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30_000,
      maxContentLength: 20 * 1024 * 1024, // alinhado ao MAX_UPLOAD_MB do serviço
      // Sem User-Agent, muito site devolve página de bloqueio em vez do texto.
      headers: { 'User-Agent': 'ZappIQ-Crawler/1.0 (+https://zappiq.com.br)' },
    });
  } catch (err: any) {
    logger.warn(`[RAG] leitura da URL falhou (${url}): ${err?.message}`);
    throw new RagRequestError(422, MENSAGEM_PAGINA_ILEGIVEL);
  }

  const mimeType =
    (resp.headers['content-type'] as string | undefined)?.split(';')[0]?.trim() ||
    'text/plain';

  const metadata = opcoes.titulo ? { titulo: opcoes.titulo } : undefined;
  const ehPagina = mimeType === 'text/html' || mimeType === 'application/xhtml+xml';

  // Com o RAG novo, a página vai CRUA: lá ela passa pelo Readability, que tira
  // menu e rodapé, e pelo portão de conteúdo mínimo. Com o RAG antigo, que
  // aceitaria o HTML como texto e gravaria a página inteira, a limpeza
  // acontece aqui, como sempre aconteceu.
  if (ehPagina && !(await ragCapabilities()).has('html')) {
    const texto = htmlToPlainText(Buffer.from(resp.data).toString('utf-8'));
    if (!texto) throw new RagRequestError(422, MENSAGEM_PAGINA_ILEGIVEL);
    return ingestDocument(organizationId, {
      filename: urlToSource(url),
      content: Buffer.from(texto, 'utf-8'),
      mimeType: 'text/plain',
      source: opcoes.source,
      metadata,
    });
  }

  return ingestDocument(organizationId, {
    filename: urlToSource(url),
    content: Buffer.from(resp.data),
    mimeType,
    source: opcoes.source,
    sourceUrl: url,
    metadata,
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
  // Desativar ou apagar também é escrita de treino: sobe a versão para o
  // conteúdo removido sair da busca na hora (A010).
  await bumpConfigVersion(organizationId);
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
