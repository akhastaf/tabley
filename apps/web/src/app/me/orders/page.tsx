'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface OrderLine {
  id: string;
  menuItemId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  note: string | null;
}

interface MyOrder {
  id: string;
  status: string;
  totalCents: number;
  placedAt: string;
  tenant: { id: string; slug: string; name: string } | null;
  tableLabel: string | null;
  lines: OrderLine[];
}

const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: 'Pending',
  in_kitchen: 'In kitchen',
  ready: 'Ready',
  served: 'Served',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function MyOrdersPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in?next=/me/orders');
  }, [isPending, session, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.get<MyOrder[]>('/v1/me/orders');
      setOrders(list);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  function reorderHref(order: MyOrder) {
    if (!order.tenant) return null;
    // Customer needs a table token to actually place. Send them to the
    // restaurant landing where they can re-scan or use a recent token. For now
    // we direct them at the tenant page with the reorder id as a query string;
    // the public ordering page reads it once they’re scoped to a table.
    return `/r/${order.tenant.slug}?reorder=${order.id}`;
  }

  if (!session || isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your orders</h1>
          <p className="text-sm text-muted-foreground">
            Past orders across all restaurants you visited while signed in.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/onboarding"
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-accent"
          >
            Back
          </Link>
        </div>
      </header>

      {loading && orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No orders yet. Scan a QR code at a restaurant to place your first one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="text-base">
                    {o.tenant?.name ?? 'Unknown restaurant'}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      #{o.id.slice(0, 8)}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    {formatDate(o.placedAt)} ·{' '}
                    {o.tableLabel ? `Table ${o.tableLabel} · ` : ''}
                    {STATUS_LABEL[o.status] ?? o.status}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg tabular-nums">
                    {(o.totalCents / 100).toFixed(2)}
                  </p>
                  {reorderHref(o) && (
                    <Button asChild size="sm" className="mt-2">
                      <Link href={reorderHref(o)!}>Reorder</Link>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {o.lines.map((l) => (
                    <li key={l.id} className="flex justify-between">
                      <span>
                        <span className="tabular-nums">{l.quantity}×</span> {l.name}
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {((l.unitPriceCents * l.quantity) / 100).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
