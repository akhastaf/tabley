'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLocaleCookie } from '@/i18n/actions';
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from '@/i18n/config';

export function LocaleSwitcher({ className }: { className?: string }) {
  const current = useLocale() as Locale;
  const t = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    if (next === current) return;
    startTransition(async () => {
      await setLocaleCookie(next);
      router.refresh();
    });
  }

  return (
    <label className={'flex items-center gap-2 text-sm text-muted-foreground ' + (className ?? '')}>
      <span className="sr-only">{t('language')}</span>
      <select
        aria-label={t('language')}
        value={current}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        className="h-9 rounded-md border border-border bg-background px-2 text-sm"
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
