'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardShell } from '@/components/dashboard-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface PeriodTotals {
  orders: number;
  paidOrders: number;
  cancelled: number;
  revenueCents: number;
  avgOrderCents: number;
}

interface Kpis {
  range: { from: string; to: string };
  compareRange: { from: string; to: string };
  current: PeriodTotals;
  previous: PeriodTotals;
  topItems: Array<{ name: string; quantity: number; revenueCents: number }>;
  byDay: Array<{ day: string; orders: number; revenueCents: number }>;
  byHour: Array<{ hour: number; orders: number }>;
  channels: Array<{ channel: string; orders: number; revenueCents: number }>;
}

type PresetKey = 'today' | '7d' | '30d' | '90d';

const PRESETS: { key: PresetKey; label: string; days: number }[] = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
];

function money(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function rangeForPreset(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (days === 1) {
    from.setHours(0, 0, 0, 0);
  } else {
    from.setDate(from.getDate() - days);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

const CHANNEL_LABEL: Record<string, string> = {
  dine_in: 'Dine-in',
  delivery: 'Delivery',
  takeaway: 'Takeaway',
};

export default function KpisPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = authClient.useSession();
  const [preset, setPreset] = useState<PresetKey>('7d');
  const [data, setData] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const days = PRESETS.find((p) => p.key === preset)!.days;
      const { from, to } = rangeForPreset(days);
      const qs = new URLSearchParams({ from, to }).toString();
      const k = await api.get<Kpis>(`/v1/manage/analytics/kpis?${qs}`, { tenantSlug: slug });
      setData(k);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug, preset]);

  useEffect(() => {
    if (!session) return;
    void load();
  }, [session, load]);

  const maxDayRevenue = useMemo(
    () => Math.max(1, ...(data?.byDay.map((d) => d.revenueCents) ?? [0])),
    [data],
  );
  const maxHourOrders = useMemo(
    () => Math.max(1, ...(data?.byHour.map((h) => h.orders) ?? [0])),
    [data],
  );

  return (
    <DashboardShell
      slug={slug}
      active="kpis"
      title="Insights"
      subtitle="Key numbers for the period, measured against the one before it."
      actions={
        <div className="flex rounded-full border border-border bg-card p-0.5 text-sm">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={cn(
                'rounded-full px-3 py-1.5 transition-colors',
                preset === p.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      }
    >
      {loading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Headline KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Revenue"
              value={money(data.current.revenueCents)}
              prefix
              delta={deltaPct(data.current.revenueCents, data.previous.revenueCents)}
            />
            <KpiCard
              label="Orders"
              value={String(data.current.orders)}
              delta={deltaPct(data.current.orders, data.previous.orders)}
            />
            <KpiCard
              label="Avg. order"
              value={money(data.current.avgOrderCents)}
              prefix
              delta={deltaPct(data.current.avgOrderCents, data.previous.avgOrderCents)}
            />
            <KpiCard
              label="Cancelled"
              value={String(data.current.cancelled)}
              delta={deltaPct(data.current.cancelled, data.previous.cancelled)}
              invertTone
            />
          </div>

          {/* Revenue by day */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Revenue by day</CardTitle>
            </CardHeader>
            <CardContent>
              {data.byDay.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No orders in this period.
                </p>
              ) : (
                <div className="flex h-48 items-end gap-1.5 overflow-x-auto">
                  {data.byDay.map((d) => (
                    <div key={d.day} className="flex min-w-7 flex-1 flex-col items-center gap-1">
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className="w-full rounded-t bg-primary/80 transition-all hover:bg-primary"
                          style={{ height: `${Math.max(2, (d.revenueCents / maxDayRevenue) * 100)}%` }}
                          title={`${d.day}: ${money(d.revenueCents)} · ${d.orders} orders`}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{d.day.slice(5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Top items */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top sellers</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topItems.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No sales yet.</p>
                ) : (
                  <ol className="space-y-2">
                    {data.topItems.map((it, i) => (
                      <li key={it.name} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                            {i + 1}
                          </span>
                          <span className="truncate">{it.name}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
                          <span className="tabular-nums">×{it.quantity}</span>
                          <span className="font-mono tabular-nums text-foreground">
                            {money(it.revenueCents)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            {/* Busiest hours */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Busiest hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-40 items-end gap-px">
                  {data.byHour.map((h) => (
                    <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className={cn(
                            'w-full rounded-t transition-all',
                            h.orders > 0 ? 'bg-primary/70' : 'bg-muted',
                          )}
                          style={{ height: `${Math.max(2, (h.orders / maxHourOrders) * 100)}%` }}
                          title={`${h.hour}:00 — ${h.orders} orders`}
                        />
                      </div>
                      {h.hour % 6 === 0 && (
                        <span className="text-[9px] text-muted-foreground">{h.hour}</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">Orders by hour of day</p>
              </CardContent>
            </Card>
          </div>

          {/* Channel split */}
          {data.channels.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">By channel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {data.channels.map((c) => (
                    <div key={c.channel} className="rounded-xl border border-border bg-background p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {CHANNEL_LABEL[c.channel] ?? c.channel}
                      </p>
                      <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                        {money(c.revenueCents)}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.orders} orders</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No data.</p>
      )}
    </DashboardShell>
  );
}

function KpiCard({
  label,
  value,
  delta,
  prefix = false,
  invertTone = false,
}: {
  label: string;
  value: string;
  delta: number | null;
  prefix?: boolean;
  invertTone?: boolean;
}) {
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;
  // For "good when up" metrics, up = green. For cancellations, up = bad (red).
  const goodUp = !invertTone;
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="flex items-end justify-between gap-2">
          <p className="font-mono text-2xl font-semibold tabular-nums leading-none">
            {prefix && <span className="mr-0.5 text-base text-muted-foreground">$</span>}
            {value}
          </p>
          {delta != null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                up && (goodUp ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'),
                down && (goodUp ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'),
                !up && !down && 'bg-muted text-muted-foreground',
              )}
            >
              {up && <ArrowUpRight className="size-3" />}
              {down && <ArrowDownRight className="size-3" />}
              {delta > 0 ? '+' : ''}
              {delta}%
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">vs previous period</p>
      </CardContent>
    </Card>
  );
}
