import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from './_base';

// Structural shape of the `nutrition` jsonb column. The authoritative
// validation lives in @tabley/shared's nutritionSchema; this mirror keeps the
// database package free of a cross-package dependency.
export interface MenuItemNutrition {
  caloriesKcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  sugarG?: number;
  sodiumMg?: number;
  servingSize?: string;
}

// Per-language overlay for translatable item fields, keyed by language code
// (e.g. { it: { name: 'Pizza Margherita', description: '…' } }). The base
// language content lives in the plain `name`/`description` columns.
export interface MenuItemTranslation {
  name?: string;
  description?: string;
}
export type MenuItemTranslations = Record<string, MenuItemTranslation>;

@Entity({ name: 'menu_items' })
export class MenuItemEntity extends TenantScopedEntity {
  @Index()
  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'price_cents', type: 'integer' })
  priceCents!: number;

  @Column({ name: 'image_url', type: 'varchar', length: 1024, nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  allergens!: string[];

  // Curated dietary/feature tags (e.g. 'vegan', 'gluten_free'). See MenuLabel
  // in @tabley/shared for the allowed values.
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  labels!: string[];

  @Column({ type: 'jsonb', nullable: true })
  nutrition!: MenuItemNutrition | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  translations!: MenuItemTranslations;

  @Column({ type: 'boolean', default: true })
  available!: boolean;

  @Column({ type: 'integer', default: 0 })
  position!: number;
}
