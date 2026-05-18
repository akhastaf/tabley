# Tabley

QR-ordering SaaS for restaurants and cafes — multi-tenant, realtime, with waiter validation, kitchen and manager dashboards, delivery integration, AI menu ingestion, and POS coexistence.

## Stack

- **Monorepo** — pnpm workspaces + Turborepo
- **Backend** — NestJS 11, TypeORM, BullMQ, Better Auth, Socket.io
- **Frontend** — Next.js 15, shadcn/ui, Tailwind, next-themes, next-intl
- **Data** — PostgreSQL, Redis, Meilisearch
- **Email** — Resend
- **Deploy** — Docker locally, Railway in production

## Repo layout

```
apps/
  api/       NestJS API + WebSocket gateway + Better Auth handler
  web/       Next.js app (customer, waiter, kitchen, manager, admin)
packages/
  shared/    Zod schemas, types, enums shared by web and api
  database/  TypeORM entities, migrations, seeds
docker/
  meilisearch/Dockerfile
```

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm docker:up           # postgres, redis, meilisearch
pnpm db:migrate
pnpm db:seed             # creates SaaS admin from ADMIN_* env vars
pnpm dev                 # boots web (3000) and api (3001)
```

## Multi-tenancy

Row-level — every restaurant-scoped entity carries `tenant_id`. The API enforces the tenant boundary via a request-scoped `TenantContext` guard; never trust client-supplied tenant ids.

## Auth

Better Auth is mounted on the NestJS API at `/auth/*`. The Next.js app uses `createAuthClient` against the API origin. The same session cookie is validated for both HTTP and WebSocket connections.
