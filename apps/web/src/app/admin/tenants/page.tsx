'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AdminNav } from '@/components/admin-nav';

interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  plan: string;
  isActive: boolean;
  deliveryEnabled: boolean;
  members: number;
  menuItems: number;
  orders: number;
  createdAt: string;
}

export default function AdminTenantsPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
    if (session && session.user.role !== 'admin') router.replace('/onboarding');
  }, [isPending, session, router]);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const list = await api.get<TenantSummary[]>(
        `/v1/admin/tenants${query ? `?q=${encodeURIComponent(query)}` : ''}`,
      );
      setTenants(list);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user.role === 'admin') void load('');
  }, [session, load]);

  useEffect(() => {
    if (!session) return;
    const t = setTimeout(() => void load(q), 250);
    return () => clearTimeout(t);
  }, [q, session, load]);

  if (!session || session.user.role !== 'admin') return null;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Tabley admin</p>
          <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
        </div>
        <AdminNav active="tenants" />
      </header>

      <Input
        placeholder="Search by name or slug…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {loading && tenants.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tenants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tenants found.</p>
      ) : (
        <div className="space-y-2">
          {tenants.map((t) => (
            <Link
              key={t.id}
              href={`/admin/tenants/${t.id}`}
              className="block rounded-md border border-border bg-card px-4 py-3 transition-colors hover:bg-accent"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{t.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">/{t.slug}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>plan: <strong>{t.plan}</strong></span>
                  <span>members: <strong>{t.members}</strong></span>
                  <span>items: <strong>{t.menuItems}</strong></span>
                  <span>orders: <strong>{t.orders}</strong></span>
                  <span
                    className={
                      'rounded-full px-2 py-0.5 ' +
                      (t.isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-destructive/10 text-destructive')
                    }
                  >
                    {t.isActive ? 'active' : 'disabled'}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
