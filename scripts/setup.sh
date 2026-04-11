#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# ZappIQ — Setup completo do projeto
# Execute: ./scripts/setup.sh
# ═══════════════════════════════════════════════════════════════════

set -e

echo ""
echo "  ⚡ ZappIQ — Setup do Projeto"
echo "  ═══════════════════════════════════"
echo ""

# 1. Verificar Node.js
echo "1️⃣  Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "   ❌ Node.js não encontrado. Instale v20+"
    exit 1
fi
NODE_V=$(node -v)
echo "   ✅ Node.js ${NODE_V}"

# 2. Verificar pnpm
echo "2️⃣  Verificando pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo "   📦 Instalando pnpm..."
    corepack enable
    corepack prepare pnpm@latest --activate
fi
echo "   ✅ pnpm $(pnpm -v)"

# 3. Instalar dependências
echo "3️⃣  Instalando dependências..."
pnpm install
echo "   ✅ Dependências instaladas"

# 4. Verificar .env
echo "4️⃣  Verificando arquivos .env..."
if [ ! -f apps/api/.env ]; then
    cp apps/api/.env.example apps/api/.env
    echo "   📝 apps/api/.env criado a partir do .env.example"
    echo "   ⚠️  PREENCHA as credenciais em apps/api/.env"
else
    echo "   ✅ apps/api/.env existe"
fi

if [ ! -f packages/database/.env ]; then
    echo "DATABASE_URL=postgresql://postgres:zappiq_dev_2026@localhost:5432/zappiq_dev" > packages/database/.env
    echo "DIRECT_URL=postgresql://postgres:zappiq_dev_2026@localhost:5432/zappiq_dev" >> packages/database/.env
    echo "   📝 packages/database/.env criado"
else
    echo "   ✅ packages/database/.env existe"
fi

# 5. Docker (PostgreSQL + Redis)
echo "5️⃣  Verificando Docker..."
if command -v docker &> /dev/null; then
    echo "   🐳 Subindo PostgreSQL e Redis..."
    docker compose -f docker-compose.yml up -d postgres redis 2>/dev/null || \
    docker-compose -f docker-compose.yml up -d postgres redis 2>/dev/null || \
    echo "   ⚠️  Não foi possível subir containers. Verifique Docker Desktop."
else
    echo "   ⚠️  Docker não encontrado. Instale PostgreSQL e Redis manualmente ou use Supabase."
fi

# 6. Gerar Prisma Client
echo "6️⃣  Gerando Prisma Client..."
cd packages/database
npx prisma generate
echo "   ✅ Prisma Client gerado"

# 7. Rodar migrations
echo "7️⃣  Rodando migrations..."
npx prisma db push --skip-generate 2>/dev/null && echo "   ✅ Schema sincronizado" || echo "   ⚠️  Falha ao sincronizar schema. Verifique DATABASE_URL."
cd ../..

# 8. Seed
echo "8️⃣  Populando banco com dados demo..."
cd packages/database
npx tsx prisma/seed.ts 2>/dev/null && echo "   ✅ Dados demo inseridos" || echo "   ⚠️  Seed falhou. Execute manualmente: cd packages/database && npx tsx prisma/seed.ts"
cd ../..

# 9. Build
echo "9️⃣  Verificando build..."
cd apps/web
npx next build > /dev/null 2>&1 && echo "   ✅ Frontend build OK" || echo "   ⚠️  Frontend build falhou"
cd ../..

echo ""
echo "  ══════════════════════════════════════════"
echo "  ✅ Setup concluído!"
echo ""
echo "  📌 Próximos passos:"
echo ""
echo "  1. Preencha apps/api/.env com suas credenciais"
echo "  2. Inicie o backend:  cd apps/api && npx tsx src/server.ts"
echo "  3. Inicie o frontend: cd apps/web && npx next dev --port 3003"
echo "  4. Acesse: http://localhost:3003"
echo ""
echo "  📱 Para configurar WhatsApp:"
echo "  ./scripts/setup-webhook.sh"
echo ""
echo "  🐳 Para rodar tudo com Docker:"
echo "  docker compose up -d"
echo "  ══════════════════════════════════════════"
echo ""
