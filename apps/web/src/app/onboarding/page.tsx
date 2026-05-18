'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  role: string;
}

const createTenantSchema = z.object({
  name: z.string().min(1).max(160),
  slug: z
    .string()
    .min(3)
    .max(62)
    .regex(/^[a-z0-9][a-z0-9-]{1,60}[a-z0-9]$/, 'Lowercase letters, digits, dashes only'),
});
type CreateTenantInput = z.infer<typeof createTenantSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [tenants, setTenants] = useState<TenantSummary[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateTenantInput>({ resolver: zodResolver(createTenantSchema) });

  useEffect(() => {
    if (!isPending && !session) {
      router.replace('/sign-in');
    }
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session) return;
    api
      .get<TenantSummary[]>('/v1/tenants/mine')
      .then(setTenants)
      .catch((err: Error) => toast.error(err.message));
  }, [session]);

  async function onCreate(values: CreateTenantInput) {
    setSubmitting(true);
    try {
      const created = await api.post<TenantSummary>('/v1/tenants', values);
      toast.success(`Created ${created.name}`);
      reset();
      router.push(`/manage/${created.slug}/menu`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (isPending || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your restaurants</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {session.user.email}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session.user.role === 'admin' && (
            <Link
              href="/admin"
              className="inline-flex h-9 items-center rounded-md border border-primary px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              Platform admin
            </Link>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              await authClient.signOut();
              router.push('/');
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      {tenants && tenants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Open an existing restaurant</CardTitle>
            <CardDescription>You are a member of {tenants.length} restaurant(s).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tenants.map((t) => (
              <Link
                key={t.id}
                href={`/manage/${t.slug}/menu`}
                className="flex items-center justify-between rounded-md border border-border px-4 py-3 transition-colors hover:bg-accent"
              >
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    /{t.slug} · {t.role}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">Manage →</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Create a new restaurant</CardTitle>
          <CardDescription>You will be the manager. You can invite staff later.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Restaurant name</Label>
              <Input id="name" {...register('name')} placeholder="Cafe del Sol" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" {...register('slug')} placeholder="cafe-del-sol" />
              <p className="text-xs text-muted-foreground">
                Used in the public URL: tabley.app/r/<span className="font-mono">{`<slug>`}</span>
              </p>
              {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create restaurant'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
