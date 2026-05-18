'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminNav } from '@/components/admin-nav';

interface Stats {
  tenants: number;
  activeTenants: number;
  users: number;
  members: number;
  orders: number;
  menuItems: number;
}

export default function AdminOverview() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
    if (session && session.user.role !== 'admin') router.replace('/onboarding');
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session || session.user.role !== 'admin') return;
    api
      .get<Stats>('/v1/admin/stats')
      .then(setStats)
      .catch((err: Error) => {
        setError(err.message);
        toast.error(err.message);
      });
  }, [session]);

  if (!session || session.user.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const tiles: { label: string; value: number | string; hint?: string }[] = stats
    ? [
        { label: 'Tenants', value: stats.tenants, hint: `${stats.activeTenants} active` },
        { label: 'Users', value: stats.users },
        { label: 'Memberships', value: stats.members },
        { label: 'Orders', value: stats.orders },
        { label: 'Menu items', value: stats.menuItems },
      ]
    : [];

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Tabley admin</p>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        </div>
        <AdminNav active="overview" />
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-3xl tabular-nums">{t.value}</p>
              {t.hint && <p className="text-xs text-muted-foreground">{t.hint}</p>}
            </CardContent>
          </Card>
        ))}
        {!stats && <p className="text-sm text-muted-foreground">Loading stats…</p>}
      </div>
    </div>
  );
}
