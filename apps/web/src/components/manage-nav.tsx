import Link from 'next/link';

type Tab = 'menu' | 'tables' | 'orders' | 'kitchen' | 'team' | 'settings';

export function ManageNav({ slug, active }: { slug: string; active: Tab }) {
  const tabs: { key: Tab; label: string; href: string }[] = [
    { key: 'menu', label: 'Menu', href: `/manage/${slug}/menu` },
    { key: 'tables', label: 'Tables', href: `/manage/${slug}/tables` },
    { key: 'orders', label: 'Orders', href: `/manage/${slug}/orders` },
    { key: 'kitchen', label: 'Kitchen', href: `/manage/${slug}/kitchen` },
    { key: 'team', label: 'Team', href: `/manage/${slug}/team` },
    { key: 'settings', label: 'Settings', href: `/manage/${slug}/settings` },
  ];
  return (
    <nav className="flex items-center gap-1 rounded-md border border-border bg-card p-1 text-sm">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={
            'rounded px-3 py-1.5 transition-colors ' +
            (active === t.key
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground')
          }
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
