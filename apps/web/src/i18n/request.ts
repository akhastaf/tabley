import { getRequestConfig } from 'next-intl/server';

const SUPPORTED = ['en', 'fr', 'ar', 'es'] as const;
type Locale = (typeof SUPPORTED)[number];

export default getRequestConfig(async () => {
  const locale: Locale = 'en';
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
