import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { betterAuth } from 'better-auth';
import { admin, twoFactor } from 'better-auth/plugins';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// On Railway (and any prod setup where the web + API live on different
// origins), the session cookie has to be cross-site to ride along with the
// browser's CORS requests. We can't tell from inside the API whether we're
// behind HTTPS at the edge, so we treat any non-`localhost` BETTER_AUTH_URL
// as "production" and opt into the cross-site cookie attributes.
const isProd =
  !!process.env.BETTER_AUTH_URL && !process.env.BETTER_AUTH_URL.includes('localhost');

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3011',
  trustedOrigins: (process.env.API_CORS_ORIGIN ?? 'http://localhost:3010')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  // Cookie defaults are tuned for cross-site usage in prod (different
  // sub-domains on Railway = different sites because `*.up.railway.app` is
  // on the Public Suffix List). In dev (localhost) we fall back to Lax so
  // the cookie still persists across `localhost:3010` ↔ `localhost:3011`.
  advanced: {
    defaultCookieAttributes: isProd
      ? { sameSite: 'none', secure: true, httpOnly: true }
      : { sameSite: 'lax', secure: false, httpOnly: true },
  },
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
  plugins: [
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
      impersonationSessionDuration: 60 * 60, // 1 hour
    }),
    twoFactor({
      issuer: 'Tabley',
    }),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
