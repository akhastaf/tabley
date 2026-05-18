'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3011';

export type OrderEvent =
  | 'order.created'
  | 'order.confirmed'
  | 'order.ready'
  | 'order.served'
  | 'order.paid'
  | 'order.cancelled';

export const ALL_ORDER_EVENTS: OrderEvent[] = [
  'order.created',
  'order.confirmed',
  'order.ready',
  'order.served',
  'order.paid',
  'order.cancelled',
];

export interface OrderEventPayload {
  id: string;
  status: string;
  tableId?: string | null;
  totalCents?: number;
  confirmedAt?: string | null;
}

export function useOrdersRealtime(
  tenantSlug: string | null | undefined,
  onAny: (event: OrderEvent, payload: OrderEventPayload) => void,
) {
  const cbRef = useRef(onAny);
  cbRef.current = onAny;

  useEffect(() => {
    if (!tenantSlug) return;

    const socket: Socket = io(`${API_URL}/orders`, {
      withCredentials: true,
      transports: ['websocket'],
      auth: { tenantSlug },
    });

    const handlers = ALL_ORDER_EVENTS.map((evt) => {
      const fn = (payload: OrderEventPayload) => cbRef.current(evt, payload);
      socket.on(evt, fn);
      return [evt, fn] as const;
    });

    return () => {
      for (const [evt, fn] of handlers) socket.off(evt, fn);
      socket.disconnect();
    };
  }, [tenantSlug]);
}
