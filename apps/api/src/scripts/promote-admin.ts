// Promote an existing user to platform admin. Usage:
//   pnpm --filter @tabley/api admin:promote -- user@example.com
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: admin:promote -- <email>');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query<{ id: string; email: string; role: string | null }>(
    'UPDATE "user" SET role = $1 WHERE lower(email) = lower($2) RETURNING id, email, role',
    ['admin', email],
  );
  if (res.rowCount === 0) {
    console.error(`No user with email ${email}. Have them sign up first.`);
    await pool.end();
    process.exit(1);
  }
  const u = res.rows[0]!;
  console.log(`Promoted ${u.email} (${u.id}) to role=${u.role}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
