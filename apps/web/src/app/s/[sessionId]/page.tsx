'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';
import { useSessionRealtime } from '@/lib/realtime';
import { useDebouncedSearch } from '@/lib/use-debounced-search';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Participant {
  id: string;
  displayName: string;
  role: 'owner' | 'member' | 'pending';
  joinedAt: string;
}
interface SessionDetail {
  id: string;
  tenantId: string;
  tenantSlug: string | null;
  tenantName: string | null;
  tableId: string;
  tableLabel: string | null;
  tableToken: string | null;
  status: 'active' | 'closed_by_owner' | 'closed_by_staff' | 'expired';
  expiresAt: string;
  me: Participant | null;
  participants: Participant[];
}
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
interface CartEntry {
  item: MenuItem;
  quantity: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

function swatchFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hue1 = Math.abs(h) % 360;
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, oklch(0.82 0.12 ${hue1}), oklch(0.78 0.14 ${hue2}))`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const tPublic = useTranslations('public_menu');
  const tCart = useTranslations('cart');
  const tCommon = useTranslations('common');
  // Session is kept warm so we resolve user info if signed in (no-op otherwise).
  void authClient.useSession();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<Map<string, CartEntry>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');

  const refreshSession = useCallback(async () => {
    try {
      const s = await api.get<SessionDetail>(`/v1/public/sessions/${sessionId}`);
      setSession(s);
      return s;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [sessionId]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const tenantSlug = session?.tenantSlug ?? null;

  useEffect(() => {
    if (!tenantSlug) return;
    api
      .get<PublicMenu>(`/v1/public/r/${tenantSlug}/menu`)
      .then(setMenu)
      .catch((err: Error) => setError(err.message));
  }, [tenantSlug]);

  useSessionRealtime(
    sessionId,
    useCallback(
      (event, payload) => {
        if (event === 'session.participant.pending') {
          toast.info(`${(payload as { displayName?: string }).displayName ?? 'A guest'} wants to join the table`);
        }
        if (event === 'session.participant.approved') {
          toast.success(`${(payload as { displayName?: string }).displayName ?? 'A guest'} joined the table`);
        }
        if (event === 'session.closed') {
          toast(`The table session was closed.`);
        }
        void refreshSession();
      },
      [refreshSession],
    ),
  );

  const searchResults = useDebouncedSearch({
    path: tenantSlug ? `/v1/public/r/${tenantSlug}/search` : '',
    q: searchQ,
  });

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
    if (cart.size === 0 || !session || !tenantSlug) return;
    setSubmitting(true);
    try {
      const lines = Array.from(cart.values()).map(({ item, quantity }) => ({
        menuItemId: item.id,
        quantity,
      }));
      await api.post('/v1/public/orders/session', {
        sessionId: session.id,
        lines,
      });
      setCart(new Map());
      setCartOpen(false);
      toast.success(tCart('order_placed'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function approve(participantId: string) {
    try {
      await api.patch(`/v1/public/sessions/${sessionId}/participants/${participantId}/approve`, {});
      await refreshSession();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(participantId: string) {
    if (!confirm('Remove this guest from the table?')) return;
    try {
      await api.delete(`/v1/public/sessions/${sessionId}/participants/${participantId}`);
      await refreshSession();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function leave() {
    if (!confirm('Leave the table?')) return;
    try {
      await api.post(`/v1/public/sessions/${sessionId}/leave`, {});
      setError('You left the table.');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function endSession() {
    if (!confirm('Close the table for everyone?')) return;
    try {
      await api.post(`/v1/public/sessions/${sessionId}/end`, {});
      setError('Session ended.');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // ─── Loading + error states ────────────────────────────────────────────────

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 gradient-warm">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Session unavailable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
      </main>
    );
  }

  const me = session.me;
  const pendingMe = me?.role === 'pending';
  const isOwner = me?.role === 'owner';
  const pendingGuests = session.participants.filter((p) => p.role === 'pending');
  const activeGuests = session.participants.filter((p) => p.role !== 'pending');

  // ─── Pending-approval screen ───────────────────────────────────────────────

  if (pendingMe) {
    const owner = session.participants.find((p) => p.role === 'owner');
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 gradient-warm">
        <Card className="w-full text-center">
          <CardHeader>
            <CardTitle>Waiting for approval</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-primary/20" />
            <p className="text-sm text-muted-foreground">
              {owner ? `${owner.displayName} is hosting this table.` : 'The table host is being notified.'}
            </p>
            <p className="text-xs text-muted-foreground">
              You&apos;ll join automatically the moment they tap Approve.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 gradient-warm">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Not in this session</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Scan the QR at the table to join.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  // ─── Main ordering screen ──────────────────────────────────────────────────

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 pb-32 pt-8">
      <header className="relative mb-4 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="pointer-events-none absolute inset-0 -z-10 gradient-brand-soft" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              {menu?.tenant.slug ?? tenantSlug ?? '…'} · {session.tableLabel ?? '—'}
            </p>
            <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              {menu?.tenant.name ?? 'Your table'}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOwner ? (
              <Button
                variant="outline"
                size="sm"
                onClick={endSession}
                className="rounded-full text-xs"
              >
                End table
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={leave}
                className="rounded-full text-xs"
              >
                Leave
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Participants strip */}
      <section className="mb-4 flex flex-wrap items-center gap-2">
        {activeGuests.map((p) => (
          <span
            key={p.id}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs',
              p.id === me.id && 'ring-2 ring-primary/30',
            )}
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-primary-foreground"
              style={{ backgroundImage: swatchFor(p.id) }}
            >
              {initials(p.displayName)}
            </span>
            <span className="font-medium">{p.displayName}</span>
            {p.role === 'owner' && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                Host
              </span>
            )}
          </span>
        ))}
      </section>

      {/* Owner: pending approvals */}
      {isOwner && pendingGuests.length > 0 && (
        <Card className="mb-4 border-primary/40 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {pendingGuests.length} guest{pendingGuests.length === 1 ? '' : 's'} want to join
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingGuests.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground"
                    style={{ backgroundImage: swatchFor(p.id) }}
                  >
                    {initials(p.displayName)}
                  </span>
                  <span className="text-sm font-medium">{p.displayName}</span>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => approve(p.id)}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => remove(p.id)}
                  >
                    Deny
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mb-6">
        <Input
          placeholder={tPublic('search_placeholder')}
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          className="h-11 rounded-full bg-card px-5 shadow-sm"
        />
      </div>

      {!menu ? (
        <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
      ) : searchResults.active ? (
        <SearchSection
          hits={searchResults.hits}
          loading={searchResults.loading}
          cart={cart}
          addToCart={addToCart}
          setQuantity={setQuantity}
          tPublic={tPublic}
          tCart={tCart}
        />
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
            <button className="fixed inset-x-4 bottom-4 z-20 mx-auto flex max-w-md items-center justify-between rounded-2xl gradient-brand px-5 py-3 text-primary-foreground shadow-2xl shadow-primary/30 transition-transform hover:scale-[1.01] sm:bottom-6">
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
                      <span className="font-mono">{formatPrice(item.priceCents)}</span> × {quantity}
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
                <span className="font-mono text-lg font-semibold tabular-nums">{formatPrice(totalCents)}</span>
              </div>
              <Button
                onClick={placeOrder}
                disabled={submitting}
                className="h-12 w-full rounded-full gradient-brand text-base font-semibold shadow-md shadow-primary/30"
              >
                {submitting ? tCart('placing') : tCart('place_order')}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </main>
  );
}

// ─── Reusable item row ───────────────────────────────────────────────────────

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
        'flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition-all',
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
          <span className="font-mono text-sm font-semibold tabular-nums">{formatPrice(item.priceCents)}</span>
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
            <Button size="sm" onClick={onAdd} className="h-8 rounded-full bg-primary px-4 text-xs font-semibold shadow-sm">
              {addLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchSection({
  hits,
  loading,
  cart,
  addToCart,
  setQuantity,
  tPublic,
  tCart,
}: {
  hits: Array<{
    id: string;
    name: string;
    description: string;
    priceCents: number;
    allergens: string[];
    categoryName: string;
  }>;
  loading: boolean;
  cart: Map<string, CartEntry>;
  addToCart: (item: MenuItem) => void;
  setQuantity: (id: string, q: number) => void;
  tPublic: ReturnType<typeof useTranslations<'public_menu'>>;
  tCart: ReturnType<typeof useTranslations<'cart'>>;
}) {
  return (
    <section className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {loading ? tPublic('searching') : tPublic('results_count', { count: hits.length })}
      </p>
      {hits.map((h) => {
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
      {!loading && hits.length === 0 && (
        <p className="text-sm text-muted-foreground">{tPublic('no_matches')}</p>
      )}
    </section>
  );
}
