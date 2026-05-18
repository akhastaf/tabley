import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from './_base';

@Entity({ name: 'menu_categories' })
export class MenuCategoryEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Index()
  @Column({ type: 'integer', default: 0 })
  position!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
