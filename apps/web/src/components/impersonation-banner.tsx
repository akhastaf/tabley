'use client';

import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';

export function ImpersonationBanner() {
  const { data: session } = authClient.useSession();
  const impersonatedBy = (session?.session as { impersonatedBy?: string | null } | undefined)
    ?.impersonatedBy;
  if (!impersonatedBy) return null;

  async function stop() {
    const res = await authClient.admin.stopImpersonating();
    if (res.error) {
      toast.error(res.error.message ?? 'Failed to stop impersonation');
      return;
    }
    window.location.href = '/admin/users';
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-yellow-500/15 px-4 py-2 text-sm text-yellow-800 dark:text-yellow-200">
      <span>
        ⚠️ You are impersonating <strong>{session?.user.email}</strong>
      </span>
      <button
        onClick={() => void stop()}
        className="rounded-md border border-yellow-600/40 px-2 py-1 text-xs font-medium hover:bg-yellow-500/20"
      >
        Stop impersonating
      </button>
    </div>
  );
}
