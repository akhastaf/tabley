'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { LabelChip, labelName, type NutritionInfo } from '@/lib/menu-labels';
import { cn } from '@/lib/utils';

export interface MenuItemDetailData {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl?: string | null;
  allergens: string[];
  labels: string[];
  nutrition: NutritionInfo | null;
}

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

export function ItemDetailView({
  item,
  backHref,
  quantity = 0,
  onAdd,
  onIncrement,
  onDecrement,
}: {
  item: MenuItemDetailData;
  backHref: string;
  quantity?: number;
  onAdd?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
}) {
  const t = useTranslations('menu_detail');
  const tLabels = useTranslations('menu_detail.labels');
  const tCart = useTranslations('cart');
  const tCommon = useTranslations('common');
  const cartEnabled = Boolean(onAdd);

  const labelText = (label: string): string => {
    try {
      return (tLabels as unknown as (k: string) => string)(label);
    } catch {
      return labelName(label);
    }
  };

  const n = item.nutrition;
  const calories = n?.caloriesKcal ?? null;
  const servingSize = n?.servingSize?.trim() || null;

  const macros: Array<{ key: string; label: string; value: string }> = [];
  if (n?.proteinG != null) macros.push({ key: 'protein', label: t('protein'), value: `${n.proteinG} g` });
  if (n?.carbsG != null) macros.push({ key: 'carbs', label: t('carbs'), value: `${n.carbsG} g` });
  if (n?.fatG != null) macros.push({ key: 'fat', label: t('fat'), value: `${n.fatG} g` });

  const secondary: Array<{ key: string; label: string; value: string }> = [];
  if (n?.sugarG != null) secondary.push({ key: 'sugar', label: t('sugar'), value: `${n.sugarG} g` });
  if (n?.sodiumMg != null) secondary.push({ key: 'sodium', label: t('sodium'), value: `${n.sodiumMg} mg` });

  // Calories live in the hero pill, so the nutrition section only renders when
  // there's additional detail (macros or sugar/sodium) to show.
  const hasNutrition = macros.length > 0 || secondary.length > 0;

  const hasImage = Boolean(item.imageUrl);

  return (
    <main className={cn('mx-auto min-h-screen max-w-2xl bg-background', cartEnabled && 'pb-28')}>
      {/* Hero — only when the item actually has a photo. Restaurants that don't
          upload images get a compact back-button bar instead of an empty box. */}
      {hasImage ? (
        <div className="relative">
          <div className="aspect-[4/3] w-full overflow-hidden sm:aspect-[16/10] sm:rounded-b-3xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl!} alt={item.name} className="h-full w-full object-cover" />
          </div>

          <Link
            href={backHref}
            aria-label={tCommon('back')}
            className="absolute left-4 top-4 inline-flex size-10 items-center justify-center rounded-full bg-card/90 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-card"
          >
            <ChevronLeft className="size-5" />
          </Link>

          {calories != null && (
            <span className="absolute bottom-0 right-4 translate-y-1/2 rounded-full bg-card px-4 py-2 text-sm font-semibold shadow-md">
              {calories} kcal
            </span>
          )}
        </div>
      ) : (
        <div className="px-4 pt-4 sm:px-6">
          <Link
            href={backHref}
            aria-label={tCommon('back')}
            className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent"
          >
            <ChevronLeft className="size-5" />
          </Link>
        </div>
      )}

      {/* Body */}
      <div className={cn('space-y-6 px-5 sm:px-6', hasImage ? 'pt-8' : 'pt-5')}>
        <div>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {item.name}
            {servingSize && (
              <span className="font-normal text-muted-foreground">, {servingSize}</span>
            )}
          </h1>
          {!cartEnabled && (
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
              {formatPrice(item.priceCents)}
            </p>
          )}
          {!hasImage && calories != null && (
            <span className="mt-3 inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-semibold tabular-nums">
              {calories} kcal
            </span>
          )}
        </div>

        {item.labels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {item.labels.map((l) => (
              <LabelChip key={l} label={l} name={labelText(l)} />
            ))}
          </div>
        )}

        {item.description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        )}

        {item.allergens.length > 0 && (
          <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{t('contains')}:</span>{' '}
            {item.allergens.join(', ')}
          </p>
        )}

        {hasNutrition && (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold">{t('nutrition')}</h2>
              {servingSize && (
                <span className="text-xs text-muted-foreground">
                  {t('per_serving', { size: servingSize })}
                </span>
              )}
            </div>

            {macros.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {macros.map((m) => (
                  <NutritionTile key={m.key} label={m.label} value={m.value} />
                ))}
              </div>
            )}

            {secondary.length > 0 && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                {secondary.map((s) => (
                  <span key={s.key}>
                    {s.label}: <span className="font-medium text-foreground">{s.value}</span>
                  </span>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Sticky add-to-cart bar (ordering context only) */}
      {cartEnabled && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <span className="font-mono text-lg font-semibold tabular-nums">
              {formatPrice(item.priceCents)}
            </span>
            {quantity > 0 ? (
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-11 w-11 rounded-full text-lg"
                  onClick={onDecrement}
                  aria-label="Decrease quantity"
                >
                  −
                </Button>
                <span className="w-8 text-center text-lg font-semibold tabular-nums">
                  {quantity}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-11 w-11 rounded-full text-lg"
                  onClick={onIncrement}
                  aria-label="Increase quantity"
                >
                  +
                </Button>
              </div>
            ) : (
              <Button
                onClick={onAdd}
                className="h-12 rounded-full gradient-brand px-10 text-base font-semibold shadow-md shadow-primary/30"
              >
                {tCart('add')}
              </Button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function NutritionTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl bg-secondary px-3 py-3 text-center">
      <p className="font-mono text-lg font-semibold tabular-nums leading-none">
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
