'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const passwordSchema = z.object({ password: z.string().min(1) });
const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') });
type PasswordInput = z.infer<typeof passwordSchema>;
type CodeInput = z.infer<typeof codeSchema>;

interface PendingSetup {
  totpURI: string;
  backupCodes: string[];
}

export default function SecurityPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [setup, setSetup] = useState<PendingSetup | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const enableForm = useForm<PasswordInput>({ resolver: zodResolver(passwordSchema) });
  const verifyForm = useForm<CodeInput>({ resolver: zodResolver(codeSchema) });
  const disableForm = useForm<PasswordInput>({ resolver: zodResolver(passwordSchema) });
  const regenForm = useForm<PasswordInput>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
  }, [isPending, session, router]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const enabled = (session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled === true;

  async function startEnable(values: PasswordInput) {
    const res = await authClient.twoFactor.enable({ password: values.password });
    if (res.error) {
      toast.error(res.error.message ?? 'Failed to start 2FA');
      return;
    }
    setSetup({
      totpURI: res.data.totpURI,
      backupCodes: res.data.backupCodes ?? [],
    });
  }

  async function verifyAndComplete(values: CodeInput) {
    const res = await authClient.twoFactor.verifyTotp({ code: values.code });
    if (res.error) {
      toast.error(res.error.message ?? 'Invalid code');
      return;
    }
    toast.success('Two-factor authentication enabled');
    setSetup(null);
    verifyForm.reset({ code: '' });
    router.refresh();
  }

  async function disable(values: PasswordInput) {
    const res = await authClient.twoFactor.disable({ password: values.password });
    if (res.error) {
      toast.error(res.error.message ?? 'Failed to disable 2FA');
      return;
    }
    toast.success('Two-factor authentication disabled');
    disableForm.reset({ password: '' });
    router.refresh();
  }

  async function regenerateBackup(values: PasswordInput) {
    const res = await authClient.twoFactor.generateBackupCodes({ password: values.password });
    if (res.error) {
      toast.error(res.error.message ?? 'Could not regenerate backup codes');
      return;
    }
    setBackupCodes(res.data?.backupCodes ?? []);
    regenForm.reset({ password: '' });
    toast.success('New backup codes generated — old ones are now invalid');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Account</p>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {session.user.email}.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            {enabled
              ? '2FA is on. You’ll be asked for a code after your password.'
              : 'Add a one-time code from an authenticator app to your sign-in.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!enabled && !setup && (
            <form onSubmit={enableForm.handleSubmit(startEnable)} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Confirm your password to generate a setup QR code.
              </p>
              <div className="space-y-1">
                <Label htmlFor="enable-pw">Password</Label>
                <Input
                  id="enable-pw"
                  type="password"
                  autoComplete="current-password"
                  {...enableForm.register('password')}
                />
              </div>
              <Button type="submit">Set up 2FA</Button>
            </form>
          )}

          {!enabled && setup && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                <div className="shrink-0 rounded-md bg-white p-3">
                  <QRCodeSVG value={setup.totpURI} size={160} />
                </div>
                <div className="min-w-0 flex-1 text-sm text-muted-foreground">
                  <p className="mb-2">
                    Scan with Google Authenticator, 1Password, or any TOTP app, then enter the
                    6-digit code.
                  </p>
                  <p className="break-all font-mono text-xs">{setup.totpURI}</p>
                </div>
              </div>

              {setup.backupCodes.length > 0 && (
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Backup codes — save these somewhere safe
                  </p>
                  <ul className="grid grid-cols-2 gap-1 font-mono text-sm">
                    {setup.backupCodes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <form onSubmit={verifyForm.handleSubmit(verifyAndComplete)} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="totp-code">Verification code</Label>
                  <Input
                    id="totp-code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    {...verifyForm.register('code')}
                  />
                </div>
                <Button type="submit">Verify &amp; enable</Button>
              </form>
            </div>
          )}

          {enabled && (
            <>
              <form onSubmit={disableForm.handleSubmit(disable)} className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Confirm your password to turn 2FA off.
                </p>
                <div className="space-y-1">
                  <Label htmlFor="disable-pw">Password</Label>
                  <Input
                    id="disable-pw"
                    type="password"
                    autoComplete="current-password"
                    {...disableForm.register('password')}
                  />
                </div>
                <Button variant="outline" type="submit">
                  Disable 2FA
                </Button>
              </form>

              <Separator />

              <form
                onSubmit={regenForm.handleSubmit(regenerateBackup)}
                className="space-y-3"
              >
                <p className="text-sm text-muted-foreground">
                  Lost your backup codes? Generate a new set — the old ones stop working.
                </p>
                <div className="space-y-1">
                  <Label htmlFor="regen-pw">Password</Label>
                  <Input
                    id="regen-pw"
                    type="password"
                    autoComplete="current-password"
                    {...regenForm.register('password')}
                  />
                </div>
                <Button variant="ghost" type="submit">
                  Regenerate backup codes
                </Button>
              </form>

              {backupCodes && (
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    New backup codes — save them now
                  </p>
                  <ul className="grid grid-cols-2 gap-1 font-mono text-sm">
                    {backupCodes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
