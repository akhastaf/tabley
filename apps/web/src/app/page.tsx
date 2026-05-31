import Link from 'next/link';
import {
  QrCode,
  Sparkles,
  Languages,
  ChefHat,
  Users,
  BarChart3,
  Clock,
  Webhook,
  MapPin,
  Printer,
  Smartphone,
  ArrowRight,
  Check,
  Star,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleSwitcher } from '@/components/locale-switcher';

export const metadata = {
  title: 'Tabley — QR ordering, kitchen & payments for restaurants',
  description:
    'Tabley turns every table into a self-serve ordering point. QR menus, AI menu import, live kitchen and cashier boards, multi-language menus, analytics and more — one platform for your whole restaurant.',
};

const FEATURES = [
  {
    icon: QrCode,
    title: 'QR table ordering',
    body: 'Guests scan, browse the live menu, and order from their phone. No app to install, no waiting to flag a waiter.',
  },
  {
    icon: Sparkles,
    title: 'AI menu import',
    body: 'Upload a photo or PDF of your existing menu and Tabley extracts items, prices and categories for you in seconds.',
  },
  {
    icon: Languages,
    title: 'Multi-language menus',
    body: 'Offer your menu in several languages with one-click AI translation. Guests read it in their own language.',
  },
  {
    icon: ChefHat,
    title: 'Kitchen & cashier boards',
    body: 'Orders flow straight to live kitchen and cashier dashboards with real-time status — confirm, prepare, serve, pay.',
  },
  {
    icon: Users,
    title: 'Shared table sessions',
    body: 'A whole table can join one session. The host approves guests, everyone adds to the same order, you bill it once.',
  },
  {
    icon: MapPin,
    title: 'Waiter zones',
    body: 'Assign tables to waiters so each sees only their floor — cleaner screens, faster service, less stepping on toes.',
  },
  {
    icon: BarChart3,
    title: 'Analytics & KPIs',
    body: 'Revenue, order volume and period-over-period comparisons so you always know how the restaurant is trending.',
  },
  {
    icon: Clock,
    title: 'Opening hours',
    body: 'Set weekly hours per restaurant. Ordering closes automatically outside them — no more 3am surprise orders.',
  },
  {
    icon: Webhook,
    title: 'POS webhooks',
    body: 'Push every order event to your existing POS or cashier system, HMAC-signed and verifiable end to end.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Set up your menu',
    body: 'Snap a photo of your menu and let AI build it, or add items by hand. Add photos, labels, allergens and nutrition.',
  },
  {
    n: '02',
    title: 'Print your QR codes',
    body: 'Generate branded QR codes for every table — with your logo baked in — then print the stickers in one click.',
  },
  {
    n: '03',
    title: 'Start taking orders',
    body: 'Guests scan and order. Your kitchen and cashier see everything live. You watch the numbers roll in.',
  },
];

function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
      <span className="grid size-8 place-items-center rounded-lg gradient-brand text-primary-foreground">
        <QrCode className="size-4" />
      </span>
      Tabley
    </span>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#why" className="transition-colors hover:text-foreground">
              Why Tabley
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
            <Link
              href="/sign-in"
              className="hidden h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-9 items-center rounded-full gradient-brand px-4 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/30 transition-transform hover:scale-[1.02]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 gradient-warm opacity-60" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-10 -z-10 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:py-28">
          <div className="space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" />
              AI-powered menu setup in minutes
            </span>
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Turn every table into a{' '}
              <span className="text-gradient-brand">self-serve ordering point</span>
            </h1>
            <p className="max-w-xl text-pretty text-lg text-muted-foreground">
              QR ordering, a live kitchen &amp; cashier, multi-language menus, analytics and
              payments — Tabley runs your whole restaurant from one place.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex h-12 items-center gap-2 rounded-full gradient-brand px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02]"
              >
                Start free <ArrowRight className="size-4" />
              </Link>
              <a
                href="#how"
                className="inline-flex h-12 items-center rounded-full border border-border bg-background/80 px-6 text-sm font-semibold backdrop-blur transition-colors hover:bg-accent"
              >
                See how it works
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-primary" /> No app for guests
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-primary" /> Set up in minutes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-primary" /> Works on any phone
              </span>
            </div>
          </div>

          {/* Decorative phone mock */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-primary/10 blur-2xl" />
            <div className="rounded-[2.25rem] border border-border bg-card p-3 shadow-2xl">
              <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-background">
                <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Table 7
                    </p>
                    <p className="text-base font-semibold">Mamma Mia</p>
                  </div>
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <QrCode className="size-5" />
                  </span>
                </div>
                <div className="space-y-3 p-5">
                  {[
                    ['Margherita', '€9.50'],
                    ['Spaghetti Carbonara', '€12.00'],
                    ['Tiramisu', '€6.50'],
                  ].map(([name, price]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="size-9 rounded-lg bg-muted" />
                        <span className="text-sm font-medium">{name}</span>
                      </div>
                      <span className="text-sm font-semibold text-primary">{price}</span>
                    </div>
                  ))}
                  <div className="flex h-11 items-center justify-center rounded-xl gradient-brand text-sm font-semibold text-primary-foreground">
                    Place order · €28.00
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stat strip ─────────────────────────────────────────── */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 sm:grid-cols-4">
          {[
            ['4', 'languages built in'],
            ['1-tap', 'QR ordering'],
            ['Live', 'kitchen & cashier'],
            ['Minutes', 'to launch'],
          ].map(([stat, label]) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-semibold tracking-tight text-gradient-brand">
                {stat}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything your restaurant needs
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            From the first scan to the final payment — and every step the kitchen takes in
            between.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-lg"
            >
              <span className="inline-grid size-11 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:gradient-brand group-hover:text-primary-foreground">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section id="how" className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Live in three steps
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground">
              No installs, no integrations to wrangle. You could be taking orders this afternoon.
            </p>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {STEPS.map(({ n, title, body }) => (
              <div key={n} className="relative rounded-2xl border border-border bg-card p-7">
                <span className="text-4xl font-bold text-primary/30">{n}</span>
                <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Tabley (spotlights) ────────────────────────────── */}
      <section id="why" className="mx-auto max-w-6xl space-y-20 px-5 py-20 lg:py-28">
        <Spotlight
          icon={Smartphone}
          eyebrow="For guests"
          title="Ordering that feels effortless"
          body="Scan the QR, browse a beautiful menu with photos and allergens, add to cart, and order — all without flagging anyone down. Multiple people at the table can join the same session and share the experience."
          points={[
            'No app download required',
            'Menu in the guest’s language',
            'Shared table sessions with host approval',
          ]}
        />
        <Spotlight
          reverse
          icon={ChefHat}
          eyebrow="For your team"
          title="The whole floor, on one screen"
          body="Orders land instantly on live kitchen and cashier boards. Waiters see only their assigned zones. Staff get notified the moment a guest joins a table, so nothing slips."
          points={[
            'Real-time kitchen & cashier dashboards',
            'Waiter zones & table assignment',
            'Instant new-order and join alerts',
          ]}
        />
        <Spotlight
          icon={Printer}
          eyebrow="For owners"
          title="Branded, print-ready, data-rich"
          body="Drop your logo into every QR code, print table stickers in a click, gate ordering to your opening hours, and track revenue with period comparisons — then pipe it all into your POS."
          points={[
            'Logo-branded QR codes & printable stickers',
            'Opening-hours ordering control',
            'Analytics, KPIs & POS webhooks',
          ]}
        />
      </section>

      {/* ── CTA band ───────────────────────────────────────────── */}
      <section className="px-5 pb-20 lg:pb-28">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl gradient-brand px-8 py-14 text-center text-primary-foreground">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              background:
                'radial-gradient(50% 80% at 80% 0%, white 0%, transparent 60%), radial-gradient(40% 70% at 10% 100%, white 0%, transparent 60%)',
            }}
          />
          <div className="relative">
            <div className="mb-4 flex justify-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-5 fill-current" />
              ))}
            </div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to modernise your restaurant?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-primary-foreground/90">
              Set up your menu, print your QR codes, and start taking orders today.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-background px-6 text-sm font-semibold text-foreground transition-opacity hover:opacity-90"
              >
                Create your restaurant <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex h-12 items-center rounded-full border border-primary-foreground/30 px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 text-sm text-muted-foreground sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} Tabley. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/sign-in" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Link href="/sign-up" className="transition-colors hover:text-foreground">
              Get started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Spotlight({
  icon: Icon,
  eyebrow,
  title,
  body,
  points,
  reverse,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <div className={reverse ? 'lg:order-2' : ''}>
        <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <Icon className="size-4" />
          {eyebrow}
        </span>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h3>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">{body}</p>
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Check className="size-3" />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={reverse ? 'lg:order-1' : ''}>
        <div className="aspect-[4/3] rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6">
          <div className="grid h-full place-items-center">
            <Icon className="size-20 text-primary/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
