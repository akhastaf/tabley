'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { useOrdersRealtime } from '@/lib/realtime';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManageNav } from '@/components/manage-nav';
import { StatusPill } from '@/components/status-pill';
import { cn } from '@/lib/utils';

interface OrderLine {
  id: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  note: string | null;
}

interface DeliveryAddress {
  recipientName: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  country?: string;
}
interface Order {
  id: string;
  status: string;
  channel: string;
  totalCents: number;
  customerNote: string | null;
  placedAt: string;
  tableLabel: string | null;
  deliveryAddress: DeliveryAddress | null;
  deliveryPhone: string | null;
  deliveryNotes: string | null;
  lines: OrderLine[];
}

const FILTERS = ['pending_confirmation', 'in_kitchen', 'ready', 'served', 'paid', 'cancelled'] as const;

const BOARD_COLUMNS = ['pending_confirmation', 'in_kitchen', 'ready'] as const;

const NEXT_ACTION: Record<string, { labelKey: string; verb: string } | undefined> = {
  pending_confirmation: { labelKey: 'validate_send', verb: 'confirm' },
  in_kitchen: { labelKey: 'mark_ready', verb: 'ready' },
  ready: { labelKey: 'mark_served', verb: 'served' },
  served: { labelKey: 'mark_paid', verb: 'paid' },
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

function channelStripe(channel: string) {
  if (channel === 'delivery') return 'bg-channel-delivery';
  if (channel === 'takeaway') return 'bg-channel-takeaway';
  return 'bg-channel-dine-in';
}

export default function WaiterOrdersPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const t = useTranslations('manage_orders');
  const tCommon = useTranslations('common');
  const { data: session, isPending } = authClient.useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [boardOrders, setBoardOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending_confirmation');
  const [view, setView] = useState<'list' | 'board'>('list');

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
  }, [isPending, session, router]);

  const load = useCallback(async () => {
    try {
      if (view === 'board') {
        const lists = await Promise.all(
          BOARD_COLUMNS.map((s) =>
            api.get<Order[]>(`/v1/manage/orders?status=${s}`, { tenantSlug: slug }),
          ),
        );
        setBoardOrders(lists.flat());
      } else {
        const list = await api.get<Order[]>(`/v1/manage/orders?status=${filter}`, {
          tenantSlug: slug,
        });
        setOrders(list);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug, filter, view]);

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
          const label = (payload as { tableLabel?: string }).tableLabel ?? '?';
          toast(t('waiter_called_toast', { label }), { duration: 8000 });
          return;
        }
        void load();
      },
      [load, t],
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
        <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <ManageNav slug={slug} active="orders" />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((key) => (
            <button
              key={key}
              onClick={() => {
                setFilter(key);
                setView('list');
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'list' && filter === key
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent',
              )}
            >
              {t(`filter.${key}`)}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-full border border-border bg-card p-1 text-xs">
          <button
            onClick={() => setView('list')}
            className={cn(
              'rounded-full px-3 py-1.5 transition-colors',
              view === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            List
          </button>
          <button
            onClick={() => setView('board')}
            className={cn(
              'rounded-full px-3 py-1.5 transition-colors',
              view === 'board'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Board
          </button>
        </div>
      </div>

      {view === 'board' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {BOARD_COLUMNS.map((col) => {
            const colOrders = boardOrders.filter((o) => o.status === col);
            return (
              <section
                key={col}
                className="flex min-h-[20rem] flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-3"
              >
                <header className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`filter.${col}`)}
                  </h2>
                  <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular-nums">
                    {colOrders.length}
                  </span>
                </header>
                {colOrders.length === 0 ? (
                  <p className="my-auto text-center text-xs text-muted-foreground/70">
                    {t('no_orders')}
                  </p>
                ) : (
                  colOrders.map((o) => (
                    <OrderCard key={o.id} order={o} act={act} t={t} compact />
                  ))
                )}
              </section>
            );
          })}
        </div>
      ) : loading && orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('loading_orders')}</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('no_orders')}</p>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} act={act} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order: o,
  act,
  t,
  compact = false,
}: {
  order: Order;
  act: (orderId: string, verb: string) => Promise<void>;
  t: ReturnType<typeof useTranslations<'manage_orders'>>;
  compact?: boolean;
}) {
  const action = NEXT_ACTION[o.status];
  return (
    <Card className="relative overflow-hidden">
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', channelStripe(o.channel))} />
      <CardHeader className={cn('flex flex-row items-start justify-between gap-3', compact && 'pb-2')}>
        <div className="space-y-1">
          <CardTitle className={cn('flex items-center gap-2', compact ? 'text-sm' : 'text-base')}>
            <span>
              {o.channel === 'delivery'
                ? t('delivery')
                : o.tableLabel
                  ? t('table', { label: o.tableLabel })
                  : t('takeaway')}
            </span>
            <span className="text-[10px] font-normal text-muted-foreground">#{o.id.slice(0, 6)}</span>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{timeAgo(o.placedAt)}</span>
            <StatusPill status={o.status} label={t(`filter.${o.status}`)} size="sm" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="font-mono text-lg font-semibold tabular-nums">{formatPrice(o.totalCents)}</p>
          <div className="flex flex-wrap justify-end gap-1.5">
            {action && (
              <Button size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => act(o.id, action.verb)}>
                {t(action.labelKey)}
              </Button>
            )}
            {o.status !== 'paid' && o.status !== 'cancelled' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => act(o.id, 'cancel')}
              >
                {t('cancel')}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {!compact && (
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
          {o.deliveryAddress && (
            <div className="mt-3 space-y-1 rounded-lg border border-channel-delivery/30 bg-channel-delivery/5 px-3 py-2 text-xs">
              <p className="font-medium">{t('deliver_to', { name: o.deliveryAddress.recipientName })}</p>
              <p className="text-muted-foreground">
                {o.deliveryAddress.line1}
                {o.deliveryAddress.line2 && `, ${o.deliveryAddress.line2}`}
                {`, ${o.deliveryAddress.city} ${o.deliveryAddress.postalCode}`}
                {o.deliveryAddress.country && `, ${o.deliveryAddress.country}`}
              </p>
              {o.deliveryPhone && (
                <p className="text-muted-foreground">{t('phone', { phone: o.deliveryPhone })}</p>
              )}
              {o.deliveryNotes && (
                <p className="text-muted-foreground">{t('notes', { text: o.deliveryNotes })}</p>
              )}
            </div>
          )}
          {o.customerNote && (
            <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {t('customer_note', { text: o.customerNote })}
            </p>
          )}
        </CardContent>
      )}
      {compact && (
        <CardContent className="pt-0">
          <ul className="space-y-0.5 text-xs">
            {o.lines.slice(0, 4).map((l) => (
              <li key={l.id} className="flex justify-between text-muted-foreground">
                <span className="truncate">
                  <span className="tabular-nums text-foreground">{l.quantity}×</span> {l.name}
                </span>
              </li>
            ))}
            {o.lines.length > 4 && (
              <li className="text-[10px] text-muted-foreground/70">+{o.lines.length - 4} more</li>
            )}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
