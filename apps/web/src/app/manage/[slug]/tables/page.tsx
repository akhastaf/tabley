'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ManageNav } from '@/components/manage-nav';

interface Table {
  id: string;
  label: string;
  capacity: number;
  tokenHash: string;
  isActive: boolean;
}

const newTableSchema = z.object({
  label: z.string().min(1).max(40),
  capacity: z.coerce.number().int().positive().max(40),
});
type NewTableInput = z.infer<typeof newTableSchema>;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3010';

export default function ManageTablesPage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const { data: session, isPending } = authClient.useSession();

  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  const form = useForm<NewTableInput>({
    resolver: zodResolver(newTableSchema),
    defaultValues: { label: '', capacity: 4 },
  });

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
  }, [isPending, session, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.get<Table[]>('/v1/manage/tables', { tenantSlug: slug });
      setTables(list);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  async function createTable(values: NewTableInput) {
    try {
      await api.post('/v1/manage/tables', values, { tenantSlug: slug });
      form.reset({ label: '', capacity: 4 });
      toast.success('Table created');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function rotate(id: string) {
    try {
      await api.post(`/v1/manage/tables/${id}/rotate`, {}, { tenantSlug: slug });
      toast.success('Token rotated — print the new QR');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this table?')) return;
    try {
      await api.delete(`/v1/manage/tables/${id}`, { tenantSlug: slug });
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
          <h1 className="text-2xl font-semibold tracking-tight">Tables</h1>
          <p className="text-sm text-muted-foreground">
            Generate a QR code for each table. Customers scan and order from their phone.
          </p>
        </div>
        <ManageNav slug={slug} active="tables" />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add a table</CardTitle>
          <CardDescription>You can rotate the token later if a sticker is compromised.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(createTable)}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_auto]"
          >
            <div>
              <Label htmlFor="label" className="sr-only">Label</Label>
              <Input id="label" placeholder="Table label e.g. T1, Patio 3" {...form.register('label')} />
            </div>
            <div>
              <Label htmlFor="capacity" className="sr-only">Capacity</Label>
              <Input id="capacity" type="number" placeholder="Capacity" {...form.register('capacity')} />
            </div>
            <Button type="submit">Create</Button>
          </form>
        </CardContent>
      </Card>

      {tables.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tables yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tables.map((t) => {
            const url = `${APP_URL}/r/${slug}/t/${t.tokenHash}`;
            return (
              <Card key={t.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{t.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      seats {t.capacity}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-4">
                    <div className="rounded-md bg-white p-2">
                      <QRCodeSVG value={url} size={128} level="M" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="break-all font-mono text-xs text-muted-foreground">{url}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => rotate(t.id)}>
                          Rotate token
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(t.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
