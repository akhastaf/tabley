'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { type MenuItemDetailData } from '@/components/item-detail-view';
import { LabelIcon, labelName } from '@/lib/menu-labels';
import { api } from '@/lib/api-client';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface BrowseCategory {
  id: string;
  name: string;
  items: MenuItemDetailData[];
}

interface SearchHit {
  id: string;
  name: string;
  description: string | null;
  categoryName: string;
  priceCents: number;
}

interface MenuLanguage {
  code: string;
  name: string;
}

interface PublicMenuResponse {
  categories: BrowseCategory[];
}

export function MenuBrowseList({
  slug,
  categories: initialCategories,
  languages = [],
  initialLang,
}: {
  slug: string;
  categories: BrowseCategory[];
  languages?: MenuLanguage[];
  initialLang?: string;
}) {
  const t = useTranslations('public_menu');
  const tLabels = useTranslations('menu_detail.labels');

  const [categories, setCategories] = useState<BrowseCategory[]>(initialCategories);
  const [lang, setLang] = useState<string | undefined>(initialLang);
  const [switching, setSwitching] = useState(false);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  // When the guest switches language, refetch the menu translated server-side
  // and swap in the new category list. The base language reuses the data we
  // were given on first render.
  async function changeLang(next: string) {
    if (next === lang) return;
    setLang(next);
    if (next === initialLang) {
      setCategories(initialCategories);
      return;
    }
    setSwitching(true);
    try {
      const res = await api.get<PublicMenuResponse>(
        `/v1/public/r/${encodeURIComponent(slug)}/menu?lang=${encodeURIComponent(next)}`,
      );
      setCategories(res.categories);
    } catch {
      // Keep the current language on failure.
    } finally {
      setSwitching(false);
    }
  }

  const labelTitle = (label: string) => {
    try {
      return (tLabels as unknown as (k: string) => string)(label);
    } catch {
      return labelName(label);
    }
  };

  // Enrich search hits with the full item (image/labels) we already loaded.
  const itemsById = useMemo(() => {
    const map = new Map<string, MenuItemDetailData>();
    for (const cat of categories) for (const it of cat.items) map.set(it.id, it);
    return map;
  }, [categories]);

  const trimmed = query.trim();
  const active = trimmed.length >= 2;

  useEffect(() => {
    if (!active) {
      setHits(null);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ hits: SearchHit[] }>(
          `/v1/public/r/${encodeURIComponent(slug)}/search?q=${encodeURIComponent(trimmed)}`,
          { signal: ctrl.signal },
        );
        setHits(res.hits);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setHits([]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [active, trimmed, slug]);

  function ItemRow({ item }: { item: MenuItemDetailData }) {
    return (
      <Link
        href={`/r/${slug}/item/${item.id}`}
        className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent/40"
      >
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-16 w-16 shrink-0 rounded-xl object-cover"
          />
        )}
        <span className="flex flex-1 flex-col gap-1">
          <span className="font-medium leading-tight">{item.name}</span>
          {item.description && (
            <span className="line-clamp-2 text-sm text-muted-foreground">{item.description}</span>
          )}
          {item.labels.length > 0 && (
            <span className="mt-0.5 flex flex-wrap items-center gap-1">
              {item.labels.map((l) => (
                <LabelIcon key={l} label={l} name={labelTitle(l)} />
              ))}
            </span>
          )}
        </span>
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
          {(item.priceCents / 100).toFixed(2)}
        </span>
      </Link>
    );
  }

  // Resolve a search hit to the full local item when we have it, else fall back
  // to a minimal shape built from the Meilisearch document.
  function hitToItem(hit: SearchHit): MenuItemDetailData {
    return (
      itemsById.get(hit.id) ?? {
        id: hit.id,
        name: hit.name,
        description: hit.description,
        priceCents: hit.priceCents,
        imageUrl: null,
        allergens: [],
        labels: [],
        nutrition: null,
      }
    );
  }

  return (
    <div className="space-y-6">
      {languages.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {languages.map((l) => {
            const active = (lang ?? initialLang) === l.code;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => void changeLang(l.code)}
                disabled={switching}
                aria-pressed={active}
                className={
                  'rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-60 ' +
                  (active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent')
                }
              >
                {l.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search_placeholder')}
          aria-label={t('search_placeholder')}
          className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('search_clear')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {active ? (
        <div className="space-y-3">
          {searching && hits === null ? (
            <p className="text-sm text-muted-foreground">{t('searching')}</p>
          ) : hits && hits.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('search_no_results', { q: trimmed })}</p>
          ) : (
            <ul className="space-y-3">
              {(hits ?? []).map((hit) => (
                <li key={hit.id}>
                  <ItemRow item={hitToItem(hit)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={categories.map((c) => c.id)} className="w-full">
          {categories.map((cat) => (
            <AccordionItem key={cat.id} value={cat.id}>
              <AccordionTrigger className="text-lg">
                <span className="flex items-baseline gap-2">
                  {cat.name}
                  <span className="text-xs font-normal text-muted-foreground">
                    {cat.items.length}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {cat.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('no_items_yet')}</p>
                ) : (
                  <ul className="space-y-3">
                    {cat.items.map((item) => (
                      <li key={item.id}>
                        <ItemRow item={item} />
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
