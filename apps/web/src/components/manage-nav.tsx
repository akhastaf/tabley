'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

type Tab = 'menu' | 'tables' | 'orders' | 'kitchen' | 'team' | 'settings';

export function ManageNav({ slug, active }: { slug: string; active: Tab }) {
  const t = useTranslations('manage_nav');
  const tabs: { key: Tab; href: string }[] = [
    { key: 'menu', href: `/manage/${slug}/menu` },
    { key: 'tables', href: `/manage/${slug}/tables` },
    { key: 'orders', href: `/manage/${slug}/orders` },
    { key: 'kitchen', href: `/manage/${slug}/kitchen` },
    { key: 'team', href: `/manage/${slug}/team` },
    { key: 'settings', href: `/manage/${slug}/settings` },
  ];
  return (
    <nav className="flex items-center gap-1 rounded-md border border-border bg-card p-1 text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={
            'rounded px-3 py-1.5 transition-colors ' +
            (active === tab.key
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground')
          }
        >
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}
