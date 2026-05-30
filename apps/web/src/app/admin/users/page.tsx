'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminNav } from '@/components/admin-nav';
import { useConfirm } from '@/components/confirm-dialog';
import { UserAvatar } from '@/components/user-avatar';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string | null;
  banned: boolean;
  banReason: string | null;
  twoFactorEnabled?: boolean;
  avatarUrl?: string | null;
  createdAt: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const confirmDialog = useConfirm();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  // Ban dialog state — userId being banned + the reason input. Lifting this
  // to component-level state lets us submit on Enter without juggling refs.
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState('');

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
    if (session && session.user.role !== 'admin') router.replace('/onboarding');
  }, [isPending, session, router]);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await authClient.admin.listUsers({
        query: {
          limit: 50,
          ...(query
            ? {
                searchField: 'email' as const,
                searchOperator: 'contains' as const,
                searchValue: query,
              }
            : {}),
        },
      });
      if (res.error) {
        toast.error(res.error.message ?? 'Failed to list users');
        setUsers([]);
      } else {
        setUsers((res.data?.users ?? []) as unknown as AdminUser[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user.role === 'admin') void load('');
  }, [session, load]);

  useEffect(() => {
    if (!session) return;
    const t = setTimeout(() => void load(q), 250);
    return () => clearTimeout(t);
  }, [q, session, load]);

  async function impersonate(userId: string) {
    const res = await authClient.admin.impersonateUser({ userId });
    if (res.error) {
      toast.error(res.error.message ?? 'Failed to impersonate');
      return;
    }
    toast.success('Now impersonating — you will be redirected');
    window.location.href = '/onboarding';
  }

  function openBan(user: AdminUser) {
    setBanTarget(user);
    setBanReason('');
  }

  async function confirmBan() {
    if (!banTarget) return;
    const res = await authClient.admin.banUser({
      userId: banTarget.id,
      banReason: banReason.trim() || undefined,
    });
    if (res.error) {
      toast.error(res.error.message ?? 'Failed to ban');
      return;
    }
    toast.success('User banned');
    setBanTarget(null);
    await load(q);
  }

  async function unban(userId: string) {
    const res = await authClient.admin.unbanUser({ userId });
    if (res.error) {
      toast.error(res.error.message ?? 'Failed to unban');
      return;
    }
    toast.success('User unbanned');
    await load(q);
  }

  async function setRole(userId: string, role: 'user' | 'admin') {
    const res = await authClient.admin.setRole({ userId, role });
    if (res.error) {
      toast.error(res.error.message ?? 'Failed to set role');
      return;
    }
    toast.success(`Role set to ${role}`);
    await load(q);
  }

  async function disableMfa(userId: string) {
    const ok = await confirmDialog({
      title: 'Disable two-factor for this user?',
      description: 'They will be able to sign in with just their password until they re-enable it.',
      confirmLabel: 'Disable 2FA',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/v1/admin/users/${userId}/two-factor`);
      toast.success('2FA disabled');
      await load(q);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (!session || session.user.role !== 'admin') return null;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Tabley admin</p>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        </div>
        <AdminNav active="users" />
      </header>

      <Input
        placeholder="Search by email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {loading && users.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">No users.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar src={u.avatarUrl} name={u.name} email={u.email} />
                  <div className="min-w-0">
                    <p className="font-medium">{u.name || u.email}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                    {u.banned && (
                      <p className="text-xs text-destructive">
                        Banned{u.banReason ? `: ${u.banReason}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-xs ' +
                      (u.role === 'admin'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-secondary text-secondary-foreground')
                    }
                  >
                    {u.role ?? 'user'}
                  </span>
                  {u.twoFactorEnabled && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                      🔐 2FA
                    </span>
                  )}
                  {u.id !== session.user.id && (
                    <Button size="sm" variant="outline" onClick={() => impersonate(u.id)}>
                      Impersonate
                    </Button>
                  )}
                  {u.role === 'admin' ? (
                    u.id !== session.user.id && (
                      <Button size="sm" variant="ghost" onClick={() => setRole(u.id, 'user')}>
                        Demote
                      </Button>
                    )
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setRole(u.id, 'admin')}>
                      Promote
                    </Button>
                  )}
                  {u.banned ? (
                    <Button size="sm" variant="ghost" onClick={() => unban(u.id)}>
                      Unban
                    </Button>
                  ) : (
                    u.id !== session.user.id && (
                      <Button size="sm" variant="ghost" onClick={() => openBan(u)}>
                        Ban
                      </Button>
                    )
                  )}
                  {u.twoFactorEnabled && (
                    <Button size="sm" variant="ghost" onClick={() => disableMfa(u.id)}>
                      Disable 2FA
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={banTarget !== null} onOpenChange={(open) => !open && setBanTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban {banTarget?.name || banTarget?.email}</DialogTitle>
            <DialogDescription>
              They will be signed out and unable to access Tabley until unbanned.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void confirmBan();
            }}
            className="space-y-3"
          >
            <div className="space-y-2">
              <Label htmlFor="ban-reason">Reason (optional)</Label>
              <Input
                id="ban-reason"
                autoFocus
                placeholder="e.g. abuse, spam"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setBanTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive">
                Ban user
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
