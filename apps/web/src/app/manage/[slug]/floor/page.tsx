'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { useOrdersRealtime } from '@/lib/realtime';
import { Card, CardContent } from '@/components/ui/card';
import { ManageNav } from '@/components/manage-nav';
import { cn } from '@/lib/utils';

interface FloorTable {
  id: string;
  label: string;
  capacity: number;
  isActive: boolean;
  session: {
    id: string;
    startedAt: string;
    expiresAt: string;
    participantCount: number;
    pendingCount: number;
    ownerName: string | null;
    openOrderCount: number;
    openOrderTotalCents: number;
  } | null;
}

function formatElapsed(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function formatPrice(c: number): string {
  return (c / 100).toFixed(2);
}

export default function FloorPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
  }, [isPending, session, router]);

  const load = useCallback(async () => {
    try {
      const list = await api.get<FloorTable[]>('/v1/manage/floor', { tenantSlug: slug });
      setTables(list);
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

  // Tick every 5s so the "elapsed" timers stay fresh without a server call.
  useEffect(() => {
    const i = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(i);
  }, []);

  // Reload on any realtime event from the tenant room (new session, order, etc.)
  useOrdersRealtime(
    session ? slug : null,
    useCallback(
      (event, payload) => {
        if (event === 'session.started') {
          const tableLabel = (payload as { tableLabel?: string }).tableLabel ?? '?';
          toast.success(`Table ${tableLabel} just opened a session`);
        }
        void load();
      },
      [load],
    ),
  );

  if (isPending || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const occupied = tables.filter((t) => t.session);
  const free = tables.filter((t) => !t.session);
  const pendingTotal = tables.reduce((sum, t) => sum + (t.session?.pendingCount ?? 0), 0);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{slug}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Floor</h1>
          <p className="text-sm text-muted-foreground">
            {occupied.length} occupied · {free.length} free
            {pendingTotal > 0 && (
              <>
                {' '}
                ·{' '}
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {pendingTotal} guest{pendingTotal === 1 ? '' : 's'} waiting for approval
                </span>
              </>
            )}
          </p>
        </div>
        <ManageNav slug={slug} active="floor" />
      </header>

      {loading && tables.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tables.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No tables yet. Create some on the Tables tab.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tables.map((t) => (
            <TableTile key={t.id} table={t} tick={tick} />
          ))}
        </div>
      )}
    </div>
  );
}

function TableTile({ table, tick: _tick }: { table: FloorTable; tick: number }) {
  const s = table.session;
  const isOccupied = !!s;
  const headcount = s ? s.participantCount : 0;
  const overCapacity = headcount > table.capacity;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-all',
        isOccupied ? 'border-primary/40' : 'border-border',
      )}
    >
      {/* Status stripe */}
      <span
        className={cn(
          'absolute inset-x-0 top-0 h-1',
          isOccupied ? 'bg-channel-dine-in' : 'bg-muted-foreground/20',
        )}
      />
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold leading-none">{table.label}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            seats {table.capacity}
          </p>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            isOccupied
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {isOccupied ? 'Occupied' : 'Free'}
        </span>
      </div>

      {s ? (
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Guests</span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                overCapacity
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                  : 'bg-muted',
              )}
              title={overCapacity ? 'More guests than the table is set up for' : undefined}
            >
              {headcount} / {table.capacity}
              {overCapacity && ' ⚠️'}
            </span>
          </div>
          {s.pendingCount > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-700 dark:text-amber-300">
                {s.pendingCount} waiting for approval
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{s.ownerName ? `Host: ${s.ownerName}` : 'No host yet'}</span>
            <span>{formatElapsed(s.startedAt)}</span>
          </div>
          {s.openOrderCount > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-muted/40 px-2 py-1.5 text-xs">
              <span>
                <span className="font-medium tabular-nums">{s.openOrderCount}</span> open order
                {s.openOrderCount === 1 ? '' : 's'}
              </span>
              <span className="font-mono tabular-nums">{formatPrice(s.openOrderTotalCents)}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No one seated.</p>
      )}
    </div>
  );
}
