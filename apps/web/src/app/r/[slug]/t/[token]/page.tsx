'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';
import { usePublicOrderRealtime } from '@/lib/realtime';
import { useDebouncedSearch } from '@/lib/use-debounced-search';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  allergens: string[];
}
interface MenuCategory {
  id: string;
  name: string;
  position: number;
  items: MenuItem[];
}
interface PublicMenu {
  tenant: { id: string; slug: string; name: string };
  categories: MenuCategory[];
}
interface TableInfo {
  tenant: { id: string; slug: string; name: string };
  table: { id: string; label: string; capacity: number };
}
interface OrderStatus {
  id: string;
  status: string;
  totalCents: number;
  placedAt: string;
  confirmedAt: string | null;
  tableLabel: string;
  lines: Array<{
    id: string;
    name: string;
    unitPriceCents: number;
    quantity: number;
    note: string | null;
  }>;
}

interface CartEntry {
  item: MenuItem;
  quantity: number;
}

const STATUS_STEP_KEYS = [
  'pending_confirmation',
  'in_kitchen',
  'ready',
  'served',
  'paid',
] as const;

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

function statusIndex(status: string) {
  return STATUS_STEP_KEYS.indexOf(status as (typeof STATUS_STEP_KEYS)[number]);
}

export default function PublicOrderingPage() {
  const { slug, token } = useParams<{ slug: string; token: string }>();
  const searchParams = useSearchParams();
  const reorderId = searchParams.get('reorder');
  const tPublic = useTranslations('public_menu');
  const tCart = useTranslations('cart');
  const tCommon = useTranslations('common');
  const { data: session } = authClient.useSession();
  const [info, setInfo] = useState<TableInfo | null>(null);
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<Map<string, CartEntry>>(new Map());
  const [reorderApplied, setReorderApplied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [calling, setCalling] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const searchResults = useDebouncedSearch({
    path: `/v1/public/r/${slug}/search`,
    q: searchQ,
  });

  useEffect(() => {
    Promise.all([
      api.get<TableInfo>(`/v1/public/r/${slug}/t/${token}`),
      api.get<PublicMenu>(`/v1/public/r/${slug}/menu`),
    ])
      .then(([t, m]) => {
        setInfo(t);
        setMenu(m);
      })
      .catch((err: Error) => setError(err.message));
  }, [slug, token]);

  useEffect(() => {
    if (!reorderId || !menu || !session || reorderApplied) return;
    void (async () => {
      try {
        type LineDto = { menuItemId: string; quantity: number };
        const hist = await api.get<{ lines: LineDto[] }>(`/v1/me/orders/${reorderId}`);
        const available = new Map<string, MenuItem>();
        for (const c of menu.categories) for (const i of c.items) available.set(i.id, i);
        const next = new Map<string, CartEntry>();
        let missing = 0;
        for (const l of hist.lines) {
          const item = available.get(l.menuItemId);
          if (item) next.set(item.id, { item, quantity: l.quantity });
          else missing++;
        }
        if (next.size > 0) {
          setCart(next);
          toast.success(
            missing > 0
              ? `Re-added ${next.size} items (${missing} no longer available)`
              : `Re-added ${next.size} items to your cart`,
          );
        } else {
          toast.error('None of the previous items are available right now');
        }
        setReorderApplied(true);
      } catch (err) {
        toast.error((err as Error).message);
        setReorderApplied(true);
      }
    })();
  }, [reorderId, menu, session, reorderApplied]);

  const refreshOrder = useCallback(async () => {
    if (!order) return;
    try {
      const fresh = await api.get<OrderStatus>(
        `/v1/public/orders/${order.id}?tableToken=${encodeURIComponent(token)}`,
      );
      setOrder(fresh);
    } catch {
      // ignore
    }
  }, [order, token]);

  usePublicOrderRealtime(
    { orderId: order?.id ?? null, tableToken: order ? token : null },
    useCallback(() => void refreshOrder(), [refreshOrder]),
  );

  const totalCents = useMemo(() => {
    let total = 0;
    for (const { item, quantity } of cart.values()) total += item.priceCents * quantity;
    return total;
  }, [cart]);

  const totalItems = useMemo(() => {
    let total = 0;
    for (const { quantity } of cart.values()) total += quantity;
    return total;
  }, [cart]);

  const addToCart = useCallback((item: MenuItem) => {
    setCart((c) => {
      const next = new Map(c);
      const existing = next.get(item.id);
      next.set(item.id, { item, quantity: (existing?.quantity ?? 0) + 1 });
      return next;
    });
  }, []);

  const setQuantity = useCallback((itemId: string, quantity: number) => {
    setCart((c) => {
      const next = new Map(c);
      const entry = next.get(itemId);
      if (!entry) return c;
      if (quantity <= 0) next.delete(itemId);
      else next.set(itemId, { ...entry, quantity });
      return next;
    });
  }, []);

  async function placeOrder() {
    if (cart.size === 0) return;
    setSubmitting(true);
    try {
      const lines = Array.from(cart.values()).map(({ item, quantity }) => ({
        menuItemId: item.id,
        quantity,
      }));
      const res = await api.post<{ id: string }>('/v1/public/orders', {
        slug,
        tableToken: token,
        lines,
      });
      setCart(new Map());
      const fresh = await api.get<OrderStatus>(
        `/v1/public/orders/${res.id}?tableToken=${encodeURIComponent(token)}`,
      );
      setOrder(fresh);
      toast.success(tCart('order_placed'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function callWaiter() {
    setCalling(true);
    try {
      await api.post('/v1/public/call-waiter', { slug, tableToken: token });
      toast.success(tPublic('waiter_notified'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCalling(false);
    }
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Cannot open menu</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!info || !menu) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 pb-32 pt-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {info.tenant.slug} · {info.table.label}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{info.tenant.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {session ? (
            <Link
              href="/me/orders"
              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-accent"
            >
              {tPublic('my_orders')}
            </Link>
          ) : (
            <Link
              href={`/sign-in?next=${encodeURIComponent(`/r/${slug}/t/${token}`)}`}
              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-accent"
            >
              {tPublic('sign_in')}
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={callWaiter} disabled={calling}>
            {calling ? tPublic('calling') : tPublic('call_waiter')}
          </Button>
        </div>
      </header>

      {order && <OrderStatusPanel order={order} />}

      <div className="mb-6">
        <Input
          placeholder={tPublic('search_placeholder')}
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
      </div>

      {searchResults.active ? (
        <section className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {searchResults.loading
              ? tPublic('searching')
              : tPublic('results_count', { count: searchResults.hits.length })}
          </p>
          {searchResults.hits.map((h) => {
            const itemShape: MenuItem = {
              id: h.id,
              name: h.name,
              description: h.description || null,
              priceCents: h.priceCents,
              allergens: h.allergens,
            };
            const entry = cart.get(h.id);
            return (
              <div key={h.id} className="flex items-start justify-between gap-4 border-b border-border pb-3">
                <div className="flex-1">
                  <p className="font-medium">{h.name}</p>
                  <p className="text-xs text-muted-foreground">{h.categoryName}</p>
                  {h.description && (
                    <p className="text-sm text-muted-foreground">{h.description}</p>
                  )}
                  <p className="mt-1 font-mono text-sm tabular-nums">{formatPrice(h.priceCents)}</p>
                </div>
                {entry ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setQuantity(h.id, entry.quantity - 1)}>−</Button>
                    <span className="w-6 text-center tabular-nums">{entry.quantity}</span>
                    <Button size="sm" variant="outline" onClick={() => setQuantity(h.id, entry.quantity + 1)}>+</Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => addToCart(itemShape)}>{tCart('add')}</Button>
                )}
              </div>
            );
          })}
          {!searchResults.loading && searchResults.hits.length === 0 && (
            <p className="text-sm text-muted-foreground">{tPublic('no_matches')}</p>
          )}
        </section>
      ) : menu.categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tPublic('menu_being_prepared')}</p>
      ) : (
        <div className="space-y-8">
        {menu.categories.map((cat) => (
          <section key={cat.id}>
            <h2 className="mb-3 text-xl font-semibold tracking-tight">{cat.name}</h2>
            {cat.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tPublic('no_items_yet')}</p>
            ) : (
              <ul className="space-y-3">
                {cat.items.map((item) => {
                  const entry = cart.get(item.id);
                  return (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-4 border-b border-border pb-3"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        )}
                        <p className="mt-1 font-mono text-sm tabular-nums">
                          {formatPrice(item.priceCents)}
                        </p>
                      </div>
                      {entry ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setQuantity(item.id, entry.quantity - 1)}
                          >
                            −
                          </Button>
                          <span className="w-6 text-center tabular-nums">{entry.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setQuantity(item.id, entry.quantity + 1)}
                          >
                            +
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" onClick={() => addToCart(item)}>
                          {tCart('add')}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
        </div>
      )}

      {totalItems > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <div className="text-sm">
              {tCart('items_count', { count: totalItems })}
              <Separator orientation="vertical" className="mx-3 inline-block h-4 align-middle" />
              <span className="font-mono tabular-nums">{formatPrice(totalCents)}</span>
            </div>
            <Button onClick={placeOrder} disabled={submitting}>
              {submitting ? tCart('placing') : order ? tCart('place_another') : tCart('place_order')}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function OrderStatusPanel({ order }: { order: OrderStatus }) {
  const tCart = useTranslations('cart');
  const tStatus = useTranslations('order_status');
  const currentIdx = statusIndex(order.status);
  const cancelled = order.status === 'cancelled';

  return (
    <Card className="mb-8 border-primary/50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{tCart('your_order', { id: order.id.slice(0, 6) })}</span>
          <span className="font-mono text-sm">{(order.totalCents / 100).toFixed(2)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {cancelled ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {tCart('cancelled_message')}
          </p>
        ) : (
          <ol className="space-y-2">
            {STATUS_STEP_KEYS.map((key, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              return (
                <li
                  key={key}
                  className={
                    'flex items-center gap-3 text-sm ' +
                    (active
                      ? 'font-medium text-foreground'
                      : done
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/60')
                  }
                >
                  <span
                    className={
                      'flex h-5 w-5 items-center justify-center rounded-full border text-xs ' +
                      (done
                        ? 'border-primary bg-primary text-primary-foreground'
                        : active
                          ? 'border-primary'
                          : 'border-border')
                    }
                  >
                    {done ? '✓' : idx + 1}
                  </span>
                  {tStatus(key)}
                </li>
              );
            })}
          </ol>
        )}
        <Separator />
        <ul className="space-y-1 text-sm">
          {order.lines.map((l) => (
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
  );
}
