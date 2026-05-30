'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';
import { useSessionRealtime } from '@/lib/realtime';
import { useDebouncedSearch } from '@/lib/use-debounced-search';
import { useConfirm } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { BellRing, LogOut, ReceiptText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LabelIcon, labelName, type NutritionInfo } from '@/lib/menu-labels';
import { useCart, type CartEntry } from './cart-context';

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
  labels: string[];
  nutrition: NutritionInfo | null;
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
interface SessionOrderLine {
  id: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  note: string | null;
}
type OrderStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'in_kitchen'
  | 'ready'
  | 'served'
  | 'paid'
  | 'cancelled';
interface SessionOrder {
  id: string;
  status: OrderStatus;
  totalCents: number;
  placedAt: string;
  lines: SessionOrderLine[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

// Localised label name with an English fallback if a locale lacks the key.
function labelTitle(t: ReturnType<typeof useTranslations>, label: string): string {
  try {
    return t(label);
  } catch {
    return labelName(label);
  }
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

function statusToneClasses(status: OrderStatus): string {
  switch (status) {
    case 'pending_confirmation':
      return 'bg-amber-100 text-amber-900';
    case 'confirmed':
    case 'in_kitchen':
      return 'bg-blue-100 text-blue-900';
    case 'ready':
      return 'bg-emerald-100 text-emerald-900';
    case 'served':
      return 'bg-emerald-50 text-emerald-800';
    case 'paid':
      return 'bg-slate-100 text-slate-800';
    case 'cancelled':
      return 'bg-rose-100 text-rose-900';
  }
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const tPublic = useTranslations('public_menu');
  const tCart = useTranslations('cart');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('order_status');
  const tStatusTx = useTranslations('order_status.transition');
  const tSession = useTranslations('session_actions');
  const confirmDialog = useConfirm();
  // Session is kept warm so we resolve user info if signed in (no-op otherwise).
  void authClient.useSession();
  // Cart lives in the session-layout context so it survives navigation to an
  // item's dedicated detail page and back.
  const { cart, totalItems, totalCents, addToCart, setQuantity, setNote, clear } = useCart();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [orders, setOrders] = useState<SessionOrder[]>([]);

  const openItem = useCallback(
    (itemId: string) => router.push(`/s/${sessionId}/item/${itemId}`),
    [router, sessionId],
  );

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

  const refreshOrders = useCallback(async () => {
    try {
      const list = await api.get<SessionOrder[]>(`/v1/public/sessions/${sessionId}/orders`);
      setOrders(list);
    } catch {
      // 403 PENDING_APPROVAL is expected for guests still waiting — silently
      // skip and let the next refresh pick it up once they're approved.
    }
  }, [sessionId]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const tenantSlug = session?.tenantSlug ?? null;
  const meRole = session?.me?.role ?? null;

  useEffect(() => {
    if (!tenantSlug) return;
    api
      .get<PublicMenu>(`/v1/public/r/${tenantSlug}/menu`)
      .then(setMenu)
      .catch((err: Error) => setError(err.message));
  }, [tenantSlug]);

  // Pull the order list once the device is a real member (owner/member);
  // pending guests would just 403 on the orders endpoint.
  useEffect(() => {
    if (meRole === 'owner' || meRole === 'member') {
      void refreshOrders();
    }
  }, [meRole, refreshOrders]);

  useSessionRealtime(
    sessionId,
    useCallback(
      (event, payload) => {
        if (event === 'session.participant.pending') {
          toast.info(`${(payload as { displayName?: string }).displayName ?? 'A guest'} wants to join the table`);
          void refreshSession();
          return;
        }
        if (event === 'session.participant.approved') {
          toast.success(`${(payload as { displayName?: string }).displayName ?? 'A guest'} joined the table`);
          void refreshSession();
          void refreshOrders();
          return;
        }
        if (event === 'session.participant.removed' || event === 'session.participant.left') {
          void refreshSession();
          return;
        }
        if (event === 'session.closed') {
          toast(`The table session was closed.`);
          void refreshSession();
          return;
        }
        if (event === 'order.created') {
          void refreshOrders();
          return;
        }
        // Order state transitions — refresh + toast a friendly message so
        // the customer notices even if their phone screen was idle.
        if (
          event === 'order.confirmed' ||
          event === 'order.ready' ||
          event === 'order.served' ||
          event === 'order.paid' ||
          event === 'order.cancelled'
        ) {
          const txKey = ({
            'order.confirmed': 'in_kitchen',
            'order.ready': 'ready',
            'order.served': 'served',
            'order.paid': 'paid',
            'order.cancelled': 'cancelled',
          } as const)[event];
          try {
            const msg = tStatusTx(txKey);
            if (event === 'order.cancelled') toast.error(msg);
            else if (event === 'order.ready') toast.success(msg);
            else toast(msg);
          } catch {
            // missing translation — silent
          }
          void refreshOrders();
        }
      },
      [refreshSession, refreshOrders, tStatusTx],
    ),
  );

  const searchResults = useDebouncedSearch({
    path: tenantSlug ? `/v1/public/r/${tenantSlug}/search` : '',
    q: searchQ,
  });

  async function placeOrder() {
    if (cart.size === 0 || !session || !tenantSlug) return;
    setSubmitting(true);
    try {
      const lines = Array.from(cart.values()).map(({ item, quantity, note }) => ({
        menuItemId: item.id,
        quantity,
        ...(note?.trim() ? { note: note.trim() } : {}),
      }));
      await api.post('/v1/public/orders/session', {
        sessionId: session.id,
        lines,
      });
      clear();
      setCartOpen(false);
      toast.success(tCart('order_placed'));
      void refreshOrders();
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
    const ok = await confirmDialog({
      title: 'Remove this guest?',
      description: 'They will be ejected from the table session.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/v1/public/sessions/${sessionId}/participants/${participantId}`);
      await refreshSession();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function leave() {
    const ok = await confirmDialog({
      title: 'Leave the table?',
      description: 'You will need a new QR scan to rejoin.',
      confirmLabel: 'Leave',
    });
    if (!ok) return;
    try {
      await api.post(`/v1/public/sessions/${sessionId}/leave`, {});
      setError('You left the table.');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function endSession() {
    const ok = await confirmDialog({
      title: 'Close the table for everyone?',
      description: 'All guests at this table will be signed out of the session.',
      confirmLabel: 'End session',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.post(`/v1/public/sessions/${sessionId}/end`, {});
      // The realtime session.closed event will trigger a refresh and the
      // page will naturally flip to the "Thanks for visiting" closed UI.
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function callWaiter() {
    try {
      await api.post(`/v1/public/sessions/${sessionId}/call-waiter`, {});
      toast.success(tSession('waiter_called'));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function requestInvoice() {
    try {
      await api.post(`/v1/public/sessions/${sessionId}/request-invoice`, {});
      toast.success(tSession('invoice_requested'));
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
  const isClosed = session.status !== 'active';

  // ─── Closed / expired session ──────────────────────────────────────────────
  // The owner ended it, a manager closed it, or the TTL ran out. Show a
  // friendly farewell card with the order totals so the customer can still
  // reference what they had.

  if (isClosed) {
    const totalSpent = orders.reduce((sum, o) => sum + o.totalCents, 0);
    const reasonByStatus: Record<typeof session.status, string> = {
      active: 'The table is active.',
      closed_by_owner: 'The table host ended this session.',
      closed_by_staff: 'A staff member closed this session.',
      expired: 'This session expired.',
    };
    return (
      <main className="flex min-h-screen items-center justify-center px-4 gradient-warm">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Thanks for visiting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{reasonByStatus[session.status]}</p>
            {orders.length > 0 && (
              <div className="rounded-md border border-border bg-card p-3 text-left">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Your orders
                </p>
                <ul className="space-y-1 text-sm">
                  {orders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3">
                      <span className="truncate">
                        #{o.id.slice(0, 6)} · {o.lines.length} item{o.lines.length === 1 ? '' : 's'}
                      </span>
                      <span className="font-mono tabular-nums">{formatPrice(o.totalCents)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">{formatPrice(totalSpent)}</span>
                </div>
              </div>
            )}
            <Link
              href={tenantSlug ? `/r/${tenantSlug}` : '/'}
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent"
            >
              Back to {menu?.tenant.name ?? tenantSlug ?? 'menu'}
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

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
    <main className="mx-auto min-h-screen max-w-2xl px-4 pb-32">
      {/* Sticky header so the table actions stay reachable while scrolling
          a long menu. backdrop-blur keeps the gradient visible underneath. */}
      <header className="sticky top-0 z-10 -mx-4 mb-4 border-b border-border bg-card/95 px-4 py-3 backdrop-blur sm:relative sm:top-auto sm:z-auto sm:mx-0 sm:mt-8 sm:overflow-hidden sm:rounded-2xl sm:border sm:p-5 sm:shadow-sm">
        <div className="pointer-events-none absolute inset-0 -z-10 hidden gradient-brand-soft sm:block" />
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              {menu?.tenant.slug ?? tenantSlug ?? '…'} · {session.tableLabel ?? '—'}
            </p>
            <h1 className="mt-0.5 truncate text-xl font-semibold leading-tight tracking-tight sm:mt-1 sm:text-3xl">
              {menu?.tenant.name ?? 'Your table'}
            </h1>
          </div>
          {/* Table actions live directly in the header as icon buttons, using
              the same lucide set as the staff dashboard. Labels surface via
              tooltip + aria-label so the row stays compact on mobile. */}
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-full"
              onClick={callWaiter}
              aria-label={tSession('call_waiter')}
              title={tSession('call_waiter')}
            >
              <BellRing className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-full"
              onClick={requestInvoice}
              aria-label={tSession('request_invoice')}
              title={tSession('request_invoice')}
            >
              <ReceiptText className="size-4" />
            </Button>
            {isOwner ? (
              <Button
                variant="outline"
                size="icon"
                className="size-9 rounded-full text-destructive hover:text-destructive"
                onClick={endSession}
                aria-label={tSession('end_table')}
                title={tSession('end_table')}
              >
                <LogOut className="size-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="icon"
                className="size-9 rounded-full text-destructive hover:text-destructive"
                onClick={leave}
                aria-label={tSession('leave')}
                title={tSession('leave')}
              >
                <LogOut className="size-4" />
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

      {/* Live order status — anyone at the table sees every order placed
          from this session, with status pills that flip as the kitchen
          moves them along. */}
      {orders.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{tSession('your_orders')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {orders.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-border bg-background p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {tSession('order_label', { id: shortId(o.id) })}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {relativeTime(o.placedAt)}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                      statusToneClasses(o.status),
                    )}
                  >
                    {(() => {
                      try {
                        return tStatus(o.status);
                      } catch {
                        return o.status;
                      }
                    })()}
                  </span>
                </div>
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {o.lines.map((l) => (
                    <li key={l.id} className="flex justify-between gap-3">
                      <span className="truncate">
                        {l.quantity} × {l.name}
                        {l.note && (
                          <span className="ml-1 italic text-muted-foreground/80">— {l.note}</span>
                        )}
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatPrice(l.unitPriceCents * l.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-end text-xs">
                  <span className="font-mono font-semibold tabular-nums">
                    {formatPrice(o.totalCents)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
          onOpenDetail={(it) => openItem(it.id)}
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
                    const quantity = cart.get(item.id)?.quantity ?? 0;
                    return (
                      <li key={item.id}>
                        <ItemRow
                          item={item}
                          quantity={quantity}
                          onAdd={() => addToCart(item)}
                          onIncrement={() => setQuantity(item.id, quantity + 1)}
                          onDecrement={() => setQuantity(item.id, quantity - 1)}
                          onOpenDetail={() => openItem(item.id)}
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
            <div className="max-h-[55vh] space-y-4 overflow-y-auto px-6 py-4">
              {Array.from(cart.values()).map(({ item, quantity, note }) => (
                <div key={item.id} className="space-y-2 rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-3">
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
                  <Input
                    value={note ?? ''}
                    onChange={(e) => setNote(item.id, e.target.value)}
                    placeholder={tCart('note_placeholder')}
                    maxLength={280}
                    className="h-8 text-xs"
                  />
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
  quantity = 0,
  onAdd,
  onIncrement,
  onDecrement,
  onOpenDetail,
  addLabel,
}: {
  item: MenuItem;
  category?: string;
  quantity?: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onOpenDetail?: () => void;
  addLabel: string;
}) {
  const tLabels = useTranslations('menu_detail.labels');
  // The whole row is a button that opens the item's detail page; the quantity /
  // add controls live in a sibling node so tapping them never also navigates.
  return (
    <div
      className={cn(
        'flex items-stretch gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition-all',
        quantity > 0 && 'ring-2 ring-primary/40',
      )}
    >
      <button
        type="button"
        onClick={onOpenDetail}
        className="flex flex-1 items-start gap-3 text-left"
        aria-label={onOpenDetail ? `View ${item.name} details` : undefined}
        disabled={!onOpenDetail}
      >
        {item.imageUrl && (
          <span
            aria-hidden
            className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
          </span>
        )}
        <span className="flex flex-1 flex-col gap-1">
          <span className="font-medium leading-tight">{item.name}</span>
          {category && <span className="text-xs text-muted-foreground">{category}</span>}
          {item.description && (
            <span className="line-clamp-2 text-sm text-muted-foreground">{item.description}</span>
          )}
          {item.labels.length > 0 && (
            <span className="mt-0.5 flex flex-wrap items-center gap-1">
              {item.labels.map((l) => (
                <LabelIcon key={l} label={l} name={labelTitle(tLabels, l)} />
              ))}
            </span>
          )}
          <span className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
            {formatPrice(item.priceCents)}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 items-end">
        {quantity > 0 ? (
          <div className="flex items-center gap-1.5">
            <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={onDecrement}>
              −
            </Button>
            <span className="w-5 text-center text-sm font-medium tabular-nums">{quantity}</span>
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
  );
}

function SearchSection({
  hits,
  loading,
  cart,
  addToCart,
  setQuantity,
  onOpenDetail,
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
  onOpenDetail: (item: MenuItem) => void;
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
          labels: [],
          nutrition: null,
        };
        const quantity = cart.get(h.id)?.quantity ?? 0;
        return (
          <ItemRow
            key={h.id}
            item={itemShape}
            category={h.categoryName}
            quantity={quantity}
            onAdd={() => addToCart(itemShape)}
            onIncrement={() => setQuantity(h.id, quantity + 1)}
            onDecrement={() => setQuantity(h.id, quantity - 1)}
            onOpenDetail={() => onOpenDetail(itemShape)}
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
