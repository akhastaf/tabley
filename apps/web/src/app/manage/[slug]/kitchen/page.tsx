'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { useOrdersRealtime } from '@/lib/realtime';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManageNav } from '@/components/manage-nav';

interface OrderLine {
  id: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  note: string | null;
}

interface Order {
  id: string;
  status: string;
  channel: string;
  totalCents: number;
  customerNote: string | null;
  placedAt: string;
  tableLabel: string | null;
  lines: OrderLine[];
}

function timeSince(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h`;
}

export default function KitchenPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [inKitchen, setInKitchen] = useState<Order[]>([]);
  const [ready, setReady] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
  }, [isPending, session, router]);

  const load = useCallback(async () => {
    try {
      const [k, r] = await Promise.all([
        api.get<Order[]>('/v1/manage/orders?status=in_kitchen', { tenantSlug: slug }),
        api.get<Order[]>('/v1/manage/orders?status=ready', { tenantSlug: slug }),
      ]);
      setInKitchen(k);
      setReady(r);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!session) return;
    void load();
  }, [session, load]);

  useOrdersRealtime(
    session ? slug : null,
    useCallback(
      (event) => {
        if (event === 'waiter.called') return; // Waiter dashboard handles this.
        void load();
      },
      [load],
    ),
  );

  // Force re-render every second so "time since" stays fresh.
  useEffect(() => {
    const i = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, []);

  async function markReady(orderId: string) {
    try {
      await api.patch(`/v1/manage/orders/${orderId}/ready`, {}, { tenantSlug: slug });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (isPending || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kitchen</h1>
          <p className="text-sm text-muted-foreground">
            Validated orders. Mark each ready when it leaves the pass.
          </p>
        </div>
        <ManageNav slug={slug} active="kitchen" />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight">
            In kitchen
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {inKitchen.length}
            </span>
          </h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : inKitchen.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active tickets.</p>
          ) : (
            <div className="space-y-3">
              {inKitchen.map((o) => (
                <KitchenTicket
                  key={o.id}
                  order={o}
                  tick={tick}
                  onReady={() => markReady(o.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight">
            Ready for pickup
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              {ready.length}
            </span>
          </h2>
          {ready.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing waiting.</p>
          ) : (
            <div className="space-y-3">
              {ready.map((o) => (
                <KitchenTicket key={o.id} order={o} tick={tick} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function KitchenTicket({
  order,
  tick: _tick,
  onReady,
}: {
  order: Order;
  tick: number;
  onReady?: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-base">
            {order.tableLabel ? `Table ${order.tableLabel}` : 'Takeaway'}{' '}
            <span className="text-xs font-normal text-muted-foreground">
              #{order.id.slice(0, 6)}
            </span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">{timeSince(order.placedAt)} elapsed</p>
        </div>
        {onReady && (
          <Button size="sm" onClick={onReady}>
            Mark ready
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm">
          {order.lines.map((l) => (
            <li key={l.id} className="flex justify-between">
              <span>
                <span className="tabular-nums">{l.quantity}×</span> {l.name}
              </span>
              {l.note && <span className="text-xs text-muted-foreground">{l.note}</span>}
            </li>
          ))}
        </ul>
        {order.customerNote && (
          <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs">
            <span className="font-medium">Note:</span> {order.customerNote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
