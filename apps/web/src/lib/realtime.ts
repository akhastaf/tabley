'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3011';

export type RealtimeEvent =
  | 'order.created'
  | 'order.confirmed'
  | 'order.ready'
  | 'order.served'
  | 'order.paid'
  | 'order.cancelled'
  | 'menu.import.processing'
  | 'menu.import.completed'
  | 'menu.import.failed';

export const ORDER_EVENTS: RealtimeEvent[] = [
  'order.created',
  'order.confirmed',
  'order.ready',
  'order.served',
  'order.paid',
  'order.cancelled',
];

export const MENU_IMPORT_EVENTS: RealtimeEvent[] = [
  'menu.import.processing',
  'menu.import.completed',
  'menu.import.failed',
];

export function useTenantRealtime(
  tenantSlug: string | null | undefined,
  events: RealtimeEvent[],
  onEvent: (event: RealtimeEvent, payload: Record<string, unknown>) => void,
) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!tenantSlug || events.length === 0) return;

    const socket: Socket = io(`${API_URL}/orders`, {
      withCredentials: true,
      transports: ['websocket'],
      auth: { tenantSlug },
    });

    const handlers = events.map((evt) => {
      const fn = (payload: Record<string, unknown>) => cbRef.current(evt, payload);
      socket.on(evt, fn);
      return [evt, fn] as const;
    });

    return () => {
      for (const [evt, fn] of handlers) socket.off(evt, fn);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, events.join('|')]);
}

export function useOrdersRealtime(
  tenantSlug: string | null | undefined,
  onEvent: (event: RealtimeEvent, payload: Record<string, unknown>) => void,
) {
  useTenantRealtime(tenantSlug, ORDER_EVENTS, onEvent);
}
