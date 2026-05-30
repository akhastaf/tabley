'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALE_COOKIE, LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from '@/i18n/config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function LocaleSwitcher({ className }: { className?: string }) {
  const current = useLocale() as Locale;
  const t = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    if (next === current) return;
    // Set the locale cookie directly on the client (it isn't httpOnly) instead
    // of via a Server Action. Server Actions throw UnrecognizedActionError when
    // the dev server's action key rotates (e.g. after a restart) while a stale
    // tab still references the old action id. router.refresh() then re-renders
    // the server tree so the layout dir/lang and messages pick up the new value.
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${oneYear}; samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Select value={current} onValueChange={change} disabled={pending}>
      <SelectTrigger
        aria-label={t('language')}
        size="sm"
        className={'min-w-[110px] ' + (className ?? '')}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((code) => (
          <SelectItem key={code} value={code}>
            {LOCALE_LABELS[code]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
