import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleSwitcher } from '@/components/locale-switcher';

export default function HomePage() {
  return <HomeContent />;
}

function HomeContent() {
  const t = useTranslations('home');
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-lg font-semibold tracking-tight">{t('title')}</span>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          {t('tagline')}
        </h1>
        <div className="mt-8 flex gap-3">
          <Link
            href="/sign-in"
            className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            {t('cta_signin')}
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex h-10 items-center rounded-md border border-border px-5 text-sm font-medium transition-colors hover:bg-accent"
          >
            {t('cta_signup')}
          </Link>
        </div>
      </section>
    </main>
  );
}
