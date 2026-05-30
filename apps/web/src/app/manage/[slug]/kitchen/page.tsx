'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { useOrdersRealtime } from '@/lib/realtime';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardShell } from '@/components/dashboard-shell';
import { StatusPill } from '@/components/status-pill';
import { cn } from '@/lib/utils';

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

/** Older tickets glow amber/red as they age — a visible "hurry" cue. */
function urgencyTint(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 5 * 60) return 'border-l-status-kitchen';
  if (s < 10 * 60) return 'border-l-status-pending';
  return 'border-l-destructive';
}

function channelStripe(channel: string) {
  if (channel === 'delivery') return 'bg-channel-delivery';
  if (channel === 'takeaway') return 'bg-channel-takeaway';
  return 'bg-channel-dine-in';
}

function channelLabel(channel: string, tableLabel: string | null) {
  if (channel === 'delivery') return '🛵 Delivery';
  if (channel === 'takeaway') return 'Takeaway';
  return tableLabel ? `Table ${tableLabel}` : 'Dine-in';
}

export default function KitchenPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = authClient.useSession();
  const [inKitchen, setInKitchen] = useState<Order[]>([]);
  const [ready, setReady] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

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
        if (event === 'waiter.called' || event === 'session.started') return;
        void load();
      },
      [load],
    ),
  );

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

  return (
    <DashboardShell
      slug={slug}
      active="kitchen"
      title="Kitchen"
      subtitle="Validated orders. Mark each ready when it leaves the pass."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Column
          title="In kitchen"
          count={inKitchen.length}
          countTone="primary"
          loading={loading}
          empty="No active tickets."
        >
          {inKitchen.map((o) => (
            <KitchenTicket key={o.id} order={o} tick={tick} onReady={() => markReady(o.id)} />
          ))}
        </Column>

        <Column
          title="Ready for pickup"
          count={ready.length}
          countTone="ready"
          loading={false}
          empty="Nothing waiting."
        >
          {ready.map((o) => (
            <KitchenTicket key={o.id} order={o} tick={tick} dimmed />
          ))}
        </Column>
      </div>
    </DashboardShell>
  );
}

function Column({
  title,
  count,
  countTone,
  loading,
  empty,
  children,
}: {
  title: string;
  count: number;
  countTone: 'primary' | 'ready';
  loading: boolean;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-[20rem] flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-3">
      <header className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
            countTone === 'primary'
              ? 'bg-primary text-primary-foreground'
              : 'bg-status-ready/20 text-status-ready-fg',
          )}
        >
          {count}
        </span>
      </header>
      {loading && count === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">Loading…</p>
      ) : count === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}

function KitchenTicket({
  order,
  tick: _tick,
  onReady,
  dimmed = false,
}: {
  order: Order;
  tick: number;
  onReady?: () => void;
  dimmed?: boolean;
}) {
  const STATUS_LABEL: Record<string, string> = {
    pending_confirmation: 'Pending',
    in_kitchen: 'In kitchen',
    ready: 'Ready',
    served: 'Served',
    paid: 'Paid',
    cancelled: 'Cancelled',
  };
  return (
    <Card
      className={cn(
        'overflow-hidden border-l-4 transition-all',
        onReady ? urgencyTint(order.placedAt) : 'border-l-status-ready',
        dimmed && 'opacity-90',
      )}
    >
      <div className={cn('h-1 w-full', channelStripe(order.channel))} aria-hidden />
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base leading-tight">
            {channelLabel(order.channel, order.tableLabel)}{' '}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              #{order.id.slice(0, 6)}
            </span>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={order.status} label={STATUS_LABEL[order.status] ?? order.status} size="sm" />
            <span className="text-xs text-muted-foreground">{timeSince(order.placedAt)} elapsed</span>
          </div>
        </div>
        {onReady && (
          <Button size="sm" onClick={onReady} className="rounded-full">
            Mark ready
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm">
          {order.lines.map((l) => (
            <li key={l.id} className="flex items-baseline justify-between gap-3">
              <span className="leading-tight">
                <span className="mr-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1 text-xs font-semibold tabular-nums text-primary">
                  {l.quantity}
                </span>
                {l.name}
              </span>
              {l.note && <span className="shrink-0 text-xs italic text-muted-foreground">— {l.note}</span>}
            </li>
          ))}
        </ul>
        {order.customerNote && (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-100">
            <span className="font-medium">Note:</span> {order.customerNote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
