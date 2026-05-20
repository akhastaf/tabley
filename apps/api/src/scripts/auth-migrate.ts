// Run Better Auth's schema migrations programmatically.
//
// We deliberately do NOT use `@better-auth/cli` here. The published CLI mixes
// version pins for its peer dependencies and crashes at config-load time inside
// pnpm workspaces. Calling getMigrations() directly uses the same better-auth
// runtime the API already imports — no second dependency tree, no jiti, no
// surprises.
import { getMigrations } from 'better-auth/db/migration';
import { auth } from '../auth/auth';

async function main() {
  // `auth` is the configured Better Auth instance from src/auth/auth.ts.
  // It includes the admin + twoFactor plugins so their tables/columns are
  // also part of the schema diff.
  const result = await getMigrations(auth.options);
  const toCreate = result.toBeCreated ?? [];
  const toAdd = result.toBeAdded ?? [];
  if (toCreate.length === 0 && toAdd.length === 0) {
    console.log('[better-auth] schema already up to date.');
    return;
  }
  console.log(
    `[better-auth] applying ${toCreate.length} table(s) + ${toAdd.length} column-add change(s)...`,
  );
  await result.runMigrations();
  console.log('[better-auth] migrations applied.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[better-auth] migration failed:', err);
    process.exit(1);
  });
