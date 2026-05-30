'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  ChefHat,
  CreditCard,
  ReceiptText,
  Sofa,
  Users,
} from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { useOrdersRealtime } from '@/lib/realtime';
import { Card, CardContent } from '@/components/ui/card';
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

interface Overview {
  now: string;
  live: {
    activeSessions: number;
    activeTables: number;
    openOrders: number;
    openByStatus: Record<string, number>;
    pendingConfirmation: number;
    inKitchen: number;
    readyForPickup: number;
    openOrderTotalCents: number;
  };
  today: PeriodTotals;
  yesterday: PeriodTotals;
}

function money(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export default function OverviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = authClient.useSession();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const o = await api.get<Overview>('/v1/manage/analytics/overview', { tenantSlug: slug });
      setData(o);
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

  // Any tenant-room event (order, waiter call, table opened/closed) can move
  // these numbers — just reload the snapshot. It's a single cheap query.
  useOrdersRealtime(
    session ? slug : null,
    useCallback(() => void load(), [load]),
  );

  return (
    <DashboardShell
      slug={slug}
      active="overview"
      title="Overview"
      subtitle="A live read on the floor and how today is tracking."
    >
      {loading && !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : data ? (
        <div className="space-y-8">
          {/* Right now */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Right now
            </h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <LiveStat
                href={`/manage/${slug}/floor`}
                icon={<Sofa className="size-4" />}
                label="Active tables"
                value={`${data.live.activeSessions}/${data.live.activeTables}`}
                hint="seated / total"
              />
              <LiveStat
                href={`/manage/${slug}/orders`}
                icon={<ReceiptText className="size-4" />}
                label="Open orders"
                value={data.live.openOrders}
                hint={`${money(data.live.openOrderTotalCents)} in play`}
                tone={data.live.pendingConfirmation > 0 ? 'amber' : 'default'}
              />
              <LiveStat
                href={`/manage/${slug}/kitchen`}
                icon={<ChefHat className="size-4" />}
                label="In kitchen"
                value={data.live.inKitchen}
                hint={`${data.live.readyForPickup} ready to serve`}
              />
              <LiveStat
                href={`/manage/${slug}/orders`}
                icon={<BellRing className="size-4" />}
                label="Awaiting confirm"
                value={data.live.pendingConfirmation}
                hint="needs a waiter"
                tone={data.live.pendingConfirmation > 0 ? 'amber' : 'default'}
              />
            </div>
          </section>

          {/* Today vs yesterday */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Today so far
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <TrendStat
                icon={<CreditCard className="size-4" />}
                label="Revenue"
                value={money(data.today.revenueCents)}
                prefix
                delta={deltaPct(data.today.revenueCents, data.yesterday.revenueCents)}
              />
              <TrendStat
                icon={<ReceiptText className="size-4" />}
                label="Orders"
                value={String(data.today.orders)}
                delta={deltaPct(data.today.orders, data.yesterday.orders)}
              />
              <TrendStat
                icon={<Users className="size-4" />}
                label="Avg. order"
                value={money(data.today.avgOrderCents)}
                prefix
                delta={deltaPct(data.today.avgOrderCents, data.yesterday.avgOrderCents)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Compared with the same window yesterday. Revenue counts paid orders.{' '}
              <Link href={`/manage/${slug}/kpis`} className="font-medium text-primary hover:underline">
                See full insights →
              </Link>
            </p>
          </section>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      )}
    </DashboardShell>
  );
}

function LiveStat({
  href,
  icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'amber';
}) {
  return (
    <Link href={href}>
      <Card
        className={cn(
          'h-full transition-colors hover:border-primary/40',
          tone === 'amber' && 'border-amber-300/60 bg-amber-50/40',
        )}
      >
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span className="text-muted-foreground/80">{icon}</span>
            {label}
          </div>
          <p className="text-2xl font-semibold tabular-nums leading-none">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

function TrendStat({
  icon,
  label,
  value,
  delta,
  prefix = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: number | null;
  prefix?: boolean;
}) {
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className="text-muted-foreground/80">{icon}</span>
          {label}
        </div>
        <div className="flex items-end justify-between gap-2">
          <p className="font-mono text-2xl font-semibold tabular-nums leading-none">
            {prefix && <span className="mr-0.5 text-base text-muted-foreground">$</span>}
            {value}
          </p>
          {delta != null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                up && 'bg-emerald-100 text-emerald-800',
                down && 'bg-rose-100 text-rose-800',
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
      </CardContent>
    </Card>
  );
}
