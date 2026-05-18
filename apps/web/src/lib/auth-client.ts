import { createAuthClient } from 'better-auth/react';
import { adminClient, twoFactorClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3011'}/api/auth`,
  plugins: [
    adminClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        if (typeof window !== 'undefined') {
          window.location.href = '/sign-in/two-factor';
        }
      },
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
