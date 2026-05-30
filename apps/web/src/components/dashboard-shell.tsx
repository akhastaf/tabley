'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  BarChart3,
  ChefHat,
  ChevronsUpDown,
  Cog,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  type LucideIcon,
  Menu as MenuIcon,
  QrCode,
  ReceiptText,
  Sofa,
  UtensilsCrossed,
  Users,
} from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { UserAvatar } from '@/components/user-avatar';
import { StaffNotifications } from '@/components/staff-notifications';
import { cn } from '@/lib/utils';

export type DashboardTab =
  | 'overview'
  | 'kpis'
  | 'floor'
  | 'orders'
  | 'kitchen'
  | 'cashier'
  | 'menu'
  | 'tables'
  | 'team'
  | 'settings';

interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  role: string;
}

interface Props {
  slug: string;
  active: DashboardTab;
  title: string;
  /** Optional inline description under the title. */
  subtitle?: ReactNode;
  /** Right-aligned action buttons (e.g. "Add item", "Public view"). */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Wraps every /manage/[slug]/* page with the dashboard chrome: a persistent
 * sidebar on desktop, a slide-out drawer on mobile, a topbar carrying the
 * tenant switcher + user menu, and a content area with title + actions.
 *
 * Pages should focus on their content; layout concerns (auth check, nav,
 * tenant context) live here so they stay consistent across tabs.
 */
export function DashboardShell({
  slug,
  active,
  title,
  subtitle,
  actions,
  children,
}: Props) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
  }, [isPending, session, router]);

  if (isPending || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop sidebar — sticky to full height */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-border bg-card md:flex md:flex-col">
        <SidebarBody slug={slug} active={active} />
      </aside>

      {/* Mobile drawer trigger lives in the topbar; sheet is rendered here. */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b border-border px-5 py-4 text-left">
            <SheetTitle className="text-base">Tabley</SheetTitle>
          </SheetHeader>
          <SidebarBody
            slug={slug}
            active={active}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <MenuIcon className="size-5" />
          </Button>
          <TenantSwitcher currentSlug={slug} />
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/r/${slug}`}
              target="_blank"
              className="hidden items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              Public view
              <ExternalLink className="size-3" />
            </Link>
            <StaffNotifications slug={slug} />
            <UserMenu
              name={session.user.name}
              email={session.user.email}
              avatarUrl={(session.user as { avatarUrl?: string | null }).avatarUrl ?? null}
              isPlatformAdmin={session.user.role === 'admin'}
            />
          </div>
        </header>

        {/* Page header (title + actions) + main content */}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="flex w-full flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                {subtitle && (
                  <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                )}
              </div>
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Sidebar body ────────────────────────────────────────────────────────────

function SidebarBody({
  slug,
  active,
  onNavigate,
}: {
  slug: string;
  active: DashboardTab;
  onNavigate?: () => void;
}) {
  const t = useTranslations('manage_nav');
  const items: { key: DashboardTab; Icon: LucideIcon; fallback: string }[] = [
    { key: 'overview', Icon: LayoutDashboard, fallback: 'Overview' },
    { key: 'kpis', Icon: BarChart3, fallback: 'Insights' },
    { key: 'floor', Icon: Sofa, fallback: 'Floor' },
    { key: 'orders', Icon: ReceiptText, fallback: 'Orders' },
    { key: 'kitchen', Icon: ChefHat, fallback: 'Kitchen' },
    { key: 'cashier', Icon: CreditCard, fallback: 'Cashier' },
    { key: 'menu', Icon: UtensilsCrossed, fallback: 'Menu' },
    { key: 'tables', Icon: QrCode, fallback: 'Tables' },
    { key: 'team', Icon: Users, fallback: 'Team' },
    { key: 'settings', Icon: Cog, fallback: 'Settings' },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="hidden px-5 py-4 md:block">
        <Link
          href="/onboarding"
          className="text-base font-semibold tracking-tight"
          onClick={onNavigate}
        >
          Tabley
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {items.map((it) => {
          let label = it.fallback;
          try {
            label = t(it.key);
          } catch {
            // missing translation key — fall back to English
          }
          const isActive = active === it.key;
          return (
            <Link
              key={it.key}
              href={`/manage/${slug}/${it.key}`}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <it.Icon className="size-4 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

// ── Tenant switcher ─────────────────────────────────────────────────────────

function TenantSwitcher({ currentSlug }: { currentSlug: string }) {
  const [tenants, setTenants] = useState<TenantSummary[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Only fetch the list when the menu opens — keeps initial page loads
  // free of an extra round-trip the user may never need.
  async function ensureLoaded() {
    if (tenants !== null || loading) return;
    setLoading(true);
    try {
      const list = await api.get<TenantSummary[]>('/v1/tenants/mine');
      setTenants(list);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const current = tenants?.find((t) => t.slug === currentSlug);
  const others = tenants?.filter((t) => t.slug !== currentSlug) ?? [];

  return (
    <DropdownMenu onOpenChange={(open) => open && void ensureLoaded()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-9 max-w-[220px] gap-2 px-3 text-sm font-medium"
        >
          <span className="truncate">{current?.name ?? currentSlug}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch restaurant</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            Loading…
          </DropdownMenuItem>
        )}
        {!loading && others.length === 0 && tenants !== null && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            No other restaurants
          </DropdownMenuItem>
        )}
        {others.map((tenant) => (
          <DropdownMenuItem key={tenant.id} asChild>
            <Link
              href={`/manage/${tenant.slug}/menu`}
              className="flex flex-col items-start gap-0.5"
            >
              <span className="text-sm font-medium">{tenant.name}</span>
              <span className="text-[11px] text-muted-foreground">
                /{tenant.slug} · {tenant.role}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding" className="text-sm">
            + Create new restaurant
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── User menu ───────────────────────────────────────────────────────────────

function UserMenu({
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

  async function handleSignOut() {
    await authClient.signOut();
    router.push('/');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full ring-2 ring-transparent transition-all hover:ring-primary/40 focus:outline-none focus-visible:ring-primary/50"
          aria-label="Account menu"
        >
          <UserAvatar size="sm" src={avatarUrl} name={name} email={email} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{name ?? 'Account'}</span>
          {email && (
            <span className="truncate text-[11px] font-normal text-muted-foreground">
              {email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
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
        <DropdownMenuItem onSelect={() => void handleSignOut()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
