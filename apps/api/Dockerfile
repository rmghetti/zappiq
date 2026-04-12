# syntax=docker/dockerfile:1.7
# ──────────────────────────────────────────────────────────────────
# ZappIQ API — multi-stage Dockerfile (pnpm workspaces + turbo prune)
#
# Build context MUST be the monorepo root (zappiq/), not apps/api.
# docker build -t zappiq-api .
#
# Stages:
# 1) pruner → turbo prune → minimal subtree for @zappiq/api
# 2) installer → pnpm install + turbo build → JS in dist/
# 3) deployer → pnpm deploy → self-contained production tree
# 4) runner → minimal Alpine + tini + production tree
# ──────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20.18.1
ARG ALPINE_VERSION=3.20
ARG PNPM_VERSION=9.15.0

# ─── Stage 1: pruner ──────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /repo
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
COPY . .
RUN pnpm dlx turbo@2.4.0 prune @zappiq/api --docker

# ─── Stage 2: installer ───────────────────────────────────────────
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

# Build everything in topological order via Turbo:
# packages/database (prisma generate + tsc)
# packages/shared (tsc)
# apps/api (tsc)
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1
RUN pnpm dlx turbo@2.4.0 run build --filter=@zappiq/api

# ─── Stage 3: deployer ────────────────────────────────────────────
# `pnpm deploy` produces a self-contained tree under /deploy with:
# - dist/ from the api
# - production-only node_modules (no symlinks, hoisted)
# - workspace packages physically copied (not linked)
FROM installer AS deployer
WORKDIR /repo
RUN pnpm --filter=@zappiq/api deploy --prod /deploy

# ─── Stage 4: runner ──────────────────────────────────────────────
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

    # tini → proper PID 1 / signal handling for graceful shutdown
    ENTRYPOINT ["/sbin/tini", "--"]

    HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
     CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

     CMD ["node", "dist/server.js"]
