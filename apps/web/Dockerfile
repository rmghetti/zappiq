# syntax=docker/dockerfile:1.7
# ──────────────────────────────────────────────────────────────────
# ZappIQ Web (Next.js 14) — multi-stage Dockerfile using turbo prune
# Build context MUST be the monorepo root (zappiq/).
# Build:  docker build -f apps/web/Dockerfile -t zappiq-web .
# ──────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20.18.1
ARG ALPINE_VERSION=3.20

# ─── Stage 1: pruner ──────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /repo
COPY . .
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate \
 && pnpm dlx turbo@2.4.0 prune @zappiq/web --docker

# ─── Stage 2: installer ───────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=pruner /repo/out/full/ ./

# Build-time public env vars (Next.js inlines them at compile time).
# These MUST be passed via `--build-arg` or via the cloud provider's build env.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_WS_URL=http://localhost:3001
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_APP_NAME=ZappIQ
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @zappiq/web build

# ─── Stage 3: runner ──────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runner
RUN apk add --no-cache libc6-compat tini \
 && addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Next.js standalone output gives us a self-contained server.js + minimal node_modules.
COPY --from=installer --chown=nextjs:nodejs /repo/apps/web/public ./public
COPY --from=installer --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/ || exit 1

# The standalone server lives at apps/web/server.js inside the standalone bundle.
CMD ["node", "apps/web/server.js"]
