'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { fileToSquareJpegDataUrl } from '@/lib/image-resize';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/user-avatar';

const MAX_DATA_URL_BYTES = 96_000; // ~64KB binary -> ~90KB base64

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, isPending, refetch } = authClient.useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in?next=/account/profile');
  }, [isPending, session, router]);

  useEffect(() => {
    if (session?.user.name) setName(session.user.name);
  }, [session?.user.name]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const avatarUrl = (session.user as { avatarUrl?: string | null }).avatarUrl ?? null;

  async function saveName() {
    if (!name.trim() || name === session?.user.name) return;
    setSaving(true);
    const res = await authClient.updateUser({ name: name.trim() });
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message ?? 'Could not update name');
      return;
    }
    toast.success('Name updated');
    await refetch?.();
  }

  async function uploadAvatar(file: File) {
    setAvatarBusy(true);
    try {
      const dataUrl = await fileToSquareJpegDataUrl(file, 256, 0.85);
      if (dataUrl.length > MAX_DATA_URL_BYTES) {
        // Try again at lower quality
        const downscaled = await fileToSquareJpegDataUrl(file, 192, 0.78);
        if (downscaled.length > MAX_DATA_URL_BYTES) {
          throw new Error('Image too large after resizing — try a smaller picture.');
        }
        await applyAvatar(downscaled);
        return;
      }
      await applyAvatar(dataUrl);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function applyAvatar(dataUrl: string) {
    const res = await (authClient.updateUser as (
      data: Record<string, unknown>,
    ) => ReturnType<typeof authClient.updateUser>)({ avatarUrl: dataUrl });
    if (res.error) {
      toast.error(res.error.message ?? 'Could not update avatar');
      return;
    }
    toast.success('Avatar updated');
    await refetch?.();
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    const res = await (authClient.updateUser as (
      data: Record<string, unknown>,
    ) => ReturnType<typeof authClient.updateUser>)({ avatarUrl: '' });
    setAvatarBusy(false);
    if (res.error) {
      toast.error(res.error.message ?? 'Could not remove avatar');
      return;
    }
    toast.success('Avatar removed');
    await refetch?.();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Account</p>
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/account/security"
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-accent"
          >
            Security
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-accent"
          >
            Back
          </Link>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Photo</CardTitle>
          <CardDescription>
            Your picture shows up next to your name across Tabley. It&apos;s cropped to a square and
            resized to 256×256 before uploading.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-6">
            <UserAvatar
              size="xl"
              src={avatarUrl}
              name={session.user.name}
              email={session.user.email}
            />
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAvatar(f);
                }}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarBusy}
                >
                  {avatarBusy ? 'Working…' : avatarUrl ? 'Replace' : 'Upload photo'}
                </Button>
                {avatarUrl && (
                  <Button variant="ghost" onClick={removeAvatar} disabled={avatarBusy}>
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPEG, or WebP. Max ~64KB after resize.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Name</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button onClick={saveName} disabled={saving || !name.trim() || name === session.user.name}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Email: <span className="font-mono">{session.user.email}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
