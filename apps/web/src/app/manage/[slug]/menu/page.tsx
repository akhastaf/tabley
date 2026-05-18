'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ManageNav } from '@/components/manage-nav';

interface Category {
  id: string;
  name: string;
  position: number;
}
interface Item {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  available: boolean;
}

const newCategorySchema = z.object({ name: z.string().min(1).max(80) });
const newItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  priceCents: z.coerce.number().int().nonnegative(),
});
type NewCategoryInput = z.infer<typeof newCategorySchema>;
type NewItemInput = z.infer<typeof newItemSchema>;

export default function ManageMenuPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { data: session, isPending } = authClient.useSession();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const catForm = useForm<NewCategoryInput>({ resolver: zodResolver(newCategorySchema) });
  const itemForm = useForm<NewItemInput>({ resolver: zodResolver(newItemSchema) });

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
  }, [isPending, session, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, its] = await Promise.all([
        api.get<Category[]>('/v1/manage/menu/categories', { tenantSlug: slug }),
        api.get<Item[]>('/v1/manage/menu/items', { tenantSlug: slug }),
      ]);
      setCategories(cats);
      setItems(its);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  async function createCategory(values: NewCategoryInput) {
    try {
      await api.post('/v1/manage/menu/categories', { ...values, position: categories.length }, { tenantSlug: slug });
      catForm.reset();
      toast.success('Category created');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function createItem(values: NewItemInput) {
    try {
      await api.post(
        '/v1/manage/menu/items',
        { ...values, allergens: [], available: true, position: items.length },
        { tenantSlug: slug },
      );
      itemForm.reset({ categoryId: values.categoryId, name: '', description: '', priceCents: 0 });
      toast.success('Item created');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category and all its items?')) return;
    try {
      await api.delete(`/v1/manage/menu/categories/${id}`, { tenantSlug: slug });
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function deleteItem(id: string) {
    try {
      await api.delete(`/v1/manage/menu/items/${id}`, { tenantSlug: slug });
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (isPending || !session || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Menu</h1>
          <p className="text-sm text-muted-foreground">
            Managing <span className="font-mono">{slug}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ManageNav slug={slug} active="menu" />
          <Link
            href={`/r/${slug}`}
            target="_blank"
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-accent"
          >
            Public view →
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-accent"
          >
            Switch
          </Link>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add a category</CardTitle>
          <CardDescription>Group items under a category like Coffee, Mains, Desserts.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={catForm.handleSubmit(createCategory)} className="flex gap-2">
            <Input placeholder="Category name" {...catForm.register('name')} className="max-w-sm" />
            <Button type="submit">Add</Button>
          </form>
          {catForm.formState.errors.name && (
            <p className="mt-2 text-sm text-destructive">{catForm.formState.errors.name.message}</p>
          )}
        </CardContent>
      </Card>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories yet. Add one above to start.</p>
      ) : (
        categories.map((cat) => (
          <Card key={cat.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{cat.name}</CardTitle>
                <CardDescription>{items.filter((i) => i.categoryId === cat.id).length} items</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => deleteCategory(cat.id)}>
                Delete category
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {items
                  .filter((i) => i.categoryId === cat.id)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm">
                          {(item.priceCents / 100).toFixed(2)}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => deleteItem(item.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>

              <Separator />

              <form
                onSubmit={itemForm.handleSubmit((v) => createItem({ ...v, categoryId: cat.id }))}
                className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_120px_auto]"
                onFocus={() => itemForm.setValue('categoryId', cat.id)}
              >
                <div>
                  <Label className="sr-only" htmlFor={`name-${cat.id}`}>Name</Label>
                  <Input id={`name-${cat.id}`} placeholder="Item name" {...itemForm.register('name')} />
                </div>
                <div>
                  <Label className="sr-only" htmlFor={`desc-${cat.id}`}>Description</Label>
                  <Input id={`desc-${cat.id}`} placeholder="Description (optional)" {...itemForm.register('description')} />
                </div>
                <div>
                  <Label className="sr-only" htmlFor={`price-${cat.id}`}>Price (cents)</Label>
                  <Input
                    id={`price-${cat.id}`}
                    type="number"
                    placeholder="Price in cents"
                    {...itemForm.register('priceCents')}
                  />
                </div>
                <Button type="submit">Add item</Button>
              </form>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
