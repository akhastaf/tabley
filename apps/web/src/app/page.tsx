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
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Decorative gradient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 gradient-warm opacity-60"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-20 -z-10 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 bottom-10 -z-10 h-96 w-96 rounded-full bg-accent/40 blur-3xl"
      />

      <header className="flex items-center justify-between border-b border-border/60 bg-background/60 px-6 py-4 backdrop-blur">
        <span className="text-lg font-semibold tracking-tight">
          <span className="text-gradient-brand">{t('title')}</span>
        </span>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t('title')}
        </span>
        <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
          {t('tagline')}
        </h1>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="inline-flex h-11 items-center justify-center rounded-full gradient-brand px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02]"
          >
            {t('cta_signup')}
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background/80 px-6 text-sm font-medium backdrop-blur transition-colors hover:bg-accent"
          >
            {t('cta_signin')}
          </Link>
        </div>
      </section>
    </main>
  );
}
