'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { useOrdersRealtime } from '@/lib/realtime';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardShell } from '@/components/dashboard-shell';
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

function money(cents: number): string {
  return (cents / 100).toFixed(2);
}

function channelLabel(channel: string, tableLabel: string | null): string {
  if (channel === 'delivery') return 'Delivery';
  if (channel === 'takeaway') return 'Takeaway';
  return tableLabel ? `Table ${tableLabel}` : 'Dine-in';
}

/** Group collectible orders by their table/channel so a cashier closing out a
 *  table sees one bill, not scattered tickets. */
interface Bucket {
  key: string;
  label: string;
  orders: Order[];
  totalCents: number;
}

function bucketize(orders: Order[]): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const o of orders) {
    const key = o.tableLabel ? `t:${o.tableLabel}` : o.channel === 'delivery' ? 'delivery' : `o:${o.id}`;
    const label = channelLabel(o.channel, o.tableLabel);
    const b = map.get(key) ?? { key, label, orders: [], totalCents: 0 };
    b.orders.push(o);
    b.totalCents += o.totalCents;
    map.set(key, b);
  }
  return Array.from(map.values());
}

export default function CashierPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = authClient.useSession();
  const [toCollect, setToCollect] = useState<Order[]>([]);
  const [paidToday, setPaidToday] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [served, paid] = await Promise.all([
        api.get<Order[]>('/v1/manage/orders?status=served', { tenantSlug: slug }),
        api.get<Order[]>('/v1/manage/orders?status=paid', { tenantSlug: slug }),
      ]);
      setToCollect(served);
      // Only keep today's paid orders for the "collected" tally.
      const startToday = new Date();
      startToday.setHours(0, 0, 0, 0);
      setPaidToday(paid.filter((o) => new Date(o.placedAt) >= startToday));
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

  async function markPaid(orderId: string) {
    setBusy(orderId);
    try {
      await api.patch(`/v1/manage/orders/${orderId}/paid`, {}, { tenantSlug: slug });
      toast.success('Marked paid');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function payTable(bucket: Bucket) {
    setBusy(bucket.key);
    try {
      await api.patch(
        '/v1/manage/orders/pay-batch',
        { ids: bucket.orders.map((o) => o.id) },
        { tenantSlug: slug },
      );
      toast.success(`${bucket.label} settled · ${money(bucket.totalCents)}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const buckets = bucketize(toCollect);
  const outstandingCents = toCollect.reduce((s, o) => s + o.totalCents, 0);
  const collectedCents = paidToday.reduce((s, o) => s + o.totalCents, 0);

  return (
    <DashboardShell
      slug={slug}
      active="cashier"
      title="Cashier"
      subtitle="Collect payment on served orders. No POS required."
      actions={
        <div className="flex gap-2">
          <SummaryPill label="To collect" value={money(outstandingCents)} tone="amber" />
          <SummaryPill label="Collected today" value={money(collectedCents)} tone="emerald" />
        </div>
      }
    >
      {loading && toCollect.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : buckets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CheckCircle2 className="size-8 text-emerald-500" />
            <p className="text-sm font-medium">All settled up</p>
            <p className="text-xs text-muted-foreground">
              Served orders waiting on payment will show up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {buckets.map((b) => {
            const multi = b.orders.length > 1;
            const isTable = b.key.startsWith('t:');
            return (
              <Card key={b.key} className="flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-base">{b.label}</CardTitle>
                  <span className="font-mono text-lg font-semibold tabular-nums">{money(b.totalCents)}</span>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="space-y-3">
                    {b.orders.map((o) => (
                      <div key={o.id} className="rounded-xl border border-border bg-background p-3">
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>#{o.id.slice(0, 6)}</span>
                          <span className="font-mono tabular-nums text-foreground">{money(o.totalCents)}</span>
                        </div>
                        <ul className="space-y-0.5 text-sm">
                          {o.lines.map((l) => (
                            <li key={l.id} className="flex justify-between gap-3">
                              <span className="truncate">
                                {l.quantity} × {l.name}
                              </span>
                              <span className="font-mono tabular-nums text-muted-foreground">
                                {money(l.unitPriceCents * l.quantity)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <Button
                          size="sm"
                          variant={multi ? 'outline' : 'default'}
                          className="mt-3 w-full rounded-full"
                          disabled={busy !== null}
                          onClick={() => markPaid(o.id)}
                        >
                          {busy === o.id
                            ? 'Saving…'
                            : `${multi ? 'Pay this order' : 'Mark paid'} · ${money(o.totalCents)}`}
                        </Button>
                      </div>
                    ))}
                  </div>
                  {multi && (
                    <Button
                      className="mt-auto w-full rounded-full"
                      disabled={busy !== null}
                      onClick={() => payTable(b)}
                    >
                      {busy === b.key
                        ? 'Saving…'
                        : `Pay whole ${isTable ? 'table' : 'bill'} · ${money(b.totalCents)}`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'amber' | 'emerald';
}) {
  return (
    <div
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs',
        tone === 'amber' ? 'border-amber-300/60 bg-amber-50/60' : 'border-emerald-300/60 bg-emerald-50/60',
      )}
    >
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-mono font-semibold tabular-nums">{value}</span>
    </div>
  );
}
