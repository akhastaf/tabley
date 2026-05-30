'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { ItemDetailView, type MenuItemDetailData } from '@/components/item-detail-view';
import { useCart } from '../../cart-context';

interface PublicMenu {
  tenant: { id: string; slug: string; name: string };
  categories: Array<{ id: string; name: string; items: MenuItemDetailData[] }>;
}

export default function SessionItemPage() {
  const { sessionId, itemId } = useParams<{ sessionId: string; itemId: string }>();
  const tCommon = useTranslations('common');
  const { cart, addToCart, setQuantity } = useCart();

  const [item, setItem] = useState<MenuItemDetailData | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.get<{ tenantSlug: string | null }>(
          `/v1/public/sessions/${sessionId}`,
        );
        if (!s.tenantSlug) {
          if (!cancelled) setMissing(true);
          return;
        }
        const menu = await api.get<PublicMenu>(`/v1/public/r/${s.tenantSlug}/menu`);
        const found =
          menu.categories.flatMap((c) => c.items).find((i) => i.id === itemId) ?? null;
        if (cancelled) return;
        if (found) setItem(found);
        else setMissing(true);
      } catch {
        if (!cancelled) setMissing(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, itemId]);

  if (missing) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-muted-foreground">This item is no longer available.</p>
        <Link
          href={`/s/${sessionId}`}
          className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent"
        >
          {tCommon('back')}
        </Link>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
      </main>
    );
  }

  const entry = cart.get(item.id);
  const quantity = entry?.quantity ?? 0;

  return (
    <ItemDetailView
      item={item}
      backHref={`/s/${sessionId}`}
      quantity={quantity}
      onAdd={() => addToCart(item)}
      onIncrement={() => setQuantity(item.id, quantity + 1)}
      onDecrement={() => setQuantity(item.id, quantity - 1)}
    />
  );
}
