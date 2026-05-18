import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from './_base';

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

  @Column({ type: 'boolean', default: true })
  available!: boolean;

  @Column({ type: 'integer', default: 0 })
  position!: number;
}
