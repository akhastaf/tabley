# syntax=docker/dockerfile:1.7
# Build context must be the monorepo root. On Railway, set "Root Directory" to the repo root
# and "Dockerfile Path" to apps/web/Dockerfile.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.0.8 --activate

# ---------- prune ----------
FROM base AS prune
WORKDIR /app
RUN apk add --no-cache git
COPY . .
RUN pnpm dlx turbo@2.3.3 prune @tabley/web --docker

# ---------- deps ----------
FROM base AS deps
WORKDIR /app
# Railway's Metal builder requires cache-mount IDs to be prefixed with
# `s/<service-id>-` so caches are scoped per service. The RAILWAY_SERVICE_ID
# build arg is auto-injected on Railway; the `local` default keeps `docker
# build` working off-Railway.
ARG RAILWAY_SERVICE_ID=local
COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=s/${RAILWAY_SERVICE_ID}-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- build ----------
FROM base AS build
WORKDIR /app
COPY --from=deps /app/ .
COPY --from=prune /app/out/full/ .
RUN pnpm --filter @tabley/shared build
RUN pnpm --filter @tabley/web build

# ---------- runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
