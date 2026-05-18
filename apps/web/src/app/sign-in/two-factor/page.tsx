'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const totpSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') });
const backupSchema = z.object({ code: z.string().min(4).max(40) });
type TotpInput = z.infer<typeof totpSchema>;
type BackupInput = z.infer<typeof backupSchema>;

export default function TwoFactorVerifyPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'totp' | 'backup'>('totp');

  const totpForm = useForm<TotpInput>({ resolver: zodResolver(totpSchema) });
  const backupForm = useForm<BackupInput>({ resolver: zodResolver(backupSchema) });

  async function verifyTotp(values: TotpInput) {
    setSubmitting(true);
    const res = await authClient.twoFactor.verifyTotp({ code: values.code });
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error.message ?? 'Invalid code');
      return;
    }
    toast.success('Signed in');
    router.replace('/onboarding');
  }

  async function verifyBackup(values: BackupInput) {
    setSubmitting(true);
    const res = await authClient.twoFactor.verifyBackupCode({ code: values.code });
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error.message ?? 'Invalid backup code');
      return;
    }
    toast.success('Signed in with backup code');
    router.replace('/onboarding');
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Two-factor verification</CardTitle>
          <CardDescription>
            {mode === 'totp'
              ? 'Enter the 6-digit code from your authenticator app.'
              : 'Enter one of your saved backup codes.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === 'totp' ? (
            <form onSubmit={totpForm.handleSubmit(verifyTotp)} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="totp">Code</Label>
                <Input
                  id="totp"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  {...totpForm.register('code')}
                />
                {totpForm.formState.errors.code && (
                  <p className="text-sm text-destructive">{totpForm.formState.errors.code.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Verifying…' : 'Verify'}
              </Button>
            </form>
          ) : (
            <form onSubmit={backupForm.handleSubmit(verifyBackup)} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="backup">Backup code</Label>
                <Input id="backup" placeholder="abcd-efgh" {...backupForm.register('code')} />
                {backupForm.formState.errors.code && (
                  <p className="text-sm text-destructive">{backupForm.formState.errors.code.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Verifying…' : 'Use backup code'}
              </Button>
            </form>
          )}

          <Separator />

          <button
            onClick={() => setMode((m) => (m === 'totp' ? 'backup' : 'totp'))}
            className="w-full text-center text-sm text-muted-foreground hover:underline"
          >
            {mode === 'totp' ? 'Lost your device? Use a backup code' : 'Back to authenticator code'}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
