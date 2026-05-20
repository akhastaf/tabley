'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

type Tab = 'menu' | 'tables' | 'orders' | 'kitchen' | 'team' | 'settings' | 'floor';

export function ManageNav({ slug, active }: { slug: string; active: Tab }) {
  const t = useTranslations('manage_nav');
  const tabs: { key: Tab; href: string; fallback: string }[] = [
    { key: 'floor', href: `/manage/${slug}/floor`, fallback: 'Floor' },
    { key: 'orders', href: `/manage/${slug}/orders`, fallback: 'Orders' },
    { key: 'kitchen', href: `/manage/${slug}/kitchen`, fallback: 'Kitchen' },
    { key: 'menu', href: `/manage/${slug}/menu`, fallback: 'Menu' },
    { key: 'tables', href: `/manage/${slug}/tables`, fallback: 'Tables' },
    { key: 'team', href: `/manage/${slug}/team`, fallback: 'Team' },
    { key: 'settings', href: `/manage/${slug}/settings`, fallback: 'Settings' },
  ];
  return (
    <nav className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-card p-1 text-sm">
      {tabs.map((tab) => {
        let label = tab.fallback;
        try {
          label = t(tab.key);
        } catch {
          // Missing translation key — fall back to English. Avoids breaking the
          // nav when we add a new tab before adding its locale entries.
        }
        return (
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
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
