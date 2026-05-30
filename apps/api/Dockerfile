# syntax=docker/dockerfile:1.7
# Build context must be the monorepo root. On Railway, set "Root Directory" to the repo root
# and "Dockerfile Path" to apps/api/Dockerfile.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.0.8 --activate

# ---------- prune ----------
FROM base AS prune
WORKDIR /app
RUN apk add --no-cache git
RUN pnpm dlx turbo@2.3.3 --version
COPY . .
RUN pnpm dlx turbo@2.3.3 prune @tabley/api --docker

# ---------- deps ----------
FROM base AS deps
WORKDIR /app
# Note: we don't use a BuildKit cache mount for the pnpm store. Railway's
# Metal builder requires cache-mount IDs to literally start with the service
# UUID (`s/<uuid>-…`), so any `${RAILWAY_SERVICE_ID}` ARG-based form is
# rejected at validation time. The cleanest portable choice is to skip the
# cache and re-resolve dependencies on every build; install is ~30s cold and
# layer caching still helps when package.jsons don't change.
COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ---------- build ----------
FROM base AS build
WORKDIR /app
COPY --from=deps /app/ .
COPY --from=prune /app/out/full/ .
# turbo prune produces /app/out/full/ but does NOT include root-level config
# like tsconfig.base.json (it isn't tracked by any package). All three
# workspace tsconfigs `extend` from ../../tsconfig.base.json, so we copy it
# explicitly from the prune stage (which has the full repo at /app/).
COPY --from=prune /app/tsconfig.base.json ./tsconfig.base.json
RUN pnpm --filter @tabley/shared build && pnpm --filter @tabley/database build
RUN pnpm --filter @tabley/api build

# ---------- runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.0.8 --activate
RUN addgroup -g 1001 -S nodejs && adduser -S tabley -u 1001 -G nodejs

COPY --from=build --chown=tabley:nodejs /app/ .

USER tabley
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
