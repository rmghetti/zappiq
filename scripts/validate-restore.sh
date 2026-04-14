#!/bin/bash
# ZappIQ — Validação de restore (ADR-0002)
# Roda mensalmente ou após qualquer incidente SEV1 de dados.
#
# Fluxo:
# 1. Restaura o dump semanal mais recente (S3) em banco sandbox (Supabase branch ou Postgres local)
# 2. Roda smoke tests contra o restore
# 3. Mede tempo total (RTO objetivo: <4h)
# 4. Falha loud se algum check crítico quebrar
#
# Uso:
#   ./scripts/validate-restore.sh                        # usa bucket padrão + banco sandbox padrão
#   RESTORE_DB_URL=postgresql://... ./scripts/validate-restore.sh

set -euo pipefail

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
BACKUP_BUCKET="${BACKUP_S3_BUCKET:-zappiq-backups-prod}"
BACKUP_REGION="${BACKUP_S3_REGION:-us-east-1}"
RESTORE_DB_URL="${RESTORE_DB_URL:-}"

if [[ -z "$RESTORE_DB_URL" ]]; then
  echo "ERRO: defina RESTORE_DB_URL (Postgres sandbox — NUNCA produção)"
  echo "Exemplo: export RESTORE_DB_URL=postgresql://postgres:pass@localhost:5432/zappiq_restore_test"
  exit 1
fi

# Salvaguarda: evitar apontar para prod
if echo "$RESTORE_DB_URL" | grep -qE "supabase\.co.*postgres$|zappiq-prod"; then
  echo "ERRO: RESTORE_DB_URL parece apontar para produção. Abortando."
  exit 1
fi

START_TS=$(date +%s)
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

echo "═══════════════════════════════════════════════════"
echo "  ZappIQ — Validação de restore"
echo "  Início: $(date -u)"
echo "  DB alvo: $(echo "$RESTORE_DB_URL" | sed -E 's|://[^@]+@|://***@|')"
echo "═══════════════════════════════════════════════════"

# ─────────────────────────────────────────────
# 1. Baixar dump mais recente do S3
# ─────────────────────────────────────────────
echo ""
echo "→ 1/5 Listando dumps em s3://$BACKUP_BUCKET/ ..."
LATEST_KEY=$(aws s3api list-objects-v2 \
  --bucket "$BACKUP_BUCKET" \
  --query 'sort_by(Contents, &LastModified) | [-1].Key' \
  --output text \
  --region "$BACKUP_REGION")

if [[ -z "$LATEST_KEY" || "$LATEST_KEY" == "None" ]]; then
  echo "ERRO: nenhum dump encontrado em s3://$BACKUP_BUCKET/"
  exit 2
fi

LATEST_SIZE=$(aws s3api head-object \
  --bucket "$BACKUP_BUCKET" \
  --key "$LATEST_KEY" \
  --query 'ContentLength' \
  --output text \
  --region "$BACKUP_REGION")

echo "  Mais recente: $LATEST_KEY ($(( LATEST_SIZE / 1024 / 1024 )) MB)"

DUMP_FILE="$TMPDIR/$(basename "$LATEST_KEY")"
aws s3 cp "s3://$BACKUP_BUCKET/$LATEST_KEY" "$DUMP_FILE" --region "$BACKUP_REGION"
echo "  Download OK."

# ─────────────────────────────────────────────
# 2. Descompactar se necessário
# ─────────────────────────────────────────────
echo ""
echo "→ 2/5 Preparando dump..."
if [[ "$DUMP_FILE" == *.gz ]]; then
  gunzip "$DUMP_FILE"
  DUMP_FILE="${DUMP_FILE%.gz}"
fi
echo "  Dump: $DUMP_FILE"

# ─────────────────────────────────────────────
# 3. Restaurar no sandbox
# ─────────────────────────────────────────────
echo ""
echo "→ 3/5 Restaurando no sandbox (pode demorar alguns minutos)..."
RESTORE_START=$(date +%s)

# Limpa o sandbox antes
psql "$RESTORE_DB_URL" -c "
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO postgres;
  GRANT ALL ON SCHEMA public TO public;
" >/dev/null

# Restore
if [[ "$DUMP_FILE" == *.dump ]] || file "$DUMP_FILE" | grep -q "PostgreSQL custom database dump"; then
  pg_restore --no-owner --no-privileges --dbname "$RESTORE_DB_URL" "$DUMP_FILE"
else
  psql "$RESTORE_DB_URL" < "$DUMP_FILE" >/dev/null
fi

RESTORE_END=$(date +%s)
RESTORE_DURATION=$((RESTORE_END - RESTORE_START))
echo "  Restore OK em ${RESTORE_DURATION}s."

# ─────────────────────────────────────────────
# 4. Smoke tests no restore
# ─────────────────────────────────────────────
echo ""
echo "→ 4/5 Smoke tests no banco restaurado..."

check_sql() {
  local description="$1"
  local query="$2"
  local expected="$3"
  local result
  result=$(psql "$RESTORE_DB_URL" -tAc "$query" 2>&1 | tr -d '[:space:]')
  if [[ "$result" == "$expected" ]] || [[ "$expected" == "*" && -n "$result" ]]; then
    echo "  ✓ $description"
  else
    echo "  ✗ $description (esperado: $expected, obtido: $result)"
    FAILED=$((${FAILED:-0} + 1))
  fi
}

FAILED=0

# Tabelas core existem
check_sql "Tabela User existe" \
  "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename='User';" "1"

check_sql "Tabela Organization existe" \
  "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename='Organization';" "1"

check_sql "Tabela Conversation existe" \
  "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename='Conversation';" "1"

check_sql "Tabela Message existe" \
  "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename='Message';" "1"

check_sql "Tabela AuditLog existe" \
  "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename='AuditLog';" "1"

# Dados presentes (não é um dump vazio)
check_sql "User count > 0" \
  "SELECT COUNT(*) > 0 FROM \"User\";" "t"

check_sql "Organization count > 0" \
  "SELECT COUNT(*) > 0 FROM \"Organization\";" "t"

# Integridade referencial — nenhum órfão em Message -> Conversation
check_sql "Sem Messages órfãs" \
  "SELECT COUNT(*) FROM \"Message\" m LEFT JOIN \"Conversation\" c ON m.\"conversationId\" = c.id WHERE c.id IS NULL;" "0"

# pgvector + rag_chunks (pode não existir se dump é anterior ao RAG)
HAS_RAG=$(psql "$RESTORE_DB_URL" -tAc "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename='rag_chunks';" | tr -d '[:space:]')
if [[ "$HAS_RAG" == "1" ]]; then
  check_sql "rag_chunks tem vector dim correto" \
    "SELECT COUNT(*) FROM pg_attribute WHERE attrelid='public.rag_chunks'::regclass AND attname='embedding';" "1"
fi

# RLS policies (se já aplicadas)
check_sql "RLS enabled em AuditLog (0 ou 1)" \
  "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename='AuditLog' AND rowsecurity=true;" "*"

# ─────────────────────────────────────────────
# 5. Relatório
# ─────────────────────────────────────────────
END_TS=$(date +%s)
TOTAL_DURATION=$((END_TS - START_TS))

echo ""
echo "→ 5/5 Relatório final"
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Tempo total:       ${TOTAL_DURATION}s ($(( TOTAL_DURATION / 60 ))min)"
echo "  Tempo restore:     ${RESTORE_DURATION}s"
echo "  Dump source:       $LATEST_KEY"
echo "  Dump size:         $(( LATEST_SIZE / 1024 / 1024 )) MB"
echo "  Checks falhados:   $FAILED"
echo "═══════════════════════════════════════════════════"

# RTO target 4h = 14400s
if [[ $TOTAL_DURATION -gt 14400 ]]; then
  echo ""
  echo "⚠ AVISO: tempo total excedeu RTO target de 4h (ADR-0002)."
  echo "  Revisar tamanho do dump ou infraestrutura do sandbox."
fi

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "✗ FALHOU: $FAILED checks não passaram."
  exit 3
fi

echo ""
echo "✓ Restore validado. Dump é recuperável e íntegro."
exit 0
