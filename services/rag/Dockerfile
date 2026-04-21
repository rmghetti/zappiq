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
# NOTA: build context e a raiz do monorepo (fly.rag.toml vive la),
# entao o path precisa ser explicito a partir da raiz.
COPY services/rag/requirements.txt .
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt

# ─── Stage 2: runtime ─────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-alpine${ALPINE_VERSION}

# Dependências runtime (sem build-deps)
# libstdc++ e requerido pelo binario nativo do PyMuPDF (_extra.so)
RUN apk add --no-cache \
    curl \
    libstdc++ \
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
# --chown garante que appuser (uid 1001) e o dono, nao root.
# --chmod=0755 forca perms legives por todos, defendendo contra umask
# 077 do ambiente de build (Cowork/sandboxes restritivos gravam 600/700).
# Sem isso, COPY preserva os perms do host e o appuser nao consegue ler
# /app/main.py, resultando em PermissionError: [Errno 13] no startup.
COPY --chown=appuser:python --chmod=0755 services/rag/ ./

# Belt-and-suspenders: garante que todos os arquivos sao legives/executaveis
# por qualquer user, mesmo se algum COPY futuro esquecer o --chmod.
RUN chmod -R a+rX /app

# User não-root
USER appuser

EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT}/health || exit 1

# CMD padrão
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
