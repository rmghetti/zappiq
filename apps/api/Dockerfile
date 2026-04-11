FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/ 2>/dev/null || true
RUN corepack enable && pnpm install --frozen-lockfile
COPY apps/api/ apps/api/
COPY packages/database/ packages/database/
COPY packages/shared/ packages/shared/ 2>/dev/null || true
RUN cd packages/database && npx prisma generate
RUN cd apps/api && npx tsc

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 appuser
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/packages/database/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/database/prisma ./prisma
USER appuser
EXPOSE 3001
CMD ["node", "dist/server.js"]
