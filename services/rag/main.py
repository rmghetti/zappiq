"""
ZappIQ RAG Service — FastAPI embedding e vector search

TODO:
  - Integrar com Supabase pgvector via asyncpg + SQLAlchemy
  - Integrar com Voyage AI (embeddings) ou OpenAI embeddings
  - Adicionar autenticação JWT (compartilhado com apps/api)
  - Rate limiting (ex: sliding window em Redis)
  - Tracing OpenTelemetry (alinhado com apps/api)
  - Testes unitários
  - Healthcheck que verifica conexão com Supabase
"""

import json
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format=json.dumps(
        {
            "timestamp": "%(asctime)s",
            "level": "%(levelname)s",
            "message": "%(message)s",
        }
    ),
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────


class EmbedRequest(BaseModel):
    """Request para gerar embeddings"""

    text: str
    namespace: str


class EmbedResponse(BaseModel):
    """Response com vetor de embedding"""

    vector: list[float]


class QueryRequest(BaseModel):
    """Request para buscar vetores similares"""

    query: str
    namespace: str
    top_k: int = 10


class QueryResult(BaseModel):
    """Um resultado de busca"""

    id: str
    text: str
    similarity: float


class QueryResponse(BaseModel):
    """Response com resultados de busca"""

    results: list[QueryResult]


# ─────────────────────────────────────────────────────────────────────────────
# Lifecycle
# ─────────────────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle manager para startup/shutdown.

    TODO:
      - Conectar com Supabase pgvector pool na startup
      - Fechar pool na shutdown
      - Validar configuração de embeddings (API key, modelo)
    """
    logger.info("RAG service starting up...")

    # TODO: Inicializar conexões aqui

    yield

    logger.info("RAG service shutting down...")

    # TODO: Fechar conexões aqui


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ZappIQ RAG Service",
    description="Embedding e vector search para Retrieval-Augmented Generation",
    version="0.1.0",
    lifespan=lifespan,
)


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────


@app.get("/health", tags=["health"])
async def health():
    """Health check do serviço"""
    return {
        "status": "ok",
        "service": "zappiq-rag",
        "version": "0.1.0",
    }


@app.post("/embed", tags=["embeddings"], response_model=EmbedResponse)
async def embed(request: EmbedRequest):
    """
    Gera embedding para um texto.

    TODO:
      - Chamar Voyage AI ou OpenAI embeddings
      - Validar token count do texto
      - Cache de embeddings em Redis
      - Logging de latência
    """
    logger.info(f"Embed request: namespace={request.namespace}, text_len={len(request.text)}")

    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    if not request.namespace or len(request.namespace.strip()) == 0:
        raise HTTPException(status_code=400, detail="Namespace cannot be empty")

    # TODO: Gerar embedding via Voyage AI / OpenAI
    # Placeholder: retorna vetor de zeros (dimensionalidade esperada = 1536 para OpenAI)
    vector = [0.0] * 1536

    return EmbedResponse(vector=vector)


@app.post("/query", tags=["search"], response_model=QueryResponse)
async def query(request: QueryRequest):
    """
    Busca vetores similares em um namespace.

    TODO:
      - Gerar embedding da query
      - Buscar vizinhos mais próximos em Supabase pgvector
      - Calcular similarity score (cosine)
      - Aplicar threshold de relevância
      - Logging e tracing
    """
    logger.info(
        f"Query request: namespace={request.namespace}, "
        f"query_len={len(request.query)}, top_k={request.top_k}"
    )

    if not request.query or len(request.query.strip()) == 0:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    if not request.namespace or len(request.namespace.strip()) == 0:
        raise HTTPException(status_code=400, detail="Namespace cannot be empty")

    if request.top_k <= 0 or request.top_k > 100:
        raise HTTPException(status_code=400, detail="top_k must be between 1 and 100")

    # TODO: Buscar em Supabase pgvector
    # Placeholder: retorna lista vazia
    results = []

    return QueryResponse(results=results)


# ─────────────────────────────────────────────────────────────────────────────
# Error Handlers
# ─────────────────────────────────────────────────────────────────────────────


@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return {
        "error": "Internal server error",
        "detail": str(exc),
    }


if __name__ == "__main__":
    # Local development only
    import uvicorn

    port = int(os.getenv("PORT", 8001))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info",
    )
