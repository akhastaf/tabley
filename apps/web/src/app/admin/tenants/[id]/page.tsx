'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminNav } from '@/components/admin-nav';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
  isActive: boolean;
  deliveryEnabled: boolean;
  createdAt: string;
  defaultLocale: string;
}
interface Member {
  id: string;
  userId: string;
  role: string;
  invitedEmail: string | null;
  createdAt: string;
}
interface Detail {
  tenant: Tenant;
  members: Member[];
}

export default function AdminTenantDetail() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: session, isPending } = authClient.useSession();
  const [data, setData] = useState<Detail | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
    if (session && session.user.role !== 'admin') router.replace('/onboarding');
  }, [isPending, session, router]);

  const load = useCallback(async () => {
    try {
      const detail = await api.get<Detail>(`/v1/admin/tenants/${id}`);
      setData(detail);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [id]);

  useEffect(() => {
    if (session?.user.role === 'admin') void load();
  }, [session, load]);

  async function patch(body: Partial<Tenant>) {
    try {
      await api.patch(`/v1/admin/tenants/${id}`, body);
      toast.success('Updated');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (!data || !session || session.user.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const t = data.tenant;

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/tenants" className="text-xs text-muted-foreground hover:underline">
            ← back to tenants
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t.name}</h1>
          <p className="font-mono text-xs text-muted-foreground">/{t.slug}</p>
        </div>
        <AdminNav active="tenants" />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Tenant settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan</p>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={t.plan}
                onChange={(e) => void patch({ plan: e.target.value })}
              >
                {['free', 'starter', 'growth', 'enterprise'].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
              <Button
                variant={t.isActive ? 'outline' : 'default'}
                onClick={() => void patch({ isActive: !t.isActive })}
                className="mt-1 w-full"
              >
                {t.isActive ? 'Disable tenant' : 'Re-enable tenant'}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Delivery</span>
            <Button
              size="sm"
              variant={t.deliveryEnabled ? 'default' : 'outline'}
              onClick={() => void patch({ deliveryEnabled: !t.deliveryEnabled })}
            >
              {t.deliveryEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Created {new Date(t.createdAt).toLocaleString()}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members ({data.members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{m.invitedEmail ?? m.userId.slice(0, 12)}</p>
                <p className="text-xs text-muted-foreground">
                  joined {new Date(m.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{m.role}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
