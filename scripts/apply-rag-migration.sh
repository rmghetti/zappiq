#!/usr/bin/env bash
# Aplica rag_pgvector.sql no banco apontado por DATABASE_URL.
#
# Por que nao Prisma db push?
#   - Prisma nao modela HNSW index (USING hnsw vector_cosine_ops)
#   - RagChunk e escrito pelo servico Python (asyncpg), nao pelo Prisma Client
#   - Manter o schema.prisma como fonte de verdade SOMENTE do app Node e mais
#     simples e evita conflito de colunas entre Python/Prisma
#
# Idempotencia: rag_pgvector.sql usa CREATE ... IF NOT EXISTS em tudo.
#
# Uso:
#   export DATABASE_URL=postgresql://...
#   ./scripts/apply-rag-migration.sh
#
#   # Ou apontando explicitamente pro Supabase:
#   DATABASE_URL="postgresql://postgres:...@db.xxx.supabase.co:5432/postgres" \
#     ./scripts/apply-rag-migration.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/../packages/database/prisma/rag_pgvector.sql"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERRO: DATABASE_URL nao definido" >&2
  echo "Exemplo: export DATABASE_URL='postgresql://user:pass@host:5432/db'" >&2
  exit 1
fi

if [[ ! -f "$SQL_FILE" ]]; then
  echo "ERRO: $SQL_FILE nao encontrado" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERRO: psql nao instalado. Instale com:" >&2
  echo "  macOS:  brew install libpq && brew link --force libpq" >&2
  echo "  Ubuntu: apt-get install postgresql-client" >&2
  exit 1
fi

echo ">> Aplicando $SQL_FILE em $(echo "$DATABASE_URL" | sed 's|://[^:]*:[^@]*@|://***:***@|')"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"

echo ""
echo ">> Verificando que a tabela foi criada..."
psql "$DATABASE_URL" -c "\dt rag_chunks" -c "\di rag_chunks*"

echo ""
echo ">> OK. rag_chunks pronto pra receber ingestao do servico RAG."
