import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

interface PublicMenu {
  tenant: { id: string; slug: string; name: string; locale: string; deliveryEnabled?: boolean };
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

export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [menu, t] = await Promise.all([fetchPublicMenu(slug), getTranslations('public_menu')]);
  if (!menu) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {menu.tenant.slug}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{menu.tenant.name}</h1>
        </div>
        {menu.tenant.deliveryEnabled && (
          <Link
            href={`/r/${slug}/delivery`}
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            {t('delivery_cta')}
          </Link>
        )}
      </header>

      {menu.categories.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('menu_being_prepared')}</p>
      )}

      <div className="space-y-10">
        {menu.categories.map((cat) => (
          <section key={cat.id}>
            <h2 className="mb-3 text-xl font-semibold tracking-tight">{cat.name}</h2>
            {cat.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('no_items_yet')}</p>
            ) : (
              <ul className="space-y-3">
                {cat.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-4 border-b border-border pb-3">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      {item.description && (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      )}
                      {item.allergens.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('allergens', { list: item.allergens.join(', ') })}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-sm tabular-nums">
                      {(item.priceCents / 100).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
