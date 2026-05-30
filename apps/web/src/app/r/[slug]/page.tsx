import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { NutritionInfo } from '@tabley/shared';
import { MenuBrowseList } from './menu-list';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
interface DayHours {
  closed: boolean;
  open: string;
  close: string;
}
type OpeningHours = Record<DayKey, DayHours>;

interface PublicMenu {
  tenant: {
    id: string;
    slug: string;
    name: string;
    locale: string;
    deliveryEnabled?: boolean;
    logoUrl?: string | null;
    addressLine?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
    websiteUrl?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    timezone?: string | null;
    openingHours?: OpeningHours | null;
    openNow?: boolean;
    openReason?: 'no_hours_today' | 'before_open' | 'after_close' | null;
  };
  languages?: Array<{ code: string; name: string }>;
  activeLang?: string;
  categories: Array<{
    id: string;
    name: string;
    position: number;
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      priceCents: number;
      imageUrl: string | null;
      allergens: string[];
      labels: string[];
      nutrition: NutritionInfo | null;
    }>;
  }>;
}

async function fetchPublicMenu(slug: string): Promise<PublicMenu | null> {
  const apiUrl =
    process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3011';
  const res = await fetch(`${apiUrl}/v1/public/r/${encodeURIComponent(slug)}/menu`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load menu (${res.status})`);
  return (await res.json()) as PublicMenu;
}

function formatAddress(t: PublicMenu['tenant']): string | null {
  const parts = [t.addressLine, [t.postalCode, t.city].filter(Boolean).join(' '), t.country]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function buildOsmEmbed(lat: number, lng: number): string {
  const dLat = 0.003;
  const dLng = 0.005;
  const bbox = `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABEL: Record<DayKey, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [menu, t] = await Promise.all([fetchPublicMenu(slug), getTranslations('public_menu')]);
  if (!menu) notFound();

  const tenant = menu.tenant;
  const address = formatAddress(tenant);
  const hasMap = tenant.latitude != null && tenant.longitude != null;
  // If openingHours is not configured, openNow comes back as `true` from the
  // server — i.e. don't gate ordering. The badge is only shown when hours
  // exist, so tenants without a schedule see no banner at all.
  const hasHours = !!tenant.openingHours;
  const isOpen = tenant.openNow !== false;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {tenant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt=""
              className="size-14 shrink-0 rounded-xl border border-border object-cover"
            />
          ) : null}
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {tenant.slug}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">{tenant.name}</h1>
            {hasHours && (
              <span
                className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  isOpen
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                }`}
              >
                {isOpen ? 'Open now' : 'Closed now'}
              </span>
            )}
          </div>
        </div>
        {tenant.deliveryEnabled && isOpen && (
          <Link
            href={`/r/${slug}/delivery`}
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            {t('delivery_cta')}
          </Link>
        )}
      </header>

      {hasHours && !isOpen && (
        <div className="mb-6 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200">
          We&apos;re closed right now — ordering will be available again during opening hours.
        </div>
      )}

      {(address || tenant.phone || tenant.email || tenant.websiteUrl || hasMap || hasHours) && (
        <section className="mb-8 grid gap-4 rounded-xl border border-border bg-card p-4 text-sm">
          {address && (
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Address</div>
              <div className="mt-1">{address}</div>
              {hasMap && (
                <div className="mt-1 flex gap-3 text-xs">
                  <a
                    className="underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://www.google.com/maps/search/?api=1&query=${tenant.latitude},${tenant.longitude}`}
                  >
                    Google Maps
                  </a>
                  <a
                    className="underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://www.openstreetmap.org/?mlat=${tenant.latitude}&mlon=${tenant.longitude}#map=18/${tenant.latitude}/${tenant.longitude}`}
                  >
                    OpenStreetMap
                  </a>
                </div>
              )}
            </div>
          )}

          {(tenant.phone || tenant.email || tenant.websiteUrl) && (
            <div className="grid gap-1">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Contact</div>
              {tenant.phone && (
                <a href={`tel:${tenant.phone}`} className="hover:underline">
                  {tenant.phone}
                </a>
              )}
              {tenant.email && (
                <a href={`mailto:${tenant.email}`} className="hover:underline">
                  {tenant.email}
                </a>
              )}
              {tenant.websiteUrl && (
                <a
                  href={tenant.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {tenant.websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          )}

          {hasHours && (
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Opening hours
              </div>
              <ul className="mt-1 grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
                {DAY_KEYS.map((d) => {
                  const row = tenant.openingHours![d];
                  return (
                    <li key={d} className="flex justify-between">
                      <span className="font-medium">{DAY_LABEL[d]}</span>
                      <span className="font-mono text-muted-foreground">
                        {row.closed ? 'Closed' : `${row.open} – ${row.close}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {hasMap && (
            <div className="overflow-hidden rounded-lg border border-border">
              <iframe
                title="Map"
                src={buildOsmEmbed(tenant.latitude!, tenant.longitude!)}
                className="block h-56 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          )}
        </section>
      )}

      {menu.categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('menu_being_prepared')}</p>
      ) : (
        <MenuBrowseList
          slug={slug}
          categories={menu.categories}
          languages={menu.languages ?? []}
          initialLang={menu.activeLang ?? menu.tenant.locale}
        />
      )}
    </main>
  );
}
