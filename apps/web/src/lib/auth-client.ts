import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3011'}/api/auth`,
  plugins: [adminClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
