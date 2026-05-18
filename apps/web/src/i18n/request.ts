import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config';

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieValue = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE;
  const messages = (await import(`./messages/${locale}.json`)).default;
  return { locale, messages };
});
