'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SessionDetail {
  id: string;
  status: 'active' | 'closed_by_owner' | 'closed_by_staff' | 'expired';
  me: { role: 'owner' | 'member' | 'pending' } | null;
}

/**
 * QR-scan landing. Starts (or resumes) the table session, then redirects to
 * the session-scoped page. The URL on the QR sticker stays stable forever;
 * the session id is hidden in an HttpOnly cookie.
 */
export default function SessionMakerPage() {
  const { slug, token } = useParams<{ slug: string; token: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const session = await api.post<SessionDetail>('/v1/public/sessions/start', {
          slug,
          tableToken: token,
        });
        // Redirect to the session-scoped page. Role-based UI happens there.
        router.replace(`/s/${session.id}`);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [slug, token, router]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 gradient-warm">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Cannot start session</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center gradient-warm">
      <div className="flex items-center gap-3 rounded-full bg-card px-5 py-3 shadow">
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        <span className="text-sm font-medium">Opening your table…</span>
      </div>
    </main>
  );
}
