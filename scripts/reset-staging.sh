#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}⚠️  WARNING: You are about to WIPE all staging data!${NC}"
echo ""
echo "This will truncate the following tables:"
echo "  - messages"
echo "  - conversations"
echo "  - contacts"
echo "  - kb_documents"
echo "  - qa_pairs"
echo "  - tenant_usage_monthly"
echo "  - kb_chunks"
echo ""
echo "To proceed, type exactly: YES I AM SURE"
read -p "Confirmation: " confirmation

if [ "$confirmation" != "YES I AM SURE" ]; then
  echo -e "${YELLOW}Aborted.${NC}"
  exit 0
fi

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}[ERROR] DATABASE_URL env var not set${NC}"
  exit 1
fi

if ! echo "$DATABASE_URL" | grep -qiE "(staging|preview)"; then
  echo -e "${RED}[ERROR] DATABASE_URL does not contain 'staging' or 'preview'. Safety check failed.${NC}"
  exit 1
fi

echo -e "${YELLOW}[RESET] Safety check passed. Proceeding with data wipe...${NC}"

PSQL_CMD="psql $DATABASE_URL"

echo "[RESET] Truncating tables..."

$PSQL_CMD << EOF
BEGIN;

TRUNCATE TABLE messages CASCADE;
TRUNCATE TABLE conversations CASCADE;
TRUNCATE TABLE contacts CASCADE;
TRUNCATE TABLE kb_documents CASCADE;
TRUNCATE TABLE kb_chunks CASCADE;
TRUNCATE TABLE qa_pairs CASCADE;
TRUNCATE TABLE tenant_usage_monthly CASCADE;

COMMIT;
EOF

echo -e "${GREEN}[RESET] Tables truncated successfully${NC}"

if [ "$1" != "--keep-users" ]; then
  echo "[RESET] Truncating users and organizations..."
  $PSQL_CMD << EOF
BEGIN;

TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE organizations CASCADE;

COMMIT;
EOF
  echo -e "${GREEN}[RESET] Users and organizations cleared${NC}"
else
  echo -e "${YELLOW}[RESET] Skipping users/organizations (--keep-users flag set)${NC}"
fi

echo ""
echo -e "${GREEN}[RESET] ✓ Staging database reset complete${NC}"
echo "[RESET] Running seed-staging.ts to repopulate..."
echo ""

cd "$(dirname "$0")/.."
pnpm exec tsx scripts/seed-staging.ts

echo -e "${GREEN}[RESET] ✓ Staging ready for testing${NC}"
