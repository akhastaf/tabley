import Link from 'next/link';

type Tab = 'overview' | 'tenants' | 'users';

export function AdminNav({ active }: { active: Tab }) {
  const tabs: { key: Tab; label: string; href: string }[] = [
    { key: 'overview', label: 'Overview', href: '/admin' },
    { key: 'tenants', label: 'Tenants', href: '/admin/tenants' },
    { key: 'users', label: 'Users', href: '/admin/users' },
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
