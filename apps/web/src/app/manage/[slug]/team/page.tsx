'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DashboardShell } from '@/components/dashboard-shell';
import { useConfirm } from '@/components/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserAvatar } from '@/components/user-avatar';

const INVITABLE_ROLES = ['manager', 'waiter', 'kitchen', 'cashier'] as const;
type InvitableRole = (typeof INVITABLE_ROLES)[number];

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  createdAt: string;
}
interface Member {
  id: string;
  userId: string;
  role: string;
  invitedEmail: string | null;
  createdAt: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}
interface TeamResponse {
  pending: Invitation[];
  members: Member[];
}

const inviteSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(INVITABLE_ROLES),
});
type InviteInput = z.infer<typeof inviteSchema>;

export default function TeamPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = authClient.useSession();
  const confirmDialog = useConfirm();
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  const form = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'waiter' },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await api.get<TeamResponse>('/v1/manage/team', { tenantSlug: slug });
      setTeam(t);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  async function invite(values: InviteInput) {
    try {
      await api.post('/v1/manage/team/invite', values, { tenantSlug: slug });
      form.reset({ email: '', role: values.role });
      toast.success(`Invitation sent to ${values.email}`);
      setInviteOpen(false);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function revoke(id: string) {
    const ok = await confirmDialog({
      title: 'Revoke this invitation?',
      description: 'The pending teammate will no longer be able to use their invite link.',
      confirmLabel: 'Revoke',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/v1/manage/team/invite/${id}`, { tenantSlug: slug });
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function copyLink(token: string) {
    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success('Invite link copied');
  }

  async function changeRole(memberId: string, role: InvitableRole) {
    // Optimistic — reflect the new role immediately, roll back on failure.
    setTeam((prev) =>
      prev
        ? { ...prev, members: prev.members.map((m) => (m.id === memberId ? { ...m, role } : m)) }
        : prev,
    );
    try {
      await api.patch(`/v1/manage/team/members/${memberId}/role`, { role }, { tenantSlug: slug });
      toast.success('Role updated');
    } catch (err) {
      toast.error((err as Error).message);
      await load();
    }
  }

  async function removeMember(memberId: string, label: string) {
    const ok = await confirmDialog({
      title: `Remove ${label}?`,
      description:
        'They lose access to this restaurant immediately, and any tables in their zone become unassigned.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/v1/manage/team/members/${memberId}`, { tenantSlug: slug });
      toast.success('Member removed');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <DashboardShell
      slug={slug}
      active="team"
      title="Team"
      subtitle="Invite teammates, change their role, or remove them. Invitations expire after 72h."
      actions={<Button onClick={() => setInviteOpen(true)}>+ Invite teammate</Button>}
    >
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {team && team.pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>{team.pending.length} waiting to be accepted</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {team.pending.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.role} · expires {new Date(inv.expiresAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyLink(inv.token)}>
                    Copy link
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => revoke(inv.id)}>
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Current team</CardTitle>
          <CardDescription>
            {team?.members.length ?? 0} member{(team?.members.length ?? 0) === 1 ? '' : 's'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {team?.members.map((m) => {
            const isSelf = m.userId === session?.user.id;
            const editableRole = (INVITABLE_ROLES as readonly string[]).includes(m.role);
            const label = m.name ?? m.email ?? m.invitedEmail ?? 'this member';
            return (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar src={m.avatarUrl} name={m.name} email={m.email ?? m.invitedEmail} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {m.name ?? m.email ?? m.invitedEmail ?? m.userId.slice(0, 12)}
                      {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.email && m.email !== m.invitedEmail ? `${m.email} · ` : ''}
                      joined {new Date(m.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editableRole ? (
                    <Select
                      value={m.role}
                      onValueChange={(v) => changeRole(m.id, v as InvitableRole)}
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INVITABLE_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{m.role}</span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeMember(m.id, label)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
          {team && team.members.length === 0 && (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          )}
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Without a RESEND_API_KEY in the API env, invitation emails are logged to the API console
        instead of being sent. Use the “Copy link” button above to share invites manually.
      </p>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              They&apos;ll get an email with a link to accept and join this restaurant.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(invite)} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoFocus
                placeholder="teammate@example.com"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={form.watch('role')}
                onValueChange={(v) => form.setValue('role', v as InvitableRole)}
              >
                <SelectTrigger id="role" className="w-full">
                  <SelectValue placeholder="Pick a role" />
                </SelectTrigger>
                <SelectContent>
                  {INVITABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Send invite</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
