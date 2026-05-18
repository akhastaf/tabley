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

const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: 'Pending validation',
  in_kitchen: 'In kitchen',
  ready: 'Ready',
  served: 'Served',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

const NEXT_ACTION: Record<string, { label: string; verb: string } | undefined> = {
  pending_confirmation: { label: 'Validate & send to kitchen', verb: 'confirm' },
  in_kitchen: { label: 'Mark ready', verb: 'ready' },
  ready: { label: 'Mark served', verb: 'served' },
  served: { label: 'Mark paid', verb: 'paid' },
};

function formatPrice(c: number) {
  return (c / 100).toFixed(2);
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export default function WaiterOrdersPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending_confirmation');

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
  }, [isPending, session, router]);

  const load = useCallback(async () => {
    try {
      const list = await api.get<Order[]>(`/v1/manage/orders?status=${filter}`, { tenantSlug: slug });
      setOrders(list);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug, filter]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    void load();
  }, [session, load]);

  useOrdersRealtime(
    session ? slug : null,
    useCallback(
      (event, payload) => {
        if (event === 'waiter.called') {
          const label = (payload as { tableLabel?: string }).tableLabel;
          toast(`🔔 Table ${label ?? '?'} is calling`, { duration: 8000 });
          return;
        }
        void load();
      },
      [load],
    ),
  );

  async function act(orderId: string, verb: string) {
    try {
      await api.patch(`/v1/manage/orders/${orderId}/${verb}`, {}, { tenantSlug: slug });
      await load();
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
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Realtime via WebSocket. Validate pending orders to send to the kitchen.
          </p>
        </div>
        <ManageNav slug={slug} active="orders" />
      </header>

      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_LABEL).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={
              'rounded-md border px-3 py-1.5 text-sm transition-colors ' +
              (filter === key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-accent')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {loading && orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No orders in this state.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const action = NEXT_ACTION[o.status];
            return (
              <Card key={o.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span>{o.tableLabel ? `Table ${o.tableLabel}` : 'Takeaway'}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        #{o.id.slice(0, 8)}
                      </span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(o.placedAt)} · {STATUS_LABEL[o.status] ?? o.status}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="font-mono text-lg tabular-nums">{formatPrice(o.totalCents)}</p>
                    <div className="flex gap-2">
                      {action && (
                        <Button size="sm" onClick={() => act(o.id, action.verb)}>
                          {action.label}
                        </Button>
                      )}
                      {o.status !== 'paid' && o.status !== 'cancelled' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => act(o.id, 'cancel')}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {o.lines.map((l) => (
                      <li key={l.id} className="flex justify-between">
                        <span>
                          <span className="tabular-nums">{l.quantity}×</span> {l.name}
                          {l.note && <span className="ml-2 text-muted-foreground">— {l.note}</span>}
                        </span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {formatPrice(l.unitPriceCents * l.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {o.customerNote && (
                    <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                      Customer note: {o.customerNote}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
