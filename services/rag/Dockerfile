# syntax=docker/dockerfile:1.7
# ──────────────────────────────────────────────────────────────────
# ZappIQ RAG Service — FastAPI Python
#
# Multi-stage para reduzir tamanho da imagem final.
# Usuário não-root por segurança.
# HEALTHCHECK validando /health.
# ──────────────────────────────────────────────────────────────────

ARG PYTHON_VERSION=3.12
ARG ALPINE_VERSION=3.20

# ─── Stage 1: builder ─────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-alpine${ALPINE_VERSION} AS builder

WORKDIR /tmp

# Dependências de build (temporárias)
RUN apk add --no-cache --virtual .build-deps \
    gcc \
    musl-dev \
    linux-headers

# Copiar requirements e instalar em venv
COPY requirements.txt .
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt

# ─── Stage 2: runtime ─────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-alpine${ALPINE_VERSION}

# Dependências runtime (sem build-deps)
RUN apk add --no-cache \
    curl \
    && addgroup --system --gid 1001 python \
    && adduser --system --uid 1001 --ingroup python appuser

WORKDIR /app

# Copiar venv da stage anterior
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8001

# Copiar código da aplicação
COPY services/rag/ ./

# User não-root
USER appuser

EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT}/health || exit 1

# CMD padrão
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
