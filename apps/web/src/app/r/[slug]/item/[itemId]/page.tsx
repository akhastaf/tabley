import { notFound } from 'next/navigation';
import { ItemDetailView, type MenuItemDetailData } from '@/components/item-detail-view';

interface PublicMenu {
  tenant: { id: string; slug: string; name: string };
  categories: Array<{ id: string; name: string; items: MenuItemDetailData[] }>;
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

export default async function BrowseItemPage({
  params,
}: {
  params: Promise<{ slug: string; itemId: string }>;
}) {
  const { slug, itemId } = await params;
  const menu = await fetchPublicMenu(slug);
  if (!menu) notFound();
  const item = menu.categories.flatMap((c) => c.items).find((i) => i.id === itemId);
  if (!item) notFound();

  return <ItemDetailView item={item} backHref={`/r/${slug}`} />;
}
