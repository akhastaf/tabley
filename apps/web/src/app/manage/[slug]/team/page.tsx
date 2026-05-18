'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { ManageNav } from '@/components/manage-nav';
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
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const { data: session, isPending } = authClient.useSession();
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const form = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'waiter' },
  });

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
  }, [isPending, session, router]);

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
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function revoke(id: string) {
    if (!confirm('Revoke this invitation?')) return;
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
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">
            Invite waiters, kitchen, and cashiers. Invitations expire after 72h.
          </p>
        </div>
        <ManageNav slug={slug} active="team" />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Invite a teammate</CardTitle>
          <CardDescription>
            They&apos;ll get an email with a link to accept and join this restaurant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(invite)}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_auto]"
          >
            <div>
              <Label htmlFor="email" className="sr-only">Email</Label>
              <Input id="email" type="email" placeholder="teammate@example.com" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="role" className="sr-only">Role</Label>
              <select
                id="role"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                {...form.register('role')}
              >
                {INVITABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <Button type="submit">Send invite</Button>
          </form>
        </CardContent>
      </Card>

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
          {team?.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-3">
                <UserAvatar src={m.avatarUrl} name={m.name} email={m.email ?? m.invitedEmail} />
                <div>
                  <p className="font-medium">{m.name ?? m.email ?? m.invitedEmail ?? m.userId.slice(0, 12)}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.email && m.email !== m.invitedEmail ? `${m.email} · ` : ''}
                    joined {new Date(m.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{m.role}</span>
            </div>
          ))}
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
    </div>
  );
}
