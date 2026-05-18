'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface InviteLookup {
  valid: boolean;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  email: string;
  role: string;
  expiresAt: string;
  tenant: { slug: string; name: string } | null;
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const { data: session, isPending } = authClient.useSession();
  const [lookup, setLookup] = useState<InviteLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    api
      .get<InviteLookup>(`/v1/invitations/${token}`)
      .then(setLookup)
      .catch((err: Error) => setError(err.message));
  }, [token]);

  const accept = useCallback(async () => {
    setAccepting(true);
    try {
      const res = await api.post<{ tenantSlug: string; role: string }>(
        `/v1/invitations/${token}/accept`,
        {},
      );
      toast.success(`You joined as ${res.role}`);
      router.replace(`/manage/${res.tenantSlug}/menu`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAccepting(false);
    }
  }, [token, router]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Invitation not found</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!lookup) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading invitation…</p>
      </main>
    );
  }

  if (!lookup.valid) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>This invitation is no longer valid</CardTitle>
            <CardDescription>Status: {lookup.status}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ask {lookup.tenant?.name ?? 'the restaurant'} to send a fresh invite.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const signedInWithCorrectEmail =
    session?.user?.email?.toLowerCase() === lookup.email.toLowerCase();
  const signedInWithWrongEmail = !!session?.user && !signedInWithCorrectEmail;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join {lookup.tenant?.name ?? 'this restaurant'}</CardTitle>
          <CardDescription>
            You&apos;ve been invited to <strong>{lookup.tenant?.name}</strong> as{' '}
            <strong>{lookup.role}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            Invited email: <span className="font-mono">{lookup.email}</span>
          </div>

          {isPending ? (
            <p className="text-sm text-muted-foreground">Checking your session…</p>
          ) : signedInWithCorrectEmail ? (
            <Button className="w-full" onClick={accept} disabled={accepting}>
              {accepting ? 'Joining…' : 'Accept invitation'}
            </Button>
          ) : signedInWithWrongEmail ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                You&apos;re signed in as <span className="font-mono">{session?.user?.email}</span>{' '}
                but this invitation is for <span className="font-mono">{lookup.email}</span>.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  await authClient.signOut();
                  router.refresh();
                }}
              >
                Sign out
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Sign in (or create an account) with the email above to accept.
              </p>
              <div className="flex gap-2">
                <Link
                  href={`/sign-in?next=/invite/${token}`}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-accent"
                >
                  Sign in
                </Link>
                <Link
                  href={`/sign-up?next=/invite/${token}`}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
                >
                  Create account
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
