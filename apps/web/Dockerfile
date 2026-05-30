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
# like tsconfig.base.json (it isn't tracked by any package). The workspace
# tsconfigs `extend` from ../../tsconfig.base.json, so we copy it explicitly
# from the prune stage (which has the full repo at /app/).
COPY --from=prune /app/tsconfig.base.json ./tsconfig.base.json

# Next.js inlines every `process.env.NEXT_PUBLIC_*` reference at `next build`
# time, so these URLs MUST be present in the build environment. Railway
# exposes service env vars as build args to BuildKit, but they only become
# available to RUN commands when we explicitly declare them as ARG here and
# re-export them as ENV. Without this, NEXT_PUBLIC_API_URL would silently
# fall back to the dev default `http://localhost:3011` and ship in the JS
# bundle to every browser.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

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
