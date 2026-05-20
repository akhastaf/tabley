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
  | 'menu.import.failed'
  | 'waiter.called';

export const ORDER_EVENTS: RealtimeEvent[] = [
  'order.created',
  'order.confirmed',
  'order.ready',
  'order.served',
  'order.paid',
  'order.cancelled',
];

export const STAFF_EVENTS: RealtimeEvent[] = [...ORDER_EVENTS, 'waiter.called'];

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
      auth: { mode: 'staff', tenantSlug },
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
  useTenantRealtime(tenantSlug, STAFF_EVENTS, onEvent);
}

export type SessionRealtimeEvent =
  | 'session.participant.pending'
  | 'session.participant.approved'
  | 'session.participant.removed'
  | 'session.participant.left'
  | 'session.closed'
  | 'order.created'
  | 'order.confirmed'
  | 'order.ready'
  | 'order.served'
  | 'order.paid'
  | 'order.cancelled';

const SESSION_EVENTS: SessionRealtimeEvent[] = [
  'session.participant.pending',
  'session.participant.approved',
  'session.participant.removed',
  'session.participant.left',
  'session.closed',
  'order.created',
  'order.confirmed',
  'order.ready',
  'order.served',
  'order.paid',
  'order.cancelled',
];

export function useSessionRealtime(
  sessionId: string | null,
  onEvent: (event: SessionRealtimeEvent, payload: Record<string, unknown>) => void,
) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!sessionId) return;
    const socket: Socket = io(`${API_URL}/orders`, {
      transports: ['websocket'],
      withCredentials: true,
      auth: { mode: 'session', sessionId, deviceId: 'cookie' },
    });
    const handlers = SESSION_EVENTS.map((evt) => {
      const fn = (payload: Record<string, unknown>) => cbRef.current(evt, payload);
      socket.on(evt, fn);
      return [evt, fn] as const;
    });
    return () => {
      for (const [evt, fn] of handlers) socket.off(evt, fn);
      socket.disconnect();
    };
  }, [sessionId]);
}

export function usePublicOrderRealtime(
  args: { orderId: string | null; tableToken: string | null },
  onEvent: (event: RealtimeEvent, payload: Record<string, unknown>) => void,
) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;
  const { orderId, tableToken } = args;

  useEffect(() => {
    if (!orderId || !tableToken) return;
    const socket: Socket = io(`${API_URL}/orders`, {
      transports: ['websocket'],
      auth: { mode: 'public', orderId, tableToken },
    });

    const handlers = ORDER_EVENTS.map((evt) => {
      const fn = (payload: Record<string, unknown>) => cbRef.current(evt, payload);
      socket.on(evt, fn);
      return [evt, fn] as const;
    });

    return () => {
      for (const [evt, fn] of handlers) socket.off(evt, fn);
      socket.disconnect();
    };
  }, [orderId, tableToken]);
}
