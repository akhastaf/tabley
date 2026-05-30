'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/user-avatar';
import { LocaleSwitcher } from '@/components/locale-switcher';

/**
 * Slim chrome for pages outside the tenant dashboard (onboarding, account,
 * security). Provides a logo, locale switcher, and user menu — but no
 * sidebar, since these pages aren't tenant-scoped.
 */
export function AppHeader({ children }: { children?: ReactNode }) {
  const { data: session } = authClient.useSession();
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:px-6">
      <Link href="/onboarding" className="text-base font-semibold tracking-tight">
        Tabley
      </Link>
      <div className="ml-auto flex items-center gap-2">
        {children}
        <LocaleSwitcher />
        {session && (
          <UserMenuButton
            name={session.user.name}
            email={session.user.email}
            avatarUrl={(session.user as { avatarUrl?: string | null }).avatarUrl ?? null}
            isPlatformAdmin={session.user.role === 'admin'}
          />
        )}
      </div>
    </header>
  );
}

function UserMenuButton({
  name,
  email,
  avatarUrl,
  isPlatformAdmin,
}: {
  name: string | null | undefined;
  email: string | null | undefined;
  avatarUrl: string | null;
  isPlatformAdmin: boolean;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="rounded-full ring-2 ring-transparent transition-all hover:ring-primary/40 focus:outline-none focus-visible:ring-primary/50"
        >
          <UserAvatar size="sm" src={avatarUrl} name={name} email={email} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{name ?? 'Account'}</span>
          {email && (
            <span className="truncate text-[11px] font-normal text-muted-foreground">{email}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding">Restaurants</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/profile">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/security">Security</Link>
        </DropdownMenuItem>
        {isPlatformAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin">Platform admin</Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await authClient.signOut();
            router.push('/');
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
