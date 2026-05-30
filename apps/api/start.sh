#!/bin/sh
# Container entrypoint for the API service.
#
# Runs both migration sets before starting the server so a fresh database
# (e.g. a new Railway Postgres add-on) self-heals on first boot, and so
# subsequent deploys auto-apply any new migrations without a manual step.
#
#   1. TypeORM migrations  → creates the app schema (tenants, menu_items,
#      orders, tables, etc.). Reads `packages/database/dist/data-source.js`.
#   2. Better Auth migrations → creates the auth schema (user, session,
#      account, verification, twoFactor) via better-auth's getMigrations().
#      Lives at `apps/api/dist/scripts/auth-migrate.js`.
#   3. `exec node apps/api/dist/main.js` → replaces the shell so Node
#      receives SIGTERM / SIGINT directly on container stop.
#
# Both migration commands are idempotent — they no-op when the schema is
# already current — so it is safe to run them on every container start.

set -e

echo "[start] Running TypeORM migrations…"
# pnpm hoists the typeorm binary under packages/database, not the workspace
# root, so we delegate via pnpm --filter rather than calling node_modules/.bin
# directly. `dist/data-source.js` is produced by `pnpm --filter @tabley/database
# build` during the image build.
pnpm --filter @tabley/database exec typeorm migration:run -d dist/data-source.js

echo "[start] Running Better Auth migrations…"
node apps/api/dist/scripts/auth-migrate.js

echo "[start] Migrations done. Booting API…"
exec node apps/api/dist/main.js
