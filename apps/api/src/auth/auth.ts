import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  trustedOrigins: (process.env.API_CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim()),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      avatarUrl: { type: 'string', required: false },
      locale: { type: 'string', required: false, defaultValue: 'en' },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
