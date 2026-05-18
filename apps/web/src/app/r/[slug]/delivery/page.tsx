'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  tenant: { id: string; slug: string; name: string; deliveryEnabled?: boolean };
  categories: MenuCategory[];
}

interface CartEntry {
  item: MenuItem;
  quantity: number;
}

const addressSchema = z.object({
  recipientName: z.string().min(1).max(120),
  phone: z.string().min(4).max(40),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(120),
  postalCode: z.string().min(1).max(20),
  country: z.string().max(80).optional(),
  deliveryNotes: z.string().max(500).optional(),
});
type AddressInput = z.infer<typeof addressSchema>;

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function DeliveryOrderingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<Map<string, CartEntry>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<{ id: string; totalCents: number } | null>(null);

  const form = useForm<AddressInput>({ resolver: zodResolver(addressSchema) });

  useEffect(() => {
    api
      .get<PublicMenu>(`/v1/public/r/${slug}/menu`)
      .then((m) => {
        if (!m.tenant.deliveryEnabled) {
          setError('This restaurant does not currently accept delivery orders.');
        }
        setMenu(m);
      })
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  const totalCents = useMemo(() => {
    let t = 0;
    for (const { item, quantity } of cart.values()) t += item.priceCents * quantity;
    return t;
  }, [cart]);

  const totalItems = useMemo(() => {
    let t = 0;
    for (const { quantity } of cart.values()) t += quantity;
    return t;
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

  async function placeOrder(values: AddressInput) {
    if (cart.size === 0) {
      toast.error('Your cart is empty');
      return;
    }
    setSubmitting(true);
    try {
      const lines = Array.from(cart.values()).map(({ item, quantity }) => ({
        menuItemId: item.id,
        quantity,
      }));
      const res = await api.post<{ id: string; totalCents: number }>(
        '/v1/public/orders/delivery',
        {
          slug,
          lines,
          phone: values.phone,
          address: {
            recipientName: values.recipientName,
            line1: values.line1,
            line2: values.line2 || undefined,
            city: values.city,
            postalCode: values.postalCode,
            country: values.country || undefined,
          },
          deliveryNotes: values.deliveryNotes || undefined,
        },
      );
      setPlaced({ id: res.id, totalCents: res.totalCents });
      setCart(new Map());
      toast.success('Delivery order placed');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Delivery not available</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </main>
    );
  }
  if (!menu) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading menu…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-12 pt-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {menu.tenant.slug} · delivery
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{menu.tenant.name}</h1>
      </header>

      {placed && (
        <Card className="mb-6 border-primary">
          <CardContent className="py-4">
            <p className="text-sm font-medium">Order placed</p>
            <p className="text-xs text-muted-foreground">
              Order #{placed.id.slice(0, 8)} · total {formatPrice(placed.totalCents)}. The
              restaurant will confirm it shortly.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-8">
          {menu.categories.map((cat) => (
            <section key={cat.id}>
              <h2 className="mb-3 text-xl font-semibold tracking-tight">{cat.name}</h2>
              {cat.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items.</p>
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
                            <Button size="sm" variant="outline" onClick={() => setQuantity(item.id, entry.quantity - 1)}>−</Button>
                            <span className="w-6 text-center tabular-nums">{entry.quantity}</span>
                            <Button size="sm" variant="outline" onClick={() => setQuantity(item.id, entry.quantity + 1)}>+</Button>
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => addToCart(item)}>Add</Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Delivery details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(placeOrder)} className="space-y-3">
                <Field label="Name" error={form.formState.errors.recipientName?.message}>
                  <Input {...form.register('recipientName')} />
                </Field>
                <Field label="Phone" error={form.formState.errors.phone?.message}>
                  <Input type="tel" {...form.register('phone')} />
                </Field>
                <Field label="Address line 1" error={form.formState.errors.line1?.message}>
                  <Input {...form.register('line1')} />
                </Field>
                <Field label="Address line 2 (optional)">
                  <Input {...form.register('line2')} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="City" error={form.formState.errors.city?.message}>
                    <Input {...form.register('city')} />
                  </Field>
                  <Field label="Postal code" error={form.formState.errors.postalCode?.message}>
                    <Input {...form.register('postalCode')} />
                  </Field>
                </div>
                <Field label="Country (optional)">
                  <Input {...form.register('country')} />
                </Field>
                <Field label="Notes for the rider (optional)">
                  <Input {...form.register('deliveryNotes')} placeholder="Buzz code, leave at door…" />
                </Field>

                <Separator />

                <div className="flex items-center justify-between text-sm">
                  <span>
                    <span className="font-medium">{totalItems}</span> item{totalItems === 1 ? '' : 's'}
                  </span>
                  <span className="font-mono tabular-nums">{formatPrice(totalCents)}</span>
                </div>
                <Button type="submit" className="w-full" disabled={submitting || totalItems === 0}>
                  {submitting ? 'Placing…' : 'Place delivery order'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
