'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { UserAvatar } from '@/components/user-avatar';

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
  const t = useTranslations('onboarding');
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
    <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      {/* Soft decorative gradient behind the header */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 gradient-warm opacity-50"
      />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/account/profile"
            aria-label="Edit profile"
            className="rounded-full ring-2 ring-transparent transition-all hover:ring-primary/40"
          >
            <UserAvatar
              size="lg"
              src={(session.user as { avatarUrl?: string | null }).avatarUrl}
              name={session.user.name}
              email={session.user.email}
            />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('signed_in_as', { email: session.user.email })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LocaleSwitcher />
          <Link
            href="/account/profile"
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-accent"
          >
            Profile
          </Link>
          <Link
            href="/account/security"
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-accent"
          >
            {t('security')}
          </Link>
          {session.user.role === 'admin' && (
            <Link
              href="/admin"
              className="inline-flex h-9 items-center rounded-md border border-primary px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              {t('platform_admin')}
            </Link>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              await authClient.signOut();
              router.push('/');
            }}
          >
            {t('sign_out')}
          </Button>
        </div>
      </header>

      {tenants && tenants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('open_existing_title')}</CardTitle>
            <CardDescription>
              {t('open_existing_description', { count: tenants.length })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tenants.map((tenant) => (
              <Link
                key={tenant.id}
                href={`/manage/${tenant.slug}/menu`}
                className="flex items-center justify-between rounded-md border border-border px-4 py-3 transition-colors hover:bg-accent"
              >
                <div>
                  <p className="font-medium">{tenant.name}</p>
                  <p className="text-xs text-muted-foreground">
                    /{tenant.slug} · {tenant.role}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{t('manage')}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>{t('create_title')}</CardTitle>
          <CardDescription>{t('create_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('restaurant_name')}</Label>
              <Input id="name" {...register('name')} placeholder="Cafe del Sol" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">{t('slug')}</Label>
              <Input id="slug" {...register('slug')} placeholder="cafe-del-sol" />
              <p className="text-xs text-muted-foreground">{t('slug_hint')}</p>
              {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('creating') : t('create_button')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
