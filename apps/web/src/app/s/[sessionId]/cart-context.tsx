'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface CartItem {
  id: string;
  name: string;
  priceCents: number;
  imageUrl?: string | null;
}

export interface CartEntry {
  item: CartItem;
  quantity: number;
  /** Free-text note like "no onions". Sent as `note` on each order line. */
  note?: string;
}

interface CartContextValue {
  cart: Map<string, CartEntry>;
  totalItems: number;
  totalCents: number;
  addToCart: (item: CartItem) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  setNote: (itemId: string, note: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Holds the table-session cart. Lives at the session layout so the cart
 * survives client navigation between the menu and an item's detail page.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Map<string, CartEntry>>(new Map());

  const addToCart = useCallback((item: CartItem) => {
    setCart((c) => {
      const next = new Map(c);
      const existing = next.get(item.id);
      next.set(item.id, {
        item,
        quantity: (existing?.quantity ?? 0) + 1,
        note: existing?.note,
      });
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

  const setNote = useCallback((itemId: string, note: string) => {
    setCart((c) => {
      const next = new Map(c);
      const entry = next.get(itemId);
      if (!entry) return c;
      next.set(itemId, { ...entry, note });
      return next;
    });
  }, []);

  const clear = useCallback(() => setCart(new Map()), []);

  const totalItems = useMemo(() => {
    let total = 0;
    for (const { quantity } of cart.values()) total += quantity;
    return total;
  }, [cart]);

  const totalCents = useMemo(() => {
    let total = 0;
    for (const { item, quantity } of cart.values()) total += item.priceCents * quantity;
    return total;
  }, [cart]);

  const value = useMemo(
    () => ({ cart, totalItems, totalCents, addToCart, setQuantity, setNote, clear }),
    [cart, totalItems, totalCents, addToCart, setQuantity, setNote, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
