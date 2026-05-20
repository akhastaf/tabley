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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { StatusPill } from '@/components/status-pill';
import { cn } from '@/lib/utils';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl?: string | null;
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

/** Stable per-item gradient swatch when no image is set. */
function swatchFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hue1 = Math.abs(h) % 360;
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, oklch(0.82 0.12 ${hue1}), oklch(0.78 0.14 ${hue2}))`;
}

function ItemRow({
  item,
  category,
  entry,
  onAdd,
  onIncrement,
  onDecrement,
  addLabel,
}: {
  item: MenuItem;
  category?: string;
  entry?: CartEntry;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  addLabel: string;
}) {
  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition-all',
        entry && 'ring-2 ring-primary/40',
      )}
    >
      <div
        aria-hidden
        className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted"
        style={!item.imageUrl ? { backgroundImage: swatchFor(item.id + item.name) } : undefined}
      >
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-2">
        <div>
          <p className="font-medium leading-tight">{item.name}</p>
          {category && <p className="text-xs text-muted-foreground">{category}</p>}
          {item.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-semibold tabular-nums">
            {formatPrice(item.priceCents)}
          </span>
          {entry ? (
            <div className="flex items-center gap-1.5">
              <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={onDecrement}>
                −
              </Button>
              <span className="w-5 text-center text-sm font-medium tabular-nums">{entry.quantity}</span>
              <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={onIncrement}>
                +
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={onAdd}
              className="h-8 rounded-full bg-primary px-4 text-xs font-semibold shadow-sm"
            >
              {addLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderStatusPanel({
  order,
  cancelled,
  tCart,
  tStatus,
}: {
  order: OrderStatus;
  cancelled: boolean;
  tCart: ReturnType<typeof useTranslations<'cart'>>;
  tStatus: ReturnType<typeof useTranslations<'order_status'>>;
}) {
  const currentIdx = statusIndex(order.status);
  return (
    <Card className="relative mb-6 overflow-hidden border-primary/30 shadow-md">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 gradient-brand" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              #{order.id.slice(0, 6)}
            </p>
            <CardTitle className="text-base">
              {tCart('your_order', { id: order.id.slice(0, 6) })}
            </CardTitle>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="font-mono text-lg font-semibold tabular-nums">
              {formatPrice(order.totalCents)}
            </span>
            {!cancelled && (
              <StatusPill status={order.status} label={tStatus(order.status as never)} size="sm" />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {cancelled ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {tCart('cancelled_message')}
          </p>
        ) : (
          <ol className="flex items-center justify-between gap-1">
            {STATUS_STEP_KEYS.map((key, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              return (
                <li key={key} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full items-center">
                    {idx > 0 && (
                      <span
                        className={cn(
                          'h-0.5 flex-1 transition-colors',
                          done || active ? 'bg-primary' : 'bg-border',
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition-all',
                        done && 'border-primary bg-primary text-primary-foreground',
                        active && 'border-primary bg-background text-primary ring-4 ring-primary/20 animate-pulse',
                        !done && !active && 'border-border bg-background text-muted-foreground',
                      )}
                    >
                      {done ? '✓' : idx + 1}
                    </span>
                    {idx < STATUS_STEP_KEYS.length - 1 && (
                      <span
                        className={cn(
                          'h-0.5 flex-1 transition-colors',
                          done ? 'bg-primary' : 'bg-border',
                        )}
                      />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-medium leading-tight',
                      active ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {tStatus(key)}
                  </span>
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
                {formatPrice(l.unitPriceCents * l.quantity)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function PublicOrderingPage() {
  const { slug, token } = useParams<{ slug: string; token: string }>();
  const searchParams = useSearchParams();
  const reorderId = searchParams.get('reorder');
  const tPublic = useTranslations('public_menu');
  const tCart = useTranslations('cart');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('order_status');
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
  const [cartOpen, setCartOpen] = useState(false);
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
      setCartOpen(false);
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
      <main className="flex min-h-screen items-center justify-center px-4 gradient-warm">
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
      <header className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="pointer-events-none absolute inset-0 -z-10 gradient-brand-soft" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              {info.tenant.slug} · {info.table.label}
            </p>
            <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight">
              {info.tenant.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {session ? (
              <Link
                href="/me/orders"
                className="inline-flex h-9 items-center rounded-full border border-border bg-background/80 px-3 text-xs font-medium backdrop-blur transition-colors hover:bg-accent"
              >
                {tPublic('my_orders')}
              </Link>
            ) : (
              <Link
                href={`/sign-in?next=${encodeURIComponent(`/r/${slug}/t/${token}`)}`}
                className="inline-flex h-9 items-center rounded-full border border-border bg-background/80 px-3 text-xs font-medium backdrop-blur transition-colors hover:bg-accent"
              >
                {tPublic('sign_in')}
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={callWaiter}
              disabled={calling}
              className="rounded-full border-primary/30 bg-primary/5 text-xs hover:bg-primary/10"
            >
              {calling ? tPublic('calling') : tPublic('call_waiter')}
            </Button>
          </div>
        </div>
      </header>

      {order && (
        <OrderStatusPanel
          order={order}
          cancelled={order.status === 'cancelled'}
          tCart={tCart}
          tStatus={tStatus}
        />
      )}

      <div className="mb-6">
        <Input
          placeholder={tPublic('search_placeholder')}
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          className="h-11 rounded-full bg-card px-5 shadow-sm"
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
              imageUrl: null,
              allergens: h.allergens,
            };
            const entry = cart.get(h.id);
            return (
              <ItemRow
                key={h.id}
                item={itemShape}
                category={h.categoryName}
                entry={entry}
                onAdd={() => addToCart(itemShape)}
                onIncrement={() => entry && setQuantity(h.id, entry.quantity + 1)}
                onDecrement={() => entry && setQuantity(h.id, entry.quantity - 1)}
                addLabel={tCart('add')}
              />
            );
          })}
          {!searchResults.loading && searchResults.hits.length === 0 && (
            <p className="text-sm text-muted-foreground">{tPublic('no_matches')}</p>
          )}
        </section>
      ) : menu.categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tPublic('menu_being_prepared')}</p>
      ) : (
        <div className="space-y-10">
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
                      <li key={item.id}>
                        <ItemRow
                          item={item}
                          entry={entry}
                          onAdd={() => addToCart(item)}
                          onIncrement={() => entry && setQuantity(item.id, entry.quantity + 1)}
                          onDecrement={() => entry && setQuantity(item.id, entry.quantity - 1)}
                          addLabel={tCart('add')}
                        />
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
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                'fixed inset-x-4 bottom-4 z-20 mx-auto flex max-w-md items-center justify-between rounded-2xl gradient-brand px-5 py-3 text-primary-foreground shadow-2xl shadow-primary/30 transition-transform hover:scale-[1.01] sm:bottom-6',
              )}
            >
              <span className="flex items-center gap-3 text-sm font-medium">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
                  {totalItems}
                </span>
                {tCart('items_count', { count: totalItems })}
              </span>
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="font-mono tabular-nums">{formatPrice(totalCents)}</span>
                <span aria-hidden>→</span>
              </span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl border-t-0 px-0 pb-0">
            <SheetHeader className="border-b border-border px-6 pb-3 pt-2">
              <SheetTitle className="text-left">
                {tCart('items_count', { count: totalItems })}
              </SheetTitle>
            </SheetHeader>
            <div className="max-h-[55vh] space-y-3 overflow-y-auto px-6 py-4">
              {Array.from(cart.values()).map(({ item, quantity }) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{formatPrice(item.priceCents)}</span> ×{' '}
                      {quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-full"
                      onClick={() => setQuantity(item.id, quantity - 1)}
                    >
                      −
                    </Button>
                    <span className="w-6 text-center text-sm tabular-nums">{quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-full"
                      onClick={() => setQuantity(item.id, quantity + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border bg-card/50 px-6 py-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono text-lg font-semibold tabular-nums">
                  {formatPrice(totalCents)}
                </span>
              </div>
              <Button
                onClick={placeOrder}
                disabled={submitting}
                className="h-12 w-full rounded-full gradient-brand text-base font-semibold shadow-md shadow-primary/30"
              >
                {submitting ? tCart('placing') : order ? tCart('place_another') : tCart('place_order')}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </main>
  );
}
