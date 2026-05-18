# Tabley

QR-ordering SaaS for restaurants and cafes — multi-tenant, realtime, with waiter validation, kitchen and manager dashboards, delivery integration, AI menu ingestion, and POS coexistence.

## Stack

- **Monorepo** — pnpm workspaces + Turborepo
- **Backend** — NestJS 11, TypeORM, BullMQ, Better Auth, Socket.io
- **Frontend** — Next.js 15, shadcn/ui, Tailwind, next-themes, next-intl
- **Data** — PostgreSQL, Redis, Meilisearch
- **AI** — Anthropic SDK (Claude vision for menu ingestion)
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
  meilisearch/Dockerfile   # production-hardened Meilisearch image (Railway)
```

## Run locally — two modes

### Mode A: all-in-docker (no host toolchain needed)

The compose file builds the API and web from `Dockerfile.dev`, runs them with
bind-mounted source for hot reload, and pre-wires postgres / redis /
meilisearch. A one-shot `migrate` service runs all migrations + seed + the
Better Auth schema before the API starts.

```bash
cp .env.example .env
# Optional: paste your ANTHROPIC_API_KEY / RESEND_API_KEY into .env

docker compose up --build
```

Open:

- Web: http://localhost:3010
- API: http://localhost:3011 (health: http://localhost:3011/health)
- Meilisearch: http://localhost:7740

Stop with `docker compose down`. To reset volumes (Postgres, Redis,
Meilisearch data): `docker compose down -v`.

Hot reload: editing files under `apps/api/src`, `apps/web/src`, or
`packages/*/src` triggers Nest / Next watchers inside the containers
automatically. Adding a new dependency requires `docker compose build`.

### Mode B: host pnpm (fastest iteration)

If you have `pnpm` installed and prefer host-mode dev:

```bash
pnpm install
cp .env.example .env

# Only run the data services in docker
docker compose up -d postgres redis meilisearch minio

pnpm db:migrate
pnpm db:seed
cd apps/api && pnpm auth:migrate && cd ../..

pnpm dev
```

## Ports

Host ports avoid clashes with other local Docker stacks:

| Service           | Container | Host |
| ----------------- | --------- | ---- |
| Web               | 3010      | 3010 |
| API               | 3011      | 3011 |
| Postgres          | 5432      | 5440 |
| Redis             | 6379      | 6390 |
| Meilisearch       | 7700      | 7740 |
| Minio (S3 API)    | 9000      | 9080 |
| Minio (Console)   | 9001      | 9081 |

The Minio console is at http://localhost:9081 — login `minioadmin` /
`minioadmin`. The API auto-creates the `tabley-uploads` bucket on first boot
and sets a public-read policy so the browser can fetch uploaded files
directly.

## Object storage

The API talks to any S3-compatible store (Minio locally, Railway / R2 /
Tigris / AWS S3 in production) via `@aws-sdk/client-s3`. Configure via env:

```env
S3_ENDPOINT=http://minio:9000          # provider endpoint the API uses to write
S3_REGION=us-east-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=tabley-uploads
S3_PUBLIC_BASE_URL=http://localhost:9080  # browser-facing URL prefix
S3_FORCE_PATH_STYLE=true               # true for Minio, false for AWS-style hosts
```

On Railway, point `S3_ENDPOINT` at your bucket's endpoint, set
`S3_PUBLIC_BASE_URL` to your CDN domain, and flip `S3_FORCE_PATH_STYLE` based
on the provider (R2 / Tigris are path-style, vanilla AWS is virtual-hosted).

## Multi-tenancy

Row-level — every restaurant-scoped entity carries `tenant_id`. The API
enforces the tenant boundary via a `TenantMiddleware` + `TenantGuard` pair
keyed off the `x-tenant-slug` header for staff endpoints, and via the
table-token / order-id pair for public endpoints. Never trust client-supplied
tenant ids.

## Auth

Better Auth is mounted on the NestJS API at `/api/auth/*`. The Next.js app
uses `createAuthClient` against the API origin. The same session cookie is
validated for both HTTP requests (via `SessionMiddleware`) and WebSocket
connections (in `OrdersGateway`).

WebSocket clients connect in one of two modes:

- **staff**: `auth: { mode: 'staff', tenantSlug }` — joins `tenant:<id>` room
- **public** (customer): `auth: { mode: 'public', orderId, tableToken }` —
  joins `order:<id>` room and receives only updates for that order

## Common commands (host mode)

```bash
pnpm dev                              # web + api in watch mode
pnpm db:migrate                       # run pending app migrations
pnpm db:migrate:revert                # roll back the last migration
pnpm db:migrate:generate              # diff entities -> new migration file
pnpm db:seed                          # idempotent seed (demo tenant)
pnpm --filter @tabley/api auth:migrate # Better Auth schema (user/session/account)
```

In all-in-docker mode, run these inside the relevant container:

```bash
docker compose exec api pnpm db:migrate
docker compose exec api pnpm --filter @tabley/api auth:migrate
```

## Optional integrations

Add these to `.env` to enable the corresponding feature:

- `ANTHROPIC_API_KEY` — AI menu ingestion (Claude Sonnet 4.6 vision)
- `RESEND_API_KEY` + `RESEND_FROM_EMAIL` — actually send invitation emails
  (without it, invites are logged to the API console instead)
