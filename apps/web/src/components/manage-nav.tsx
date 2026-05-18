import Link from 'next/link';

export function ManageNav({ slug, active }: { slug: string; active: 'menu' | 'tables' | 'orders' }) {
  const tabs = [
    { key: 'menu' as const, label: 'Menu', href: `/manage/${slug}/menu` },
    { key: 'tables' as const, label: 'Tables', href: `/manage/${slug}/tables` },
    { key: 'orders' as const, label: 'Orders', href: `/manage/${slug}/orders` },
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
