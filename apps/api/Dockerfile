# syntax=docker/dockerfile:1.7
# ZappIQ API - multi-stage Dockerfile (pnpm workspaces + turbo prune)
#
# Build context MUST be the monorepo root (zappiq/), not apps/api.
#   docker build -f apps/api/Dockerfile -t zappiq-api .

ARG NODE_VERSION=20.18.1
ARG ALPINE_VERSION=3.20
ARG PNPM_VERSION=9.15.0

# --- Stage 1: pruner ---
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /repo
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
COPY . .
RUN pnpm dlx turbo@2.4.0 prune @zappiq/api --docker

# --- Stage 2: installer ---
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS installer
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Lockfile + workspace manifests
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Source code
COPY --from=pruner /repo/out/full/ ./

# Root-level config not included by turbo prune --docker
COPY --from=pruner /repo/tsconfig.base.json ./tsconfig.base.json

# Build everything in topological order via Turbo
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1
RUN pnpm dlx turbo@2.4.0 run build --filter=@zappiq/api

# --- Stage 3: deployer ---
FROM installer AS deployer
WORKDIR /repo
RUN pnpm --filter=@zappiq/api deploy --prod /deploy

# Prisma: find and copy generated client + query engine into deploy tree
# pnpm deploy --prod does NOT include the generated .prisma/ directory
RUN set -e && \
    echo "=== Searching for generated .prisma/client ===" && \
    FOUND="" && \
    for candidate in \
      "/repo/node_modules/.prisma/client" \
      "/repo/packages/database/node_modules/.prisma/client" \
    ; do \
      if [ -d "$candidate" ] && [ -f "$candidate/index.js" ]; then \
        FOUND="$candidate"; break; \
      fi; \
    done && \
    if [ -z "$FOUND" ]; then \
      FOUND=$(find /repo -path "*/.prisma/client/index.js" -not -path "*/deploy/*" 2>/dev/null | head -1 | sed 's|/index.js$||'); \
    fi && \
    if [ -z "$FOUND" ]; then \
      echo "ERROR: Generated .prisma/client not found! Running prisma generate..." && \
      SCHEMA=$(find /repo -name "schema.prisma" -path "*/prisma/*" | head -1) && \
      cd /repo && npx prisma generate --schema="$SCHEMA" && \
      FOUND=$(find /repo -path "*/.prisma/client/index.js" -not -path "*/deploy/*" 2>/dev/null | head -1 | sed 's|/index.js$||'); \
    fi && \
    echo "Using .prisma/client from: $FOUND" && \
    mkdir -p /deploy/node_modules/.prisma && \
    cp -r "$FOUND" /deploy/node_modules/.prisma/client && \
    echo "=== Prisma client files copied ===" && \
    ls /deploy/node_modules/.prisma/client/ | head -20

# --- Stage 4: runner ---
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runner
RUN apk add --no-cache libc6-compat openssl tini wget \
 && addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs appuser

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0

COPY --from=deployer --chown=appuser:nodejs /deploy ./

USER appuser
EXPOSE 3001

ENTRYPOINT ["/sbin/tini", "--"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

CMD ["node", "dist/server.js"]
