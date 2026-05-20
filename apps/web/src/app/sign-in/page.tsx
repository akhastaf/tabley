'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInSchema, type SignInInput } from '@tabley/shared';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocaleSwitcher } from '@/components/locale-switcher';

export default function SignInPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const t = useTranslations('auth');
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema) });

  async function onSubmit(values: SignInInput) {
    setSubmitting(true);
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? 'Sign in failed');
      return;
    }
    toast.success(t('welcome_back'));
    router.push(next && next.startsWith('/') ? next : '/onboarding');
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 gradient-warm">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 bottom-10 h-96 w-96 rounded-full bg-accent/40 blur-3xl"
      />
      <div className="relative w-full max-w-md space-y-3">
        <div className="flex justify-end">
          <LocaleSwitcher />
        </div>
        <Card className="border-border/60 shadow-xl shadow-primary/5 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-2xl">{t('signin_title')}</CardTitle>
            <CardDescription>{t('signin_description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input id="email" type="email" autoComplete="email" {...register('email')} className="h-11" />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register('password')}
                  className="h-11"
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>
              <Button type="submit" className="h-11 w-full rounded-full gradient-brand text-sm font-semibold shadow-md shadow-primary/30" disabled={submitting}>
                {submitting ? t('submitting_signin') : t('submit_signin')}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t('no_account')}{' '}
                <Link
                  href={next ? `/sign-up?next=${encodeURIComponent(next)}` : '/sign-up'}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t('create_one')}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
