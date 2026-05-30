'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { fileToSquareJpegDataUrl } from '@/lib/image-resize';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppHeader } from '@/components/app-header';
import { UserAvatar } from '@/components/user-avatar';

const MAX_DATA_URL_BYTES = 2_500_000; // ~1.8MB binary after base64

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
      // Resize in-browser to a sane square; then ship the base64 to the API
      // which uploads it to object storage and returns a public URL.
      const dataUrl = await fileToSquareJpegDataUrl(file, 512, 0.88);
      if (dataUrl.length > MAX_DATA_URL_BYTES) {
        throw new Error('Image is too large even after resizing — try a smaller picture.');
      }
      const { url } = await api.post<{ url: string }>('/v1/uploads/avatar', { dataUrl });
      await applyAvatar(url);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function applyAvatar(avatarUrl: string) {
    const res = await (authClient.updateUser as (
      data: Record<string, unknown>,
    ) => ReturnType<typeof authClient.updateUser>)({ avatarUrl });
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
    <div className="flex min-h-screen flex-col bg-muted/30">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 md:py-10">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Account</p>
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        </div>

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
      </main>
    </div>
  );
}
