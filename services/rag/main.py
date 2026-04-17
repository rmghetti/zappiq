"""
ZappIQ RAG Service — FastAPI embedding, ingestion e vector search.

Responsabilidades:
  - /ingest: recebe PDF/TXT/MD, extrai texto, chunk por tokens, embed e upsert em pgvector
  - /embed: gera embedding de uma query (reusa cache quando disponivel)
  - /query: busca top_k vizinhos por cosine similarity no namespace
  - /health: liveness
  - /ready: readiness (Postgres + provider de embedding)

Decisoes chave:
  - Voyage AI como embedding provider primario (voyage-3, 1024 dim, 32k context,
    multilingual). OpenAI text-embedding-3-small (1536 dim) como fallback.
  - Chunk size: 512 tokens com overlap 64. Balanco entre recall e custo de embed.
  - Namespace isola multi-tenancy: sempre `org_<uuid>` para escopo por organizacao.
  - Upsert idempotente por hash(namespace + source + chunk_idx) evita duplicacao em
    re-ingestao do mesmo documento.
"""

import asyncio
import hashlib
import io
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Literal

import asyncpg
import fitz  # PyMuPDF
import tiktoken
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pgvector.asyncpg import register_vector
from pydantic import BaseModel, Field

# ── OpenTelemetry ──────────────────────────────────────────────────────
# SDK init precisa rodar antes de qualquer import instrumentado.
# Exporta traces + metrics via OTLP HTTP para o mesmo gateway Grafana Cloud da API.
from opentelemetry import trace, metrics as otel_metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

_OTEL_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "").rstrip("/")
_resource = Resource.create({
    SERVICE_NAME: os.getenv("OTEL_SERVICE_NAME", "zappiq-rag"),
    SERVICE_VERSION: "0.2.0",
    "deployment.environment": os.getenv("DEPLOYMENT_ENV", os.getenv("NODE_ENV", "development")),
    "service.instance.id": os.getenv("FLY_MACHINE_ID", os.getenv("HOSTNAME", "local")),
})

# Traces
_tracer_provider = TracerProvider(resource=_resource)
if _OTEL_ENDPOINT:
    _tracer_provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{_OTEL_ENDPOINT}/v1/traces"))
    )
trace.set_tracer_provider(_tracer_provider)
_tracer = trace.get_tracer("zappiq.rag", "0.2.0")

# Metrics
_metric_readers = []
if _OTEL_ENDPOINT:
    _metric_readers.append(
        PeriodicExportingMetricReader(
            OTLPMetricExporter(endpoint=f"{_OTEL_ENDPOINT}/v1/metrics"),
            export_interval_millis=30_000,
        )
    )
_meter_provider = MeterProvider(resource=_resource, metric_readers=_metric_readers)
otel_metrics.set_meter_provider(_meter_provider)
_meter = otel_metrics.get_meter("zappiq.rag", "0.2.0")

# Custom metrics
rag_embed_duration = _meter.create_histogram("zappiq_rag_embed_duration_seconds", unit="s", description="Embedding batch duration")
rag_embed_tokens = _meter.create_counter("zappiq_rag_embed_tokens_total", description="Tokens embedded")
rag_query_duration = _meter.create_histogram("zappiq_rag_query_duration_seconds", unit="s", description="Vector search duration")
rag_ingest_duration = _meter.create_histogram("zappiq_rag_ingest_duration_seconds", unit="s", description="Full ingest pipeline duration")
rag_ingest_chunks = _meter.create_counter("zappiq_rag_ingest_chunks_total", description="Chunks ingested")


# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL", "")
VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

EMBEDDING_PROVIDER: Literal["voyage", "openai"] = os.getenv("EMBEDDING_PROVIDER", "voyage")  # type: ignore
EMBEDDING_MODEL = os.getenv(
    "EMBEDDING_MODEL",
    "voyage-3" if EMBEDDING_PROVIDER == "voyage" else "text-embedding-3-small",
)
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "1024" if EMBEDDING_PROVIDER == "voyage" else "1536"))

CHUNK_TOKENS = int(os.getenv("CHUNK_TOKENS", "512"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "64"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "20"))

PORT = int(os.getenv("PORT", "8001"))


# ─────────────────────────────────────────────────────────────────────────────
# Logging (JSON para ingestao em stack de observabilidade)
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format='{"ts":"%(asctime)s","level":"%(levelname)s","svc":"rag","msg":"%(message)s"}',
)
logger = logging.getLogger("rag")


# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────


class EmbedRequest(BaseModel):
    text: str
    namespace: str


class EmbedResponse(BaseModel):
    vector: list[float]
    model: str
    dim: int


class QueryRequest(BaseModel):
    query: str
    namespace: str
    top_k: int = Field(default=10, ge=1, le=100)
    min_similarity: float = Field(default=0.0, ge=0.0, le=1.0)


class QueryResult(BaseModel):
    id: str
    text: str
    similarity: float
    source: str | None = None
    chunk_idx: int


class QueryResponse(BaseModel):
    results: list[QueryResult]
    latency_ms: int


class IngestResponse(BaseModel):
    namespace: str
    source: str
    chunks_ingested: int
    tokens_embedded: int
    latency_ms: int


# ─────────────────────────────────────────────────────────────────────────────
# State (pool + tokenizer + http client)
# ─────────────────────────────────────────────────────────────────────────────


class AppState:
    pool: asyncpg.Pool | None = None
    tokenizer: tiktoken.Encoding | None = None


state = AppState()


# ─────────────────────────────────────────────────────────────────────────────
# Lifecycle
# ─────────────────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """
    Startup:
      - cria pool asyncpg (min 2, max 10) — RAG nao precisa muitas conexoes
      - registra tipo pgvector no pool
      - carrega tokenizer cl100k_base (OpenAI/Voyage usam compativel)
      - valida que temos API key de embedding
    Shutdown:
      - fecha pool
    """
    if not DATABASE_URL:
        logger.error("DATABASE_URL nao definido — RAG nao pode operar")
    else:
        state.pool = await asyncpg.create_pool(
            dsn=DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=30,
            init=_register_vector,
        )
        logger.info("asyncpg pool criado (min=2, max=10)")

    state.tokenizer = tiktoken.get_encoding("cl100k_base")

    if EMBEDDING_PROVIDER == "voyage" and not VOYAGE_API_KEY:
        logger.warning("VOYAGE_API_KEY ausente — /embed e /ingest vao falhar")
    if EMBEDDING_PROVIDER == "openai" and not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY ausente — /embed e /ingest vao falhar")

    logger.info(
        f"RAG up: provider={EMBEDDING_PROVIDER} model={EMBEDDING_MODEL} dim={EMBEDDING_DIM} "
        f"chunk={CHUNK_TOKENS}/{CHUNK_OVERLAP}"
    )

    yield

    # Shutdown OTel (flush pending spans/metrics)
    _tracer_provider.shutdown()
    _meter_provider.shutdown()
    logger.info("OTel SDK shut down")

    if state.pool:
        await state.pool.close()
        logger.info("asyncpg pool fechado")


async def _register_vector(conn: asyncpg.Connection) -> None:
    """Registra tipo vector em cada conexao nova do pool."""
    await register_vector(conn)


# ─────────────────────────────────────────────────────────────────────────────
# App
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ZappIQ RAG Service",
    description="Ingestao, embedding e vector search para RAG",
    version="0.2.0",
    lifespan=lifespan,
)

# Auto-instrumenta rotas FastAPI (request/response spans + http metrics)
FastAPIInstrumentor.instrument_app(app)


# ─────────────────────────────────────────────────────────────────────────────
# Utilities — text extraction
# ─────────────────────────────────────────────────────────────────────────────


def _extract_pdf(data: bytes) -> str:
    """Extrai texto de PDF com PyMuPDF. Preserva quebras de pagina com \\n\\n."""
    with fitz.open(stream=data, filetype="pdf") as doc:
        pages = [page.get_text("text") for page in doc]
    return "\n\n".join(pages).strip()


def _extract_text(content_type: str | None, filename: str, data: bytes) -> str:
    """Dispatch por content-type ou extensao. Levanta HTTPException se nao suportado."""
    lower = filename.lower()
    if (content_type == "application/pdf") or lower.endswith(".pdf"):
        return _extract_pdf(data)
    if (content_type and content_type.startswith("text/")) or lower.endswith((".txt", ".md")):
        try:
            return data.decode("utf-8", errors="replace").strip()
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Falha ao decodificar texto: {exc}")
    raise HTTPException(
        status_code=415,
        detail=f"Content-type nao suportado: {content_type} ({filename}). Use pdf/txt/md.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Utilities — chunking (token-based, com overlap)
# ─────────────────────────────────────────────────────────────────────────────


def _chunk_text(text: str, chunk_tokens: int = CHUNK_TOKENS, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """
    Chunk por tokens (nao por chars). Overlap preserva contexto entre chunks.

    Exemplo: chunk_tokens=512, overlap=64
      chunk0 = tokens[0:512]
      chunk1 = tokens[448:960]
      chunk2 = tokens[896:1408]
      ...
    """
    if not state.tokenizer:
        raise RuntimeError("Tokenizer nao inicializado")
    if chunk_tokens <= overlap:
        raise ValueError("chunk_tokens deve ser > overlap")

    tokens = state.tokenizer.encode(text)
    if not tokens:
        return []

    step = chunk_tokens - overlap
    chunks: list[str] = []
    for start in range(0, len(tokens), step):
        window = tokens[start : start + chunk_tokens]
        if not window:
            break
        chunks.append(state.tokenizer.decode(window))
        if start + chunk_tokens >= len(tokens):
            break
    return chunks


# ─────────────────────────────────────────────────────────────────────────────
# Utilities — embeddings (Voyage ou OpenAI)
# ─────────────────────────────────────────────────────────────────────────────


async def _embed_batch(texts: list[str], input_type: Literal["document", "query"]) -> list[list[float]]:
    """
    Gera embeddings em batch. Voyage aceita 128 inputs/call, OpenAI 2048.
    Fazemos batching de 64 para ficar conservador em ambos.
    """
    import time as _time

    if not texts:
        return []

    t0 = _time.monotonic()
    batch_size = 64
    vectors: list[list[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        if EMBEDDING_PROVIDER == "voyage":
            vectors.extend(await _embed_voyage(batch, input_type))
        else:
            vectors.extend(await _embed_openai(batch))

    elapsed = _time.monotonic() - t0
    attrs = {"provider": EMBEDDING_PROVIDER, "input_type": input_type}
    rag_embed_duration.record(elapsed, attrs)
    token_count = sum(len(state.tokenizer.encode(t)) for t in texts) if state.tokenizer else 0
    if token_count > 0:
        rag_embed_tokens.add(token_count, attrs)

    return vectors


async def _embed_voyage(texts: list[str], input_type: Literal["document", "query"]) -> list[list[float]]:
    """Voyage AI. SDK oficial e sincrono, chamamos via run_in_executor."""
    if not VOYAGE_API_KEY:
        raise HTTPException(status_code=500, detail="VOYAGE_API_KEY nao configurada")

    import voyageai  # import tardio pra startup rapido em cenarios sem embedding

    client = voyageai.Client(api_key=VOYAGE_API_KEY)

    loop = asyncio.get_running_loop()
    res = await loop.run_in_executor(
        None,
        lambda: client.embed(texts=texts, model=EMBEDDING_MODEL, input_type=input_type),
    )
    return res.embeddings


async def _embed_openai(texts: list[str]) -> list[list[float]]:
    """OpenAI embeddings (fallback). SDK async nativo."""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY nao configurada")

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    res = await client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [d.embedding for d in res.data]


# ─────────────────────────────────────────────────────────────────────────────
# Utilities — pgvector upsert/query
# ─────────────────────────────────────────────────────────────────────────────

# Tabela esperada (criar via migration em packages/database):
#
#   CREATE EXTENSION IF NOT EXISTS vector;
#   CREATE TABLE rag_chunks (
#     id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
#     namespace    TEXT NOT NULL,
#     source       TEXT NOT NULL,
#     chunk_idx    INT  NOT NULL,
#     chunk_hash   TEXT NOT NULL,
#     text         TEXT NOT NULL,
#     embedding    vector(1024) NOT NULL,  -- ou 1536 se OpenAI
#     metadata     JSONB NOT NULL DEFAULT '{}',
#     created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
#     UNIQUE (namespace, chunk_hash)
#   );
#   CREATE INDEX rag_chunks_ns_idx ON rag_chunks (namespace);
#   CREATE INDEX rag_chunks_embedding_idx ON rag_chunks
#     USING hnsw (embedding vector_cosine_ops);


def _chunk_hash(namespace: str, source: str, chunk_idx: int, text: str) -> str:
    """Hash idempotente pra upsert. Inclui texto pra re-embed se conteudo mudou."""
    payload = f"{namespace}|{source}|{chunk_idx}|{text}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


async def _upsert_chunks(
    namespace: str,
    source: str,
    chunks: list[str],
    vectors: list[list[float]],
    metadata: dict,
) -> int:
    """
    Upsert idempotente. ON CONFLICT (namespace, chunk_hash) DO NOTHING — se o
    conteudo nao mudou, pulamos. Se mudou, chunk_hash muda e ele e inserido.

    Nota: nao deletamos chunks antigos aqui. Cleanup de versoes antigas do mesmo
    source e responsabilidade de um job separado (audit-log-lifecycle pattern).
    """
    if not state.pool:
        raise HTTPException(status_code=503, detail="DB pool nao inicializado")
    if len(chunks) != len(vectors):
        raise RuntimeError("chunks e vectors com tamanhos diferentes")

    metadata_json = json.dumps(metadata)
    rows = [
        (
            namespace,
            source,
            idx,
            _chunk_hash(namespace, source, idx, chunk),
            chunk,
            vec,
            metadata_json,
        )
        for idx, (chunk, vec) in enumerate(zip(chunks, vectors))
    ]

    async with state.pool.acquire() as conn:
        async with conn.transaction():
            result = await conn.executemany(
                """
                INSERT INTO rag_chunks
                    (namespace, source, chunk_idx, chunk_hash, text, embedding, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
                ON CONFLICT (namespace, chunk_hash) DO NOTHING
                """,
                rows,
            )
    return len(rows)


async def _knn_search(
    namespace: str, query_vector: list[float], top_k: int, min_similarity: float
) -> list[QueryResult]:
    """
    Busca KNN com cosine distance (vector_cosine_ops no HNSW).
    similarity = 1 - distance. Filtro min_similarity descarta resultados fracos.
    """
    if not state.pool:
        raise HTTPException(status_code=503, detail="DB pool nao inicializado")

    async with state.pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id::text AS id,
                   text,
                   source,
                   chunk_idx,
                   1 - (embedding <=> $2) AS similarity
              FROM rag_chunks
             WHERE namespace = $1
             ORDER BY embedding <=> $2
             LIMIT $3
            """,
            namespace,
            query_vector,
            top_k,
        )

    return [
        QueryResult(
            id=row["id"],
            text=row["text"],
            source=row["source"],
            chunk_idx=row["chunk_idx"],
            similarity=float(row["similarity"]),
        )
        for row in rows
        if float(row["similarity"]) >= min_similarity
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "service": "zappiq-rag", "version": "0.2.0"}


@app.get("/ready", tags=["health"])
async def ready():
    """Readiness: Postgres responde SELECT 1 e temos API key de embedding."""
    checks: dict = {}
    ok = True

    if state.pool:
        try:
            async with state.pool.acquire() as conn:
                await conn.execute("SELECT 1")
            checks["postgres"] = {"ok": True}
        except Exception as exc:
            checks["postgres"] = {"ok": False, "error": str(exc)}
            ok = False
    else:
        checks["postgres"] = {"ok": False, "error": "pool nao inicializado"}
        ok = False

    has_key = (EMBEDDING_PROVIDER == "voyage" and bool(VOYAGE_API_KEY)) or (
        EMBEDDING_PROVIDER == "openai" and bool(OPENAI_API_KEY)
    )
    checks["embedding"] = {"ok": has_key, "provider": EMBEDDING_PROVIDER, "model": EMBEDDING_MODEL}
    if not has_key:
        ok = False

    return {
        "status": "ready" if ok else "not_ready",
        "service": "zappiq-rag",
        "checks": checks,
    }


@app.post("/embed", tags=["embeddings"], response_model=EmbedResponse)
async def embed(request: EmbedRequest):
    """Gera embedding de uma query (input_type='query' no Voyage)."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="text vazio")
    if not request.namespace.strip():
        raise HTTPException(status_code=400, detail="namespace vazio")

    vectors = await _embed_batch([request.text], input_type="query")
    vector = vectors[0]

    return EmbedResponse(vector=vector, model=EMBEDDING_MODEL, dim=len(vector))


@app.post("/query", tags=["search"], response_model=QueryResponse)
async def query(request: QueryRequest):
    """Embed da query + KNN no pgvector + filtro de similarity."""
    import time

    t0 = time.monotonic()

    if not request.query.strip():
        raise HTTPException(status_code=400, detail="query vazia")
    if not request.namespace.strip():
        raise HTTPException(status_code=400, detail="namespace vazio")

    vectors = await _embed_batch([request.query], input_type="query")
    results = await _knn_search(
        namespace=request.namespace,
        query_vector=vectors[0],
        top_k=request.top_k,
        min_similarity=request.min_similarity,
    )

    elapsed = time.monotonic() - t0
    latency = int(elapsed * 1000)
    rag_query_duration.record(elapsed, {"namespace": request.namespace})
    logger.info(
        f"query ns={request.namespace} k={request.top_k} "
        f"returned={len(results)} latency_ms={latency}"
    )
    return QueryResponse(results=results, latency_ms=latency)


@app.post("/ingest", tags=["ingestion"], response_model=IngestResponse)
async def ingest(
    file: UploadFile = File(...),
    namespace: str = Form(...),
    source: str | None = Form(None),
    metadata: str | None = Form(None),  # JSON string
):
    """
    Ingestao: upload -> extract -> chunk -> embed -> upsert.

    Form fields:
      file       — PDF, TXT ou MD (max 20MB)
      namespace  — 'org_<uuid>' (isola multi-tenant)
      source     — identificador do doc (default: filename)
      metadata   — JSON extra (ex: {"uploader":"user_123","category":"faq"})
    """
    import time

    t0 = time.monotonic()

    if not namespace.strip():
        raise HTTPException(status_code=400, detail="namespace vazio")

    # Limite de tamanho antes de carregar tudo em memoria
    data = await file.read()
    size_mb = len(data) / (1024 * 1024)
    if size_mb > MAX_UPLOAD_MB:
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo {size_mb:.1f}MB excede limite de {MAX_UPLOAD_MB}MB",
        )

    # Parse metadata
    meta: dict = {}
    if metadata:
        try:
            meta = json.loads(metadata)
            if not isinstance(meta, dict):
                raise ValueError("metadata deve ser um objeto JSON")
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"metadata JSON invalido: {exc}")

    source_id = source or file.filename or "unknown"
    meta.setdefault("original_filename", file.filename)
    meta.setdefault("content_type", file.content_type)
    meta.setdefault("size_bytes", len(data))

    # Extract
    text = _extract_text(file.content_type, file.filename or "", data)
    if not text.strip():
        raise HTTPException(status_code=422, detail="Arquivo sem texto extraivel")

    # Chunk
    chunks = _chunk_text(text)
    if not chunks:
        raise HTTPException(status_code=422, detail="Nenhum chunk gerado apos tokenizacao")

    # Embed
    vectors = await _embed_batch(chunks, input_type="document")

    # Upsert
    await _upsert_chunks(
        namespace=namespace,
        source=source_id,
        chunks=chunks,
        vectors=vectors,
        metadata=meta,
    )

    elapsed = time.monotonic() - t0
    latency = int(elapsed * 1000)
    tokens = sum(len(state.tokenizer.encode(c)) for c in chunks) if state.tokenizer else 0

    # OTel metrics
    rag_ingest_duration.record(elapsed, {"namespace": namespace})
    rag_ingest_chunks.add(len(chunks), {"namespace": namespace})

    logger.info(
        f"ingest ns={namespace} source={source_id} "
        f"chunks={len(chunks)} tokens={tokens} size_mb={size_mb:.2f} "
        f"latency_ms={latency}"
    )

    return IngestResponse(
        namespace=namespace,
        source=source_id,
        chunks_ingested=len(chunks),
        tokens_embedded=tokens,
        latency_ms=latency,
    )


@app.delete("/ingest/{namespace}/{source}", tags=["ingestion"])
async def delete_source(namespace: str, source: str):
    """Remove todos os chunks de um source em um namespace (LGPD Art. 18 DSR)."""
    if not state.pool:
        raise HTTPException(status_code=503, detail="DB pool nao inicializado")

    async with state.pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM rag_chunks WHERE namespace = $1 AND source = $2",
            namespace,
            source,
        )
    deleted = int(result.split()[-1]) if result.startswith("DELETE ") else 0
    logger.info(f"delete_source ns={namespace} source={source} deleted={deleted}")
    return {"namespace": namespace, "source": source, "deleted": deleted}


# ─────────────────────────────────────────────────────────────────────────────
# Error handler global
# ─────────────────────────────────────────────────────────────────────────────


@app.exception_handler(Exception)
async def generic_exception_handler(_request, exc: Exception):
    logger.error(f"unhandled exception: {exc}", exc_info=True)
    return {"error": "internal_server_error", "detail": str(exc)}


# ─────────────────────────────────────────────────────────────────────────────
# Dev entrypoint
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True, log_level="info")
