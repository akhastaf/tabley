import {
  BadgeCheck,
  Flame,
  Leaf,
  MilkOff,
  Nut,
  Salad,
  Sprout,
  WheatOff,
  type LucideIcon,
} from 'lucide-react';
import { MenuLabel, MENU_LABELS, type NutritionInfo } from '@tabley/shared';
import { cn } from '@/lib/utils';

export { MenuLabel, MENU_LABELS };
export type { NutritionInfo };

// Icon + colour tone per curated label. Icons are decorative — every place
// that renders an icon-only chip also exposes the name (tooltip or text) so
// the meaning is never icon-dependent.
export const LABEL_META: Record<string, { icon: LucideIcon; tone: string }> = {
  [MenuLabel.VEGETARIAN]: { icon: Salad, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  [MenuLabel.VEGAN]: { icon: Leaf, tone: 'text-green-600 bg-green-50 border-green-200' },
  [MenuLabel.GLUTEN_FREE]: { icon: WheatOff, tone: 'text-amber-600 bg-amber-50 border-amber-200' },
  [MenuLabel.DAIRY_FREE]: { icon: MilkOff, tone: 'text-sky-600 bg-sky-50 border-sky-200' },
  [MenuLabel.NUT_FREE]: { icon: Nut, tone: 'text-orange-600 bg-orange-50 border-orange-200' },
  [MenuLabel.HALAL]: { icon: BadgeCheck, tone: 'text-teal-600 bg-teal-50 border-teal-200' },
  [MenuLabel.SPICY]: { icon: Flame, tone: 'text-red-600 bg-red-50 border-red-200' },
  [MenuLabel.ORGANIC]: { icon: Sprout, tone: 'text-lime-600 bg-lime-50 border-lime-200' },
};

// English fallback names — used by the management UI (which is not localised).
// The customer-facing surfaces localise via the `menu_detail.labels` namespace.
export const LABEL_NAMES_EN: Record<string, string> = {
  [MenuLabel.VEGETARIAN]: 'Vegetarian',
  [MenuLabel.VEGAN]: 'Vegan',
  [MenuLabel.GLUTEN_FREE]: 'Gluten-free',
  [MenuLabel.DAIRY_FREE]: 'Dairy-free',
  [MenuLabel.NUT_FREE]: 'Nut-free',
  [MenuLabel.HALAL]: 'Halal',
  [MenuLabel.SPICY]: 'Spicy',
  [MenuLabel.ORGANIC]: 'Organic',
};

export function labelName(label: string): string {
  return LABEL_NAMES_EN[label] ?? label;
}

/**
 * Icon-only badge. Carries a native `title` (hover tooltip) and an aria-label
 * so the meaning is reachable without the full detail view. Pass a localised
 * `name` on customer-facing surfaces; defaults to the English name otherwise.
 */
export function LabelIcon({
  label,
  name,
  className,
}: {
  label: string;
  name?: string;
  className?: string;
}) {
  const meta = LABEL_META[label];
  if (!meta) return null;
  const Icon = meta.icon;
  const title = name ?? labelName(label);
  return (
    <span
      title={title}
      aria-label={title}
      role="img"
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-full border',
        meta.tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
    </span>
  );
}

/** Icon + text chip used in the detail view and the management editor. */
export function LabelChip({ label, name, className }: { label: string; name?: string; className?: string }) {
  const meta = LABEL_META[label];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        meta.tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {name ?? labelName(label)}
    </span>
  );
}
