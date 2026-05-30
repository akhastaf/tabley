'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, BellRing, CreditCard, ReceiptText, Sofa, X } from 'lucide-react';
import { useOrdersRealtime, type RealtimeEvent } from '@/lib/realtime';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type NotifKind = 'waiter' | 'invoice' | 'table_open' | 'order';

interface Notif {
  id: string;
  kind: NotifKind;
  title: string;
  detail?: string;
  groupKey: string;
  count: number;
  at: number;
  read: boolean;
}

const MAX_NOTIFS = 50;
// Repeated calls for the same table inside this window coalesce into one row.
const COALESCE_MS = 5 * 60 * 1000;
const HIGH_PRIORITY: NotifKind[] = ['waiter', 'invoice', 'table_open'];

const KIND_META: Record<
  NotifKind,
  { Icon: typeof Bell; tone: string; ring: string }
> = {
  waiter: { Icon: BellRing, tone: 'text-amber-600', ring: 'bg-amber-100' },
  invoice: { Icon: ReceiptText, tone: 'text-blue-600', ring: 'bg-blue-100' },
  table_open: { Icon: Sofa, tone: 'text-emerald-600', ring: 'bg-emerald-100' },
  order: { Icon: CreditCard, tone: 'text-foreground', ring: 'bg-muted' },
};

function relTime(at: number): string {
  const s = Math.floor((Date.now() - at) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// Short two-tone chime via WebAudio so we don't ship an audio asset.
function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = now + i * 0.12;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
    setTimeout(() => void ctx.close(), 600);
  } catch {
    // Autoplay blocked or unsupported — silently skip.
  }
}

export function StaffNotifications({ slug }: { slug: string | null | undefined }) {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const storageKey = `tabley_notifs_${slug ?? 'none'}`;

  // Hydrate from localStorage so notifications survive navigation + reloads.
  useEffect(() => {
    if (!slug) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setNotifs(JSON.parse(raw) as Notif[]);
      setSoundOn(localStorage.getItem('tabley_notif_sound') !== 'off');
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (!hydrated || !slug) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(notifs));
    } catch {
      // ignore quota errors
    }
  }, [notifs, hydrated, slug, storageKey]);

  const push = useCallback(
    (incoming: Omit<Notif, 'id' | 'count' | 'read' | 'at'> & { at?: number }) => {
      const at = incoming.at ?? Date.now();
      setNotifs((prev) => {
        // Coalesce: same group within the window that's still unread → bump.
        const idx = prev.findIndex(
          (n) =>
            n.groupKey === incoming.groupKey &&
            !n.read &&
            at - n.at < COALESCE_MS,
        );
        if (idx !== -1) {
          const next = [...prev];
          const existing = next[idx]!;
          next[idx] = { ...existing, count: existing.count + 1, at, title: incoming.title, detail: incoming.detail };
          // Move the bumped item to the top.
          const [moved] = next.splice(idx, 1);
          return [moved!, ...next].slice(0, MAX_NOTIFS);
        }
        const fresh: Notif = {
          id: `${at}-${Math.random().toString(36).slice(2, 7)}`,
          count: 1,
          read: false,
          at,
          kind: incoming.kind,
          title: incoming.title,
          detail: incoming.detail,
          groupKey: incoming.groupKey,
        };
        return [fresh, ...prev].slice(0, MAX_NOTIFS);
      });
    },
    [],
  );

  // Keep a ref so the realtime callback (stable) can reach the latest soundOn.
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  useOrdersRealtime(
    slug ?? null,
    useCallback(
      (event: RealtimeEvent, payload: Record<string, unknown>) => {
        const tableLabel = (payload.tableLabel as string | null) ?? null;
        const tableText = tableLabel ? `Table ${tableLabel}` : 'A table';
        let kind: NotifKind | null = null;
        let title = '';
        let detail: string | undefined;
        let groupKey = '';

        if (event === 'waiter.called') {
          const reason = (payload.reason as string | null) ?? null;
          if (reason === 'invoice') {
            kind = 'invoice';
            title = `${tableText} requests the bill`;
            groupKey = `invoice:${tableLabel ?? payload.tableId ?? ''}`;
          } else {
            kind = 'waiter';
            title = `${tableText} called a waiter`;
            detail = reason ?? undefined;
            groupKey = `waiter:${tableLabel ?? payload.tableId ?? ''}`;
          }
        } else if (event === 'session.started') {
          kind = 'table_open';
          title = `New party seated`;
          detail = tableLabel ? `Table ${tableLabel}` : undefined;
          groupKey = `open:${payload.sessionId ?? payload.tableId ?? ''}`;
        } else if (event === 'order.created') {
          kind = 'order';
          const cents = Number(payload.totalCents ?? 0);
          title = 'New order placed';
          detail = `${(cents / 100).toFixed(2)}`;
          groupKey = `order:${payload.id ?? ''}`;
        }

        if (!kind) return;
        push({ kind, title, detail, groupKey });
        if (soundRef.current && HIGH_PRIORITY.includes(kind)) playChime();
      },
      [push],
    ),
  );

  const unread = notifs.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifs((prev) => (prev.some((n) => !n.read) ? prev.map((n) => ({ ...n, read: true })) : prev));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => setNotifs([]), []);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      try {
        localStorage.setItem('tabley_notif_sound', next ? 'on' : 'off');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return (
    <DropdownMenu onOpenChange={(open) => open && markAllRead()}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleSound}
              aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
              title={soundOn ? 'Sound on' : 'Sound off'}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {soundOn ? <BellRing className="size-4" /> : <BellOff className="size-4" />}
            </button>
            {notifs.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {notifs.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
            <Bell className="size-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">You&apos;re all caught up</p>
          </div>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {notifs.map((n) => {
              const { Icon, tone, ring } = KIND_META[n.kind];
              return (
                <li
                  key={n.id}
                  className={cn(
                    'group flex items-start gap-3 px-3 py-2.5',
                    !n.read && 'bg-primary/5',
                  )}
                >
                  <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full', ring)}>
                    <Icon className={cn('size-4', tone)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-tight">
                      {n.title}
                      {n.count > 1 && (
                        <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800 tabular-nums">
                          ×{n.count}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {n.detail ? `${n.detail} · ` : ''}
                      {relTime(n.at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(n.id)}
                    aria-label="Dismiss"
                    className="shrink-0 rounded-md p-1 text-muted-foreground/0 transition-colors hover:bg-accent hover:text-foreground group-hover:text-muted-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
